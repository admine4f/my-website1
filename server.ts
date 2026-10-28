import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Suppress Node.js DEP0169 url.parse deprecation warning caused by legacy express router
process.on('warning', (warning) => {
  if (warning.name === 'DeprecationWarning' && (warning.message?.includes('DEP0169') || (warning as any).code === 'DEP0169')) {
    return;
  }
});

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
// Server database access uses ONLY the service-role key (never an anon / VITE_ key).
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const supabase: SupabaseClient | null = (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })
  : null;

export const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL) || Boolean(process.env.VERCEL_ENV);

if (isProduction && (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)) {
  console.error('[CRITICAL] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in production! In-memory fallback is disabled to prevent wallet balance loss.');
}

/**
 * Ensures Supabase client is initialized.
 * Throws explicit error instead of falling back to ephemeral memory.
 */
export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      '[CRITICAL DATABASE EXCEPTION] Supabase connection is required. ' +
      'In-memory fallback has been removed to prevent wallet balance loss. ' +
      'Please configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment.'
    );
  }
  return supabase;
}

const app = express();
const PORT = 3000;

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || '';
const SESSION_SECRET_KEY: string = (() => {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  // Stable across serverless instances, derived only from secrets that exist in the server environment.
  const seed = [
    process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || '',
    process.env.ADMIN_SECRET || process.env.ADMIN_PASSWORD || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  ].join('|');
  if (seed.replace(/\|/g, '')) {
    return crypto.createHash('sha256').update('e4f-session-v2|' + seed).digest('hex');
  }
  console.error('[SECURITY] SESSION_SECRET (or TELEGRAM_BOT_TOKEN / ADMIN_SECRET) is not set. Using a random secret: sessions will not survive restarts.');
  return crypto.randomBytes(32).toString('hex');
})();

export function verifyTelegramInitData(initData: string, botToken: string): { valid: boolean; user?: any; error?: string } {
  try {
    if (!initData || typeof initData !== 'string') {
      return { valid: false, error: 'initData string is required' };
    }
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) {
      return { valid: false, error: 'Missing hash parameter' };
    }

    const authDateStr = params.get('auth_date');
    if (authDateStr) {
      const authDate = parseInt(authDateStr, 10);
      const nowSec = Math.floor(Date.now() / 1000);
      // Reject if older than 24h or in future
      if (!isNaN(authDate) && (nowSec - authDate > 86400 || authDate - nowSec > 300)) {
        return { valid: false, error: 'Telegram authentication expired' };
      }
    }

    params.delete('hash');
    const sortedKeys = Array.from(params.keys()).sort();
    const dataCheckString = sortedKeys.map(k => `${k}=${params.get(k)}`).join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    const hashBuf = Buffer.from(hash, 'utf-8');
    const calcBuf = Buffer.from(calculatedHash, 'utf-8');
    if (hashBuf.length !== calcBuf.length || !crypto.timingSafeEqual(hashBuf, calcBuf)) {
      return { valid: false, error: 'Cryptographic signature mismatch' };
    }

    const userParam = params.get('user');
    const user = userParam ? JSON.parse(userParam) : null;
    return { valid: true, user };
  } catch (err: any) {
    return { valid: false, error: err.message || 'Verification exception' };
  }
}

export function generateUserSessionToken(userId: string): string {
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
  const payload = `usr:${userId}:${expiresAt}`;
  const signature = crypto.createHmac('sha256', SESSION_SECRET_KEY).update(payload).digest('hex');
  return `${payload}:${signature}`;
}

export function verifyUserSessionToken(token: string): { valid: boolean; userId?: string } {
  if (!token || typeof token !== 'string') return { valid: false };
  const parts = token.split(':');
  if (parts.length !== 4) return { valid: false };
  const [prefix, userId, expiresAtStr, signature] = parts;
  if (prefix !== 'usr' || !userId) return { valid: false };
  const expiresAt = parseInt(expiresAtStr, 10);
  if (isNaN(expiresAt) || Date.now() > expiresAt) return { valid: false };

  const expectedSignature = crypto.createHmac('sha256', SESSION_SECRET_KEY).update(`${prefix}:${userId}:${expiresAt}`).digest('hex');
  const sigBuf = Buffer.from(signature, 'utf-8');
  const expBuf = Buffer.from(expectedSignature, 'utf-8');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return { valid: false };
  }
  return { valid: true, userId };
}

function requireUserAuth(req: Request, res: Response, next: () => void) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : ((req.headers['x-session-token'] as string) || '').trim();

  if (token) {
    const verified = verifyUserSessionToken(token);
    if (verified.valid && verified.userId) {
      (req as any).verifiedUserId = verified.userId;

      // Strict account ownership check: target user in body, params, or query must match authenticated session
      const targetUserId = req.body?.userId || req.params?.userId || (req.query?.userId as string);
      if (targetUserId && targetUserId !== verified.userId) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Account ownership verification failed. You cannot operate on an account that does not belong to you.',
        });
      }

      return next();
    }
  }

  // Development fallback only when TELEGRAM_BOT_TOKEN is not configured and not in production
  if (!isProduction && !TELEGRAM_BOT_TOKEN) {
    const targetUserId = req.body?.userId || req.params?.userId || (req.query?.userId as string);
    if (targetUserId) {
      (req as any).verifiedUserId = targetUserId;
      return next();
    }
  }

  return res.status(401).json({ success: false, error: 'Unauthorized: Valid user authentication session required.' });
}

// Body Parsers with Vercel Serverless Stream-Drain Protection
const jsonParser = express.json({ limit: '10mb' });
const urlencodedParser = express.urlencoded({ extended: true, limit: '10mb' });
const textParser = express.text({ limit: '10mb' });

app.use((req: any, res: Response, next) => {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string' && req.body.trim().startsWith('{')) {
      try {
        req.body = JSON.parse(req.body);
      } catch {}
    }
    return next();
  }
  jsonParser(req, res, (err) => {
    if (err) return next(err);
    urlencodedParser(req, res, (err2) => {
      if (err2) return next(err2);
      textParser(req, res, next);
    });
  });
});

// Enable CORS for all incoming requests (crucial for iframe preview & API requests)
app.use((req, res, next) => {
  const origin = String(req.headers.origin || '');
  if (origin) {
    let allowed = false;
    try {
      const oh = new URL(origin).host;
      const extra = [process.env.APP_URL || '', ...(process.env.ALLOWED_ORIGINS || '').split(',')]
        .map(x => x.trim()).filter(Boolean)
        .map(x => { try { return new URL(x).host; } catch { return x; } });
      allowed = oh === String(req.headers.host || '') || extra.includes(oh) || (!isProduction && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(oh));
    } catch {}
    if (allowed) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Vary', 'Origin');
    }
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-session-token, x-admin-key, x-admin-token');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// ---------------------------------------------------------------------
// ADMIN SETTINGS SHARED ACROSS SERVERLESS INSTANCES
// On Vercel every request may run on a different instance, so the in-memory
// `systemSettings` can be stale. Before API requests we re-read the saved row
// from Supabase (cached 3s). Admin saves always refresh first, so one stale
// instance can never overwrite a newer setting.
// ---------------------------------------------------------------------
let settingsLoadedAt = 0;
async function refreshSystemSettings(force = false): Promise<void> {
  if (!supabase) return;
  if (!force && Date.now() - settingsLoadedAt < 3000) return;
  try {
    const { data, error } = await supabase.from('system_settings').select('settings').eq('id', 'global_settings').maybeSingle();
    if (error) return;
    if (data && data.settings && typeof data.settings === 'object') {
      Object.assign(systemSettings, data.settings);
      delete (systemSettings as any).spin_01_adsgram;
      delete (systemSettings as any).spin_05_adexora;
      delete (systemSettings as any).box_01_adsgram;
      delete (systemSettings as any).box_05_adexora;
      delete (systemSettings as any).mining_01_adsgram;
      delete (systemSettings as any).mining_05_adexora;
      normalizeAdSlotSettings();
    }
    settingsLoadedAt = Date.now();
  } catch {}
}
app.use('/api', async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const isSettingsWrite = req.method !== 'GET' && /\/admin\/settings/.test(req.path);
    await refreshSystemSettings(isSettingsWrite);
  } catch {}
  next();
});

// URL Normalization for Vercel Serverless & Proxies
app.use((req, _res, next) => {
  const forwardedUri = (req.headers['x-forwarded-uri'] || req.headers['x-matched-path']) as string;
  if (forwardedUri && typeof forwardedUri === 'string' && forwardedUri.startsWith('/api') && req.url !== forwardedUri) {
    req.url = forwardedUri;
  } else if (req.url && !req.url.startsWith('/api') && !req.url.startsWith('/assets') && !req.url.startsWith('/_')) {
    if (
      req.url.startsWith('/admin') ||
      req.url.startsWith('/wallet') ||
      req.url.startsWith('/user') ||
      req.url.startsWith('/system') ||
      req.url.startsWith('/mining') ||
      req.url.startsWith('/market') ||
      req.url.startsWith('/trade') ||
      req.url.startsWith('/support') ||
      req.url.startsWith('/announcements') ||
      req.url.startsWith('/withdraw')
    ) {
      req.url = '/api' + req.url;
    }
  }
  next();
});

// In-Memory Database & Persistence Layer
interface UserRecord {
  id: string;
  uid: string;
  telegramId: number;
  firstName: string;
  lastName?: string;
  username?: string;
  photoUrl?: string;
  referralCode: string;
  referredBy?: string;
  createdAt: number;
  status: 'ACTIVE' | 'RESTRICTED' | 'SUSPENDED';
  claimedWelcomeBonus: boolean;
  isDemoUser: boolean;
  isVerified?: boolean;
  depositBalance?: number;
  depositAddress?: string;
}

interface BalanceRecord {
  usdt: number;
  e4f: number;
  bnb: number;
  btc: number;
  eth: number;
  sol: number;
  ton?: number;
  xrp?: number;
  doge?: number;
  ada?: number;
  trx?: number;
  ltc?: number;
}

interface TxRecord {
  id: string;
  userId: string;
  asset: 'USDT' | 'E4F' | 'BTC' | 'ETH' | 'SOL' | 'BNB';
  amount: number;
  direction: 'IN' | 'OUT';
  source: string;
  status: 'COMPLETED' | 'PENDING' | 'FAILED' | 'REJECTED';
  timestamp: number;
  referenceId?: string;
  note?: string;
  address?: string;
  network?: string;
  fee?: number;
  userDepositTotal?: number;
  txHash?: string;
}

interface MiningRecord {
  id: string;
  userId: string;
  startTime: number;
  endTime: number;
  durationSeconds: number;
  miningRatePerHour: number;
  estimatedReward: number;
  status: 'ACTIVE' | 'COMPLETED' | 'CLAIMED' | 'CANCELLED';
  adVerified: boolean;
  adSessionId?: string;
  claimedAt?: number;
}

// In-memory data store
const users = new Map<string, UserRecord>();
const balances = new Map<string, BalanceRecord>();
const transactions: TxRecord[] = [];
const miningSessions: MiningRecord[] = [];
interface MiningAdSessionRecord {
  sessionId: string;
  userId: string;
  actionType?: 'MINING' | 'SPIN' | 'GIFT_BOX';
  targetId?: number;
  startedAt: number;
  endsAt: number;
  durationSeconds: number;
  verified: boolean;
  consumed: boolean;
  token: string;
  claimToken?: string;
  createdAt: number;
  monetagS2SConfirmed?: boolean;
  sdkCompleted?: boolean;
  adOpenedAt?: number;
  watchStarted?: boolean;
  verifiedAt?: number;
  consumedAt?: number;
}
const miningAdSessions = new Map<string, MiningAdSessionRecord>();
const adSessions = new Map<string, { userId: string; createdAt: number; verified: boolean; token: string }>();
const auditLogs: Array<{ id: string; adminId: string; action: string; target: string; details: string; timestamp: number }> = [];

export interface ReferralRecord {
  id: string;
  referrerId: string;
  referredUserId: string;
  referredUid: string;
  referredName: string;
  timestamp: number;
  status: 'ACTIVE' | 'QUALIFIED' | 'PENDING';
  minedDays: number;
  rewardEarned: number;
}
const referralHistory: ReferralRecord[] = [];

// Default 8 Spin Wheel segments
const defaultSpinWheelPrizes = [
  { id: 0, label: '0.25 E4F', asset: 'E4F' as const, amount: 0.25, color: '#3B82F6' },
  { id: 1, label: '0.50 USDT', asset: 'USDT' as const, amount: 0.50, color: '#10B981' },
  { id: 2, label: '1.00 E4F', asset: 'E4F' as const, amount: 1.00, color: '#EAB308' },
  { id: 3, label: '0.10 USDT', asset: 'USDT' as const, amount: 0.10, color: '#6366F1' },
  { id: 4, label: '2.50 E4F', asset: 'E4F' as const, amount: 2.50, color: '#EC4899' },
  { id: 5, label: '1.00 USDT', asset: 'USDT' as const, amount: 1.00, color: '#14B8A6' },
  { id: 6, label: '5.00 E4F', asset: 'E4F' as const, amount: 5.00, color: '#F97316' },
  { id: 7, label: '2.00 USDT', asset: 'USDT' as const, amount: 2.00, color: '#8B5CF6' },
];

// Default 5 Mystery Gift Boxes
const defaultGiftBoxesConfig = [
  { id: 1, boxNumber: 1, name: 'Bronze Treasure', rewardAsset: 'E4F' as const, rewardAmount: 2.5, color: '#38BDF8' },
  { id: 2, boxNumber: 2, name: 'Silver Cache', rewardAsset: 'USDT' as const, rewardAmount: 1.5, color: '#A855F7' },
  { id: 3, boxNumber: 3, name: 'Gold Vault', rewardAsset: 'E4F' as const, rewardAmount: 5.0, color: '#EAB308' },
  { id: 4, boxNumber: 4, name: 'Ruby Chest', rewardAsset: 'USDT' as const, rewardAmount: 3.0, color: '#EF4444' },
  { id: 5, boxNumber: 5, name: 'Diamond Relic', rewardAsset: 'E4F' as const, rewardAmount: 10.0, color: '#10B981' },
];

// Default 7-Day Daily Check-In Streak Rewards (Configurable E4F / USDT configurable by admin in Telegram)
const defaultDailyCheckInRewards = [
  { day: 1, asset: 'USDT' as 'E4F' | 'USDT', amount: 0.01 },
  { day: 2, asset: 'USDT' as 'E4F' | 'USDT', amount: 0.02 },
  { day: 3, asset: 'USDT' as 'E4F' | 'USDT', amount: 0.03 },
  { day: 4, asset: 'E4F' as 'E4F' | 'USDT', amount: 3.0 },
  { day: 5, asset: 'E4F' as 'E4F' | 'USDT', amount: 5.0 },
  { day: 6, asset: 'USDT' as 'E4F' | 'USDT', amount: 0.05 },
  { day: 7, asset: 'USDT' as 'E4F' | 'USDT', amount: 0.07 },
];

// Deterministic unique deposit address per user (BEP20 EVM format)
function generateUserDepositAddress(userId: string, uid: string): string {
  const hash = crypto.createHash('sha256').update(`E4F_USER_DEPOSIT_BEP20_${userId}_${uid}`).digest('hex');
  return '0x' + hash.slice(0, 40);
}

const defaultNetworkWithdrawSettings: Record<string, { enabled: boolean; minAmount: number; maxAmount: number; fee: number }> = {
  TRC20: { enabled: true, minAmount: 1.0, maxAmount: 1000.0, fee: 1.0 },
  BEP20: { enabled: true, minAmount: 1.0, maxAmount: 1000.0, fee: 0.5 },
  TON: { enabled: true, minAmount: 1.0, maxAmount: 1000.0, fee: 0.5 },
};

// Admin System Settings
const SETTINGS_FILE = path.join(process.cwd(), 'system-settings.json');
const systemSettings = {
  miningRatePerHour: 0.25,
  miningDurationHours: 8,
  rewardedAdRequired: true,
  strictTaskTimer: true,
  adMinWatchSeconds: 5,
  adMiningDurationSeconds: 30,
  miningAdDurationSeconds: 30,
  spinAdDurationSeconds: 30,
  giftBoxAdDurationSeconds: 30,
  adProvider: 'RichAds' as any,
  adsterraDirectLink: 'https://beta.publishers.adsterra.com/direct-link-demo',
  monetagDirectLink: '',
  monetagZoneId: '12044377',
  monetagTelegramSdkEnabled: true,
  welcomeBonusEnabled: true,
  welcomeBonusUSDT: 25,
  welcomeBonusE4F: 10,
  referralBonusUSDT: 5,
  e4fListingStatus: 'PENDING_LISTING',
  e4fPlannedListingDate: '2028-02-28',
  e4fPlannedTargetPriceRange: 'Not Listed Yet',
  depositsEnabled: false,
  withdrawalsEnabled: true,
  minWithdrawalLimit: 0.1,
  maxWithdrawalLimit: 1000.0,
  withdrawalFee: 1.0,
  networkWithdrawSettings: defaultNetworkWithdrawSettings,
  depositMinUSDT: 2.0,
  depositFirstBonusUSDT: 10.0,
  bscDepositAddress: '0x63562945f7845aa1130a5b1499720b29788c82db',
  referralMiningBoostTiers: [
    { minReferrals: 1, boostPercent: 5 },
    { minReferrals: 3, boostPercent: 15 },
    { minReferrals: 5, boostPercent: 25 },
    { minReferrals: 10, boostPercent: 50 },
    { minReferrals: 20, boostPercent: 100 },
  ],
  rewardSpinMaxDaily: 5,
  rewardSpinAdRequired: true,
  giftBoxMaxDaily: 5,
  giftBoxAdRequired: true,
  spinWheelPrizes: defaultSpinWheelPrizes,
  giftBoxesConfig: defaultGiftBoxesConfig,
  dailyCheckInRewards: defaultDailyCheckInRewards,
  // Waterfall Ad Block / Zone ID / App IDs (5 Tiers: RichAds, Monetag, OnClickA)
  spin_01_richads: '410203',
  spin_02_monetag: '12044377',
  spin_03_onclicka: '6153717',
  spin_04_richads: '410203',
  spin_05_monetag: '12044377',
  box_01_richads: '410202',
  box_02_monetag: '12044377',
  box_03_onclicka: '6153772',
  box_04_richads: '410202',
  box_05_monetag: '12044377',
  // Mining Ad Gate & Waterfall Settings (Configurable from Admin without app updates)
  miningPrimaryNetwork: 'RichAds' as 'OnClickA' | 'RichAds' | 'Monetag',
  miningSecondaryNetwork: 'Monetag' as 'OnClickA' | 'RichAds' | 'Monetag',
  miningWaterfallEnabled: true,
  mining_01_richads: '410204',
  mining_02_monetag: '12044377',
  mining_03_onclicka: '6153774',
  mining_04_richads: '410204',
  mining_05_monetag: '12044377',
};

// Load persisted settings on startup if exists
try {
  if (fs.existsSync(SETTINGS_FILE)) {
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    Object.assign(systemSettings, parsed);
  }
} catch (e) {
  console.error('Could not load system-settings.json:', e);
}

// Convert legacy numeric IDs to full E4F format
if (systemSettings.spin_03_onclicka === '6153717') systemSettings.spin_03_onclicka = '6153717';
if (systemSettings.box_03_onclicka === '6153772') systemSettings.box_03_onclicka = '6153772';
if (systemSettings.mining_03_onclicka === '6153774') systemSettings.mining_03_onclicka = '6153774';

// Guarantee 100% real IDs are present and no placeholder strings exist
const REAL_DEFAULT_IDS: Record<string, string> = {
  spin_01_richads: '410203',
  spin_02_monetag: '12044377',
  spin_03_onclicka: '6153717',
  spin_04_richads: '410203',
  spin_05_monetag: '12044377',
  box_01_richads: '410202',
  box_02_monetag: '12044377',
  box_03_onclicka: '6153772',
  box_04_richads: '410202',
  box_05_monetag: '12044377',
  mining_01_richads: '410204',
  mining_02_monetag: '12044377',
  mining_03_onclicka: '6153774',
  mining_04_richads: '410204',
  mining_05_monetag: '12044377',
  monetagZoneId: '12044377',
};
for (const [k, fallback] of Object.entries(REAL_DEFAULT_IDS)) {
  const current = (systemSettings as any)[k];
  if (!current || typeof current !== 'string' || /^(spin|box|mining)_[0-9a-z_]+$/i.test(current.trim())) {
    (systemSettings as any)[k] = fallback;
  }
}
systemSettings.monetagDirectLink = '';

// Dynamic Tasks definition
interface DynamicTask {
  id: string;
  title: string;
  description: string;
  platform: string;
  url: string;
  rewardAsset: 'E4F' | 'USDT';
  rewardAmount: number;
  status: 'AVAILABLE' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  verificationMethod: 'AUTO' | 'MANUAL' | 'TIMER';
  durationSeconds?: number;
}

const dynamicTasks: DynamicTask[] = [
  {
    id: 'task-tg-channel',
    title: 'Join E4F Official Telegram Channel',
    description: 'Subscribe to our official announcement channel for daily updates.',
    platform: 'TELEGRAM',
    url: 'https://t.me/E4F_Exchange_Official',
    rewardAsset: 'E4F',
    rewardAmount: 0.50,
    status: 'AVAILABLE',
    verificationMethod: 'AUTO',
  },
  {
    id: 'task-x-follow',
    title: 'Follow E4F Exchange on X (Twitter)',
    description: 'Follow our official X handle and retweet the pinned listing roadmap.',
    platform: 'TWITTER',
    url: 'https://x.com/E4FExchange',
    rewardAsset: 'USDT',
    rewardAmount: 1.00,
    status: 'AVAILABLE',
    verificationMethod: 'MANUAL',
  },
  {
    id: 'task-yt-subscribe',
    title: 'Subscribe to E4F YouTube Channel',
    description: 'Watch the Web3 Mining Ecosystem guide and subscribe.',
    platform: 'YOUTUBE',
    url: 'https://youtube.com/@E4FWeb3Exchange',
    rewardAsset: 'E4F',
    rewardAmount: 0.75,
    status: 'AVAILABLE',
    verificationMethod: 'AUTO',
  },
  {
    id: 'task-community-join',
    title: 'Join E4F Global Traders Group',
    description: 'Connect with over 250,000 miners and crypto traders globally.',
    platform: 'COMMUNITY',
    url: 'https://t.me/E4F_Global_Traders',
    rewardAsset: 'USDT',
    rewardAmount: 0.50,
    status: 'AVAILABLE',
    verificationMethod: 'AUTO',
  },
  {
    id: 'task-web-whitepaper',
    title: 'Review E4F Tokenomics & Whitepaper',
    description: 'Browse the 2028 Mainnet Roadmap and token distribution model. (30s verification timer)',
    platform: 'WEBSITE',
    url: 'https://e4f-exchange.org/whitepaper',
    rewardAsset: 'USDT',
    rewardAmount: 1.00,
    status: 'AVAILABLE',
    verificationMethod: 'TIMER',
    durationSeconds: 30,
  },
  {
    id: 'task-web-explorer',
    title: 'Inspect E4F Pre-Listing Blockchain Explorer',
    description: 'Visit the live testnet explorer and monitor node consensus blocks for at least 30 seconds.',
    platform: 'WEBSITE',
    url: 'https://e4f-exchange.org/explorer',
    rewardAsset: 'E4F',
    rewardAmount: 1.50,
    status: 'AVAILABLE',
    verificationMethod: 'TIMER',
    durationSeconds: 30,
  },
];

// Tracking user task submissions
const userTaskSubmissions = new Map<string, Array<{ taskId: string; status: string; proof?: string; timestamp: number }>>();

// Admin review queue for manual task proof submissions
export interface TaskSubmissionRecord {
  id: string;
  userId: string;
  userUid: string;
  taskId: string;
  taskTitle: string;
  proof: string;
  usernameOrLink?: string;
  screenshot?: string;
  description?: string;
  status: 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  rewardAmount: number;
  rewardAsset: 'E4F' | 'USDT';
  timestamp: number;
  adminNote?: string;
}
const taskSubmissionsQueue: TaskSubmissionRecord[] = [];

// Active Website Task Timers (userId_taskId -> startTime)
const activeTaskTimers = new Map<string, { startTime: number; durationSeconds: number; accumulatedSeconds?: number }>();

// Daily Spin counts (userId -> { date: string, count: number })
const userDailySpins = new Map<string, { date: string; count: number }>();

// Daily Gift Box opens (userId -> { date: string, count: number, openedBoxIds: number[] })
const userDailyGiftBoxOpens = new Map<string, { date: string; count: number; openedBoxIds: number[] }>();

// First deposit tracking set (userIds that have deposited)
const userFirstDepositClaimed = new Set<string>();

// 5 Gift Boxes state per user
const userGiftBoxes = new Map<string, Array<{ id: number; boxNumber: number; name: string; rewardAsset: 'E4F' | 'USDT'; rewardAmount: number; color: string; isOpened: boolean }>>();

// Daily Check-in state & persistence helpers
interface UserCheckInState {
  currentStreak: number;
  currentDay: number;
  lastDate: string;
  streakCount: number;
  claimedDays: number[];
}

const userDailyCheckIns = new Map<string, UserCheckInState>();

function getUtcDates() {
  const now = new Date();
  const todayUtc = now.toISOString().split('T')[0];
  const yesterdayDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  const yesterdayUtc = yesterdayDate.toISOString().split('T')[0];
  return { todayUtc, yesterdayUtc };
}

async function loadUserDailyCheckIn(userId: string): Promise<UserCheckInState> {
  const cached = userDailyCheckIns.get(userId);
  if (cached) return cached;

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('e4f_daily_checkins')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (!error && data) {
        const currentDay = Number(data.current_day) || 1;
        const check: UserCheckInState = {
          currentStreak: currentDay,
          currentDay,
          lastDate: data.last_claim_date || '',
          streakCount: Number(data.streak_count) || 0,
          claimedDays: currentDay ? Array.from({ length: currentDay }, (_, i) => i + 1) : [],
        };
        userDailyCheckIns.set(userId, check);
        return check;
      }
    } catch (e: any) {
      console.warn('[Supabase] Warning reading e4f_daily_checkins:', e?.message);
    }
  }

  const defaultCheck: UserCheckInState = {
    currentStreak: 0,
    currentDay: 0,
    lastDate: '',
    streakCount: 0,
    claimedDays: [],
  };
  userDailyCheckIns.set(userId, defaultCheck);
  return defaultCheck;
}

interface AnnouncementRecord {
  id: string;
  title: string;
  description: string;
  ctaText?: string;
  ctaUrl?: string;
  imageUrl?: string;
  priority?: number | string;
  type?: string;
  isActive: boolean;
  publishedAt?: number;
  validUntil?: number;
}

// Announcements
let announcements: AnnouncementRecord[] = [
  {
    id: 'ann-1',
    title: 'E4F Web3 Exchange Mining Season is Live!',
    description: 'Start your 8-hour mining session now and accumulate official E4F tokens before the planned listing milestone on 28 February 2028.',
    ctaText: 'Start Mining',
    ctaUrl: '#mining',
    imageUrl: '/web3_banner.jpg',
    priority: 1,
    isActive: true,
  },
  {
    id: 'ann-2',
    title: 'Instant 25 USDT + 10 E4F Welcome Bonus',
    description: 'All verified Telegram accounts receive immediate spot wallet funding. Explore live BTC/USDT and spot order books.',
    ctaText: 'View Wallet',
    ctaUrl: '#wallet',
    imageUrl: '/e4f_coin.jpg',
    priority: 2,
    isActive: true,
  },
  {
    id: 'ann-3',
    title: 'Invite & Earn 5 USDT per Qualified Referral',
    description: 'Share your personal referral link. When your friend mines actively for 30 days, receive 5 USDT directly into your Spot Available balance.',
    ctaText: 'Invite Friends',
    ctaUrl: '#referral',
    imageUrl: '/web3_banner.jpg',
    priority: 3,
    isActive: true,
  },
];

// Support Tickets
const supportTickets: Array<{
  id: string;
  userId: string;
  subject: string;
  message: string;
  status: 'OPEN' | 'PENDING' | 'RESOLVED';
  createdAt: number;
  adminReply?: string;
}> = [];

// Orders & Trades
const spotOrders: Array<{
  id: string;
  userId: string;
  pair: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT';
  price: number;
  amount: number;
  totalUSDT: number;
  filledAmount: number;
  status: 'FILLED' | 'CANCELLED' | 'OPEN';
  timestamp: number;
}> = [];

// ====================================================
// Supabase-Backed Persistence Engine
// Table: balances (user_id, USDT, E4F, BNB, BTC, ETH, SOL, TON, XRP, DOGE, ADA, TRX, LTC)
// Completely removes local file system dependency (.db_content.json / app-database.json)
// Perfectly compatible with Vercel Serverless & prevents balances resetting to 0
// ====================================================

let isDbDirty = false;
function markDbDirty() {
  isDbDirty = true;
}

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000; // 90 days in milliseconds

function apply90DayRetentionPolicy(): {
  purgedTransactions: number;
  purgedOrders: number;
  purgedLogs: number;
  purgedSubmissions: number;
  purgedReferrals: number;
} {
  const cutoff = Date.now() - NINETY_DAYS_MS;
  let purgedTransactions = 0;
  let purgedOrders = 0;
  let purgedLogs = 0;
  let purgedSubmissions = 0;
  let purgedReferrals = 0;

  for (let i = transactions.length - 1; i >= 0; i--) {
    // Rule 4: NEVER delete any withdrawal record from database! Lifetime proof for admin.
    if (transactions[i].source === 'WITHDRAWAL') continue;

    if (transactions[i].timestamp < cutoff && transactions[i].status !== 'PENDING') {
      transactions.splice(i, 1);
      purgedTransactions++;
    }
  }

  for (let i = spotOrders.length - 1; i >= 0; i--) {
    if (spotOrders[i].timestamp < cutoff) {
      spotOrders.splice(i, 1);
      purgedOrders++;
    }
  }

  // Referrals are 100% permanent for life: NEVER purged or deleted
  purgedReferrals = 0;

  for (let i = auditLogs.length - 1; i >= 0; i--) {
    if (auditLogs[i].timestamp < cutoff) {
      auditLogs.splice(i, 1);
      purgedLogs++;
    }
  }

  for (let i = taskSubmissionsQueue.length - 1; i >= 0; i--) {
    if (taskSubmissionsQueue[i].timestamp < cutoff && taskSubmissionsQueue[i].status !== 'SUBMITTED') {
      taskSubmissionsQueue.splice(i, 1);
      purgedSubmissions++;
    }
  }

  return { purgedTransactions, purgedOrders, purgedLogs, purgedSubmissions, purgedReferrals };
}

// Parse balances row from Supabase
function parseSupabaseBalance(row: any): BalanceRecord {
  if (!row) {
    return { usdt: 0, e4f: 0, bnb: 0, btc: 0, eth: 0, sol: 0, ton: 0, xrp: 0, doge: 0, ada: 0, trx: 0, ltc: 0 };
  }
  const getVal = (col: string) => {
    if (row[col] !== undefined && row[col] !== null) return Number(row[col]);
    const lower = col.toLowerCase();
    if (row[lower] !== undefined && row[lower] !== null) return Number(row[lower]);
    const upper = col.toUpperCase();
    if (row[upper] !== undefined && row[upper] !== null) return Number(row[upper]);
    return 0;
  };

  return {
    usdt: getVal('USDT'),
    e4f: getVal('E4F'),
    bnb: getVal('BNB'),
    btc: getVal('BTC'),
    eth: getVal('ETH'),
    sol: getVal('SOL'),
    ton: getVal('TON'),
    xrp: getVal('XRP'),
    doge: getVal('DOGE'),
    ada: getVal('ADA'),
    trx: getVal('TRX'),
    ltc: getVal('LTC'),
  };
}

// Read balance directly from Supabase table 'balances' (with authoritative fallback to 'wallets')
async function getSupabaseBalance(userId: string): Promise<BalanceRecord> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('balances')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.warn('[Supabase] Warning fetching user balance:', userId, error.message);
      }

      if (data) {
        const parsed = parseSupabaseBalance(data);
        if (parsed.usdt > 0 || parsed.e4f > 0 || parsed.btc > 0 || parsed.eth > 0 || parsed.bnb > 0 || parsed.sol > 0) {
          balances.set(userId, parsed);
          return parsed;
        }
      }

      // If balances row didn't exist or was 0, check authoritative 'wallets' table by telegram_id
      const tgId = parseInt(userId.replace(/\D/g, ''), 10);
      if (tgId > 0) {
        const { data: walData } = await supabase
          .from('wallets')
          .select('*')
          .eq('telegram_id', tgId)
          .maybeSingle();

        if (walData) {
          const parsed = parseSupabaseBalance(walData);
          balances.set(userId, parsed);
          supabase.from('balances').upsert({
            user_id: userId,
            USDT: parsed.usdt,
            E4F: parsed.e4f,
            BNB: parsed.bnb,
            BTC: parsed.btc,
            ETH: parsed.eth,
            SOL: parsed.sol,
            TON: parsed.ton || 0,
            XRP: parsed.xrp || 0,
            DOGE: parsed.doge || 0,
            ADA: parsed.ada || 0,
            TRX: parsed.trx || 0,
            LTC: parsed.ltc || 0,
          }, { onConflict: 'user_id' }).then(() => {});
          return parsed;
        }
      }

      if (data) {
        const parsed = parseSupabaseBalance(data);
        balances.set(userId, parsed);
        return parsed;
      }
    } catch (err) {
      console.warn('[Supabase] Failed to fetch balance for user:', userId, err);
    }
  }

  let bal = balances.get(userId);
  if (!bal) {
    const welcomeUSDT = typeof systemSettings.welcomeBonusUSDT === 'number' ? systemSettings.welcomeBonusUSDT : 25.0;
    const welcomeE4F = typeof systemSettings.welcomeBonusE4F === 'number' ? systemSettings.welcomeBonusE4F : 10.0;
    bal = { usdt: welcomeUSDT, e4f: welcomeE4F, bnb: 0, btc: 0, eth: 0, sol: 0, ton: 0, xrp: 0, doge: 0, ada: 0, trx: 0, ltc: 0 };
    balances.set(userId, bal);
  }
  return bal;
}

// Write balance directly to Supabase table 'balances' and 'wallets'
async function setSupabaseBalance(userId: string, newBalance: Partial<BalanceRecord>): Promise<BalanceRecord> {
  const current = await getSupabaseBalance(userId);
  const updated: BalanceRecord = {
    usdt: newBalance.usdt !== undefined ? Number(Number(newBalance.usdt).toFixed(6)) : current.usdt,
    e4f: newBalance.e4f !== undefined ? Number(Number(newBalance.e4f).toFixed(6)) : current.e4f,
    bnb: newBalance.bnb !== undefined ? Number(Number(newBalance.bnb).toFixed(6)) : current.bnb,
    btc: newBalance.btc !== undefined ? Number(Number(newBalance.btc).toFixed(6)) : current.btc,
    eth: newBalance.eth !== undefined ? Number(Number(newBalance.eth).toFixed(6)) : current.eth,
    sol: newBalance.sol !== undefined ? Number(Number(newBalance.sol).toFixed(6)) : current.sol,
    ton: newBalance.ton !== undefined ? Number(Number(newBalance.ton).toFixed(6)) : (current.ton || 0),
    xrp: newBalance.xrp !== undefined ? Number(Number(newBalance.xrp).toFixed(6)) : (current.xrp || 0),
    doge: newBalance.doge !== undefined ? Number(Number(newBalance.doge).toFixed(6)) : (current.doge || 0),
    ada: newBalance.ada !== undefined ? Number(Number(newBalance.ada).toFixed(6)) : (current.ada || 0),
    trx: newBalance.trx !== undefined ? Number(Number(newBalance.trx).toFixed(6)) : (current.trx || 0),
    ltc: newBalance.ltc !== undefined ? Number(Number(newBalance.ltc).toFixed(6)) : (current.ltc || 0),
  };

  balances.set(userId, updated);

  if (supabase) {
    try {
      const payload = {
        user_id: userId,
        USDT: updated.usdt,
        E4F: updated.e4f,
        BNB: updated.bnb,
        BTC: updated.btc,
        ETH: updated.eth,
        SOL: updated.sol,
        TON: updated.ton || 0,
        XRP: updated.xrp || 0,
        DOGE: updated.doge || 0,
        ADA: updated.ada || 0,
        TRX: updated.trx || 0,
        LTC: updated.ltc || 0,
      };

      await supabase
        .from('balances')
        .upsert(payload, { onConflict: 'user_id' });

      if (userId.startsWith('usr_')) {
        const tgId = parseInt(userId.replace('usr_', ''), 10);
        if (!isNaN(tgId) && tgId > 0) {
          await supabase.from('wallets').upsert({
            id: `wal_${tgId}`,
            user_id: userId,
            telegram_id: tgId,
            balance: updated.usdt,
            "USDT": updated.usdt,
            "E4F": updated.e4f,
            "BNB": updated.bnb,
            "BTC": updated.btc,
            "ETH": updated.eth,
            "SOL": updated.sol,
            "TON": updated.ton || 0,
            "XRP": updated.xrp || 0,
            "DOGE": updated.doge || 0,
            "ADA": updated.ada || 0,
            "TRX": updated.trx || 0,
            "LTC": updated.ltc || 0,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'telegram_id' });
        }
      }
    } catch (err) {
      console.warn('[Supabase] Failed to persist balance for user:', userId, err);
    }
  }

  return updated;
}

// Fetch authoritative user from Supabase tables ('profiles' first, then 'users')
async function getUserFromSupabase(userId: string): Promise<UserRecord | null> {
  const tgId = parseInt(userId.replace(/\D/g, '')) || 0;

  if (supabase) {
    try {
      // 1. Check authoritative 'profiles' table first (by telegram_id and id)
      let profileData: any = null;
      if (tgId > 0) {
        const { data: pByTg } = await supabase
          .from('profiles')
          .select('*')
          .eq('telegram_id', tgId)
          .maybeSingle();
        profileData = pByTg;
      }
      if (!profileData) {
        const { data: pById } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
        profileData = pById;
      }

      // 2. Check legacy 'users' table
      let userData: any = null;
      if (!profileData) {
        if (tgId > 0) {
          const { data: uByTg } = await supabase
            .from('users')
            .select('*')
            .eq('telegram_id', tgId)
            .maybeSingle();
          userData = uByTg;
        }
        if (!userData) {
          const { data: uById } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .maybeSingle();
          userData = uById;
        }
      }

      const rec = profileData || userData;
      if (rec) {
        let permanentRefCode = rec.referral_code;

        // If referral_code is missing in one table, check the other table
        if (!permanentRefCode && profileData && tgId > 0) {
          const { data: uRec } = await supabase
            .from('users')
            .select('referral_code')
            .eq('telegram_id', tgId)
            .maybeSingle();
          if (uRec?.referral_code) permanentRefCode = uRec.referral_code;
        } else if (!permanentRefCode && userData && tgId > 0) {
          const { data: pRec } = await supabase
            .from('profiles')
            .select('referral_code')
            .eq('telegram_id', tgId)
            .maybeSingle();
          if (pRec?.referral_code) permanentRefCode = pRec.referral_code;
        }

        const effectiveTgId = Number(rec.telegram_id) || tgId;

        if (effectiveTgId === 8827675419 || tgId === 8827675419) {
          permanentRefCode = 'E4F786112';
          if (supabase) {
            supabase.from('profiles').update({ referral_code: 'E4F786112' }).eq('telegram_id', 8827675419).then(() => {});
            supabase.from('users').update({ referral_code: 'E4F786112' }).eq('telegram_id', 8827675419).then(() => {});
          }
        } else if (!permanentRefCode) {
          // Only if completely missing in database, generate once and persist forever!
          permanentRefCode = generateUniqueReferralCode(effectiveTgId);
          if (tgId > 0) {
            supabase.from('profiles').update({ referral_code: permanentRefCode }).eq('telegram_id', tgId).then(() => {});
            supabase.from('users').update({ referral_code: permanentRefCode }).eq('telegram_id', tgId).then(() => {});
          } else {
            supabase.from('users').update({ referral_code: permanentRefCode }).eq('id', userId).then(() => {});
          }
        }
        const u: UserRecord = {
          id: rec.id || (effectiveTgId > 0 ? `usr_${effectiveTgId}` : userId),
          uid: rec.uid || `8${Math.abs(effectiveTgId % 8999999 + 1000000)}`,
          telegramId: effectiveTgId,
          firstName: rec.first_name || 'E4F User',
          lastName: rec.last_name || '',
          username: rec.username || 'user',
          photoUrl: rec.photo_url || '',
          referralCode: permanentRefCode,
          referredBy: rec.referred_by || undefined,
          createdAt: rec.created_at ? new Date(rec.created_at).getTime() : Date.now(),
          status: rec.status || 'ACTIVE',
          claimedWelcomeBonus: Boolean(rec.claimed_welcome_bonus),
          isDemoUser: false,
          isVerified: Boolean(rec.is_verified),
          depositBalance: Number(rec.deposit_balance) || 0,
          depositAddress: rec.deposit_address || generateUserDepositAddress(userId, rec.uid || '81234567'),
        };
        users.set(u.id, u);
        return u;
      }
    } catch (err) {
      console.warn('[Supabase] Failed to fetch user from Supabase:', err);
    }
  }

  let existing = users.get(userId);
  if (!existing && tgId > 0) {
    existing = users.get(`usr_${tgId}`);
  }
  return existing || null;
}

// Persist user to Supabase table 'users'
async function syncUserToSupabase(u: UserRecord) {
  // 1. Lock permanent referral code for telegram_id 8827675419
  if (u.telegramId === 8827675419 || String(u.telegramId) === '8827675419') {
    u.referralCode = 'E4F786112';
  }

  // 2. Check Supabase users table with telegram_id first to never overwrite existing referral_code
  if (supabase && u.telegramId) {
    try {
      const { data: existingUser } = await supabase
        .from('users')
        .select('referral_code, referred_by')
        .eq('telegram_id', u.telegramId)
        .maybeSingle();

      if (existingUser?.referral_code) {
        u.referralCode = (u.telegramId === 8827675419) ? 'E4F786112' : existingUser.referral_code;
      }
      if (existingUser?.referred_by && !u.referredBy) {
        u.referredBy = existingUser.referred_by;
      }
    } catch {}
  }

  users.set(u.id, u);
  if (supabase) {
    try {
      await supabase.from('users').upsert({
        id: u.id,
        uid: u.uid,
        telegram_id: u.telegramId,
        first_name: u.firstName,
        last_name: u.lastName || '',
        username: u.username || '',
        photo_url: u.photoUrl || '',
        referral_code: u.referralCode,
        referred_by: u.referredBy || null,
        status: u.status || 'ACTIVE',
        claimed_welcome_bonus: u.claimedWelcomeBonus,
        is_verified: u.isVerified,
        deposit_balance: u.depositBalance || 0,
        deposit_address: u.depositAddress || '',
      });

      if (u.telegramId) {
        await supabase.from('profiles').upsert({
          telegram_id: u.telegramId,
          id: u.id,
          uid: u.uid,
          first_name: u.firstName,
          last_name: u.lastName || '',
          username: u.username || '',
          photo_url: u.photoUrl || '',
          referral_code: u.referralCode,
          referred_by: u.referredBy || null,
          status: u.status || 'ACTIVE',
          claimed_welcome_bonus: u.claimedWelcomeBonus,
          is_verified: u.isVerified,
        }, { onConflict: 'telegram_id' });
      }
    } catch (err) {
      console.warn('[Supabase] Failed to upsert user to Supabase:', err);
    }
  }
}

// Persist transaction to Supabase table 'transactions'
async function recordTransaction(tx: TxRecord) {
  transactions.unshift(tx);
  if (supabase) {
    try {
      await supabase.from('transactions').insert([{
        id: tx.id,
        user_id: tx.userId,
        asset: tx.asset,
        amount: tx.amount,
        direction: tx.direction,
        source: tx.source,
        status: tx.status || 'COMPLETED',
        timestamp: tx.timestamp,
        reference_id: tx.referenceId || '',
        note: tx.note || '',
        address: tx.address || '',
        network: tx.network || '',
        fee: tx.fee || 0,
      }]);
    } catch (err) {
      console.warn('[Supabase] Failed to insert transaction to Supabase:', err);
    }
  }
}

const DB_FILE = fs.existsSync('/tmp') ? path.join('/tmp', 'e4f_db.json') : path.join(process.cwd(), 'e4f_db.json');

// Real Production Persistence: Permanently saves users, balances, withdrawals, and referrals
function persistDatabaseSync() {
  try {
    const data = {
      users: Array.from(users.entries()),
      balances: Array.from(balances.entries()),
      transactions,
      referralHistory,
      miningSessions,
      userGiftBoxes: Array.from(userGiftBoxes.entries()),
      userDailyCheckIns: Array.from(userDailyCheckIns.entries()),
      spotOrders,
      auditLogs,
      timestamp: Date.now(),
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(data), 'utf-8');
    isDbDirty = false;
  } catch {
    // Keep in-memory if disk is unwritable
  }
}

function scheduleSaveDatabase() {
  isDbDirty = true;
  persistDatabaseSync();
}

// Initial state setup: Restores all real accounts, permanent referrals, balances, and withdrawals
function initializeServerState() {
  console.log('[Supabase] Supabase persistence engine initialized.');
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (Array.isArray(data.users)) {
        for (const [k, v] of data.users) users.set(k, v);
      }
      if (Array.isArray(data.balances)) {
        for (const [k, v] of data.balances) balances.set(k, v);
      }
      if (Array.isArray(data.transactions)) {
        transactions.length = 0;
        transactions.push(...data.transactions);
      }
      if (Array.isArray(data.referralHistory)) {
        referralHistory.length = 0;
        referralHistory.push(...data.referralHistory);
      }
      if (Array.isArray(data.miningSessions)) {
        miningSessions.length = 0;
        miningSessions.push(...data.miningSessions);
      }
      if (Array.isArray(data.userGiftBoxes)) {
        for (const [k, v] of data.userGiftBoxes) userGiftBoxes.set(k, v);
      }
      if (Array.isArray(data.userDailyCheckIns)) {
        for (const [k, v] of data.userDailyCheckIns) userDailyCheckIns.set(k, v);
      }
      if (Array.isArray(data.spotOrders)) {
        spotOrders.length = 0;
        spotOrders.push(...data.spotOrders);
      }
      if (Array.isArray(data.auditLogs)) {
        auditLogs.length = 0;
        auditLogs.push(...data.auditLogs);
      }
    }
  } catch (err) {
    console.warn('[Persistence] Could not load persisted db file:', err);
  }

  // Load system settings from Supabase if connected
  if (supabase) {
    (async () => {
      try {
        const { data } = await supabase
          .from('system_settings')
          .select('*')
          .eq('id', 'global_settings')
          .maybeSingle();
        if (data && data.settings && typeof data.settings === 'object') {
          Object.assign(systemSettings, data.settings);
        }

        const TARGET_REAL_IDS: Record<string, string> = {
          spin_01_richads: '410203',
          spin_02_monetag: '12044377',
          spin_03_onclicka: '6153717',
          spin_04_richads: '410203',
          spin_05_monetag: '12044377',
          box_01_richads: '410202',
          box_02_monetag: '12044377',
          box_03_onclicka: '6153772',
          box_04_richads: '410202',
          box_05_monetag: '12044377',
          mining_01_richads: '410204',
          mining_02_monetag: '12044377',
          mining_03_onclicka: '6153774',
          mining_04_richads: '410204',
          mining_05_monetag: '12044377',
        };
        if (systemSettings.spin_03_onclicka === '6153717') systemSettings.spin_03_onclicka = '6153717';
        if (systemSettings.box_03_onclicka === '6153772') systemSettings.box_03_onclicka = '6153772';
        if (systemSettings.mining_03_onclicka === '6153774') systemSettings.mining_03_onclicka = '6153774';
        // Clean out old deprecated ad networks
        delete (systemSettings as any).spin_01_adsgram;
        delete (systemSettings as any).spin_05_adexora;
        delete (systemSettings as any).box_01_adsgram;
        delete (systemSettings as any).box_05_adexora;
        delete (systemSettings as any).mining_01_adsgram;
        delete (systemSettings as any).mining_05_adexora;
        normalizeAdSlotSettings();

        const OLD_PLACEHOLDERS = new Set(['54110', '54111', '410260']);
        let needsDbSync = false;
        for (const [key, targetVal] of Object.entries(TARGET_REAL_IDS)) {
          const cur = String((systemSettings as any)[key] || '').trim();
          if (!cur || OLD_PLACEHOLDERS.has(cur)) {
            (systemSettings as any)[key] = targetVal;
            needsDbSync = true;
          }
        }

        if (needsDbSync) {
          (supabase.from('system_settings').upsert({
            id: 'global_settings',
            settings: systemSettings,
            updated_at: new Date().toISOString(),
          }) as PromiseLike<any>).then(() => {}, () => {});
        }
        console.log('[Supabase] Loaded & verified system settings with active IDs.');

        const { data: rewardData } = await supabase
          .from('e4f_daily_rewards_config')
          .select('*')
          .eq('is_active', true)
          .order('day_number', { ascending: true });

        if (Array.isArray(rewardData) && rewardData.length > 0) {
          systemSettings.dailyCheckInRewards = rewardData.map(r => ({
            day: r.day_number,
            amount: Number(r.reward_amount),
            asset: (r.reward_type === 'USDT' ? 'USDT' : 'E4F') as 'E4F' | 'USDT',
          }));
          console.log('[Supabase] Loaded custom 7-day daily check-in rewards config.');
        }
      } catch (err: any) {
        console.warn('[Supabase] Failed to load system settings / daily rewards config:', err);
      }
    })();
  }

  // Apply welcome bonus if enabled (applied at most once per eligible account)
  if (systemSettings.welcomeBonusEnabled !== false) {
    for (const [userId, userObj] of users.entries()) {
      if (!userObj.claimedWelcomeBonus) {
        creditWelcomeBonus(userId);
      }
    }
  }

  apply90DayRetentionPolicy();
}

initializeServerState();

// Periodic backup sync (only when data has changed) & 90-day retention policy execution
const backupTimer = setInterval(() => {
  if (isDbDirty) {
    persistDatabaseSync();
  }
}, 5000);
backupTimer.unref?.();

const retentionTimer = setInterval(() => {
  apply90DayRetentionPolicy();
}, 24 * 60 * 60 * 1000); // Daily retention check
retentionTimer.unref?.();

// Process exit hooks: Ensure database is synchronously flushed to disk on shutdown/restart
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received. Flushing database synchronously...');
  persistDatabaseSync();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[Server] SIGINT received. Flushing database synchronously...');
  persistDatabaseSync();
  process.exit(0);
});

process.on('beforeExit', () => {
  persistDatabaseSync();
});

// Helper to generate a unique referral code: 'E4F' + 6 random digits (100000-999999)
// For telegramId 8827675419, permanent code is strictly E4F786112
function generateUniqueReferralCode(telegramId?: number): string {
  if (telegramId === 8827675419 || String(telegramId) === '8827675419') {
    return 'E4F786112';
  }
  for (let i = 0; i < 50; i++) {
    const randomDigits = Math.floor(100000 + Math.random() * 900000).toString();
    const candidate = `E4F${randomDigits}`;
    let exists = false;
    for (const u of users.values()) {
      if (u.referralCode && u.referralCode.toUpperCase() === candidate) {
        exists = true;
        break;
      }
    }
    if (!exists) return candidate;
  }
  return `E4F${Math.floor(100000 + Math.random() * 900000)}`;
}

function getOrCreateUser(telegramId: number, firstName: string, lastName = '', username = '', isDemo = false, referredByCode?: string, existingBalances?: BalanceRecord): UserRecord {
  const userId = `usr_${telegramId}`;
  let user = users.get(userId);

  if (user) {
    if (telegramId === 8827675419 || String(telegramId) === '8827675419') {
      user.referralCode = 'E4F786112';
    }
    return user;
  }

  const rawUidNumber = Math.abs(telegramId % 8999999 + 1000000);
  const uid = `8${rawUidNumber}`;
  const cleanFirstName = (!firstName || firstName === 'Telegram User') ? 'E4F User' : firstName;

  let referredByUserId: string | undefined;
  if (referredByCode && typeof referredByCode === 'string') {
    const trimmedRef = referredByCode.trim().toUpperCase();
    if (trimmedRef.startsWith('USR_')) {
      referredByUserId = referredByCode.trim();
    } else {
      for (const [existingId, existingUser] of users.entries()) {
        if (existingUser.referralCode && existingUser.referralCode.toUpperCase() === trimmedRef) {
          referredByUserId = existingId;
          break;
        }
      }
    }
  }

  const permanentRefCode = (telegramId === 8827675419 || String(telegramId) === '8827675419')
    ? 'E4F786112'
    : generateUniqueReferralCode(telegramId);

  user = {
    id: userId,
    uid,
    telegramId,
    firstName: cleanFirstName,
    lastName,
    username: username || 'user_123',
    referralCode: permanentRefCode,
    referredBy: referredByUserId,
    createdAt: Date.now(),
    status: 'ACTIVE',
    claimedWelcomeBonus: false,
    isDemoUser: isDemo,
    isVerified: false,
    depositBalance: 0,
    depositAddress: generateUserDepositAddress(userId, uid),
  };
  users.set(userId, user);

  return user;
}

// Asynchronous authoritative user getter that checks Supabase users table with telegram_id FIRST!
// If user exists, RETURNS existing referral_code, DOES NOT generate new!
// For telegram_id 8827675419, permanent code is strictly E4F786112.
async function getOrCreateUserAsync(
  telegramId: number,
  firstName: string,
  lastName = '',
  username = '',
  isDemo = false,
  referredByCode?: string,
  existingBalances?: BalanceRecord
): Promise<UserRecord> {
  const userId = `usr_${telegramId}`;
  let user = users.get(userId);

  if (user) {
    if (telegramId === 8827675419 || String(telegramId) === '8827675419') {
      user.referralCode = 'E4F786112';
    }
    return user;
  }

  // 1. Check Supabase users table with telegram_id first!
  if (supabase && telegramId > 0) {
    try {
      const dbUser = await getUserFromSupabase(userId);
      if (dbUser) {
        if (telegramId === 8827675419 || String(telegramId) === '8827675419') {
          dbUser.referralCode = 'E4F786112';
        }
        users.set(userId, dbUser);
        return dbUser;
      }
    } catch (err: any) {
      console.warn('[Supabase Check Existing User Error]:', err.message);
    }
  }

  // 2. Not in Supabase or memory - create genuine new user with single-time generated referral code
  const rawUidNumber = Math.abs(telegramId % 8999999 + 1000000);
  const uid = `8${rawUidNumber}`;
  const cleanFirstName = (!firstName || firstName === 'Telegram User') ? 'E4F User' : firstName;

  let referredByUserId: string | undefined;
  if (referredByCode && typeof referredByCode === 'string') {
    const trimmedRef = referredByCode.trim().toUpperCase();
    if (trimmedRef.startsWith('USR_')) {
      referredByUserId = referredByCode.trim();
    } else {
      for (const [existingId, existingUser] of users.entries()) {
        if (existingUser.referralCode && existingUser.referralCode.toUpperCase() === trimmedRef) {
          referredByUserId = existingId;
          break;
        }
      }
    }
  }

  const permanentRefCode = (telegramId === 8827675419 || String(telegramId) === '8827675419')
    ? 'E4F786112'
    : generateUniqueReferralCode(telegramId);

  user = {
    id: userId,
    uid,
    telegramId,
    firstName: cleanFirstName,
    lastName,
    username: username || 'user_123',
    referralCode: permanentRefCode,
    referredBy: referredByUserId,
    createdAt: Date.now(),
    status: 'ACTIVE',
    claimedWelcomeBonus: false,
    isDemoUser: isDemo,
    isVerified: false,
    depositBalance: 0,
    depositAddress: generateUserDepositAddress(userId, uid),
  };
  users.set(userId, user);

  if (referredByUserId && !referralHistory.some(r => r.referredUserId === userId)) {
    referralHistory.push({
      id: `ref_${Date.now()}_${userId}`,
      referrerId: referredByUserId,
      referredUserId: userId,
      referredUid: uid,
      referredName: cleanFirstName,
      timestamp: Date.now(),
      status: 'ACTIVE',
      minedDays: 0,
      rewardEarned: 0,
    });
  }

  if (existingBalances && (Number(existingBalances.usdt) > 0 || Number(existingBalances.e4f) > 0 || Number(existingBalances.btc) > 0 || Number(existingBalances.eth) > 0)) {
    balances.set(userId, {
      usdt: Number(existingBalances.usdt) || 0,
      e4f: Number(existingBalances.e4f) || 0,
      btc: Number(existingBalances.btc) || 0,
      eth: Number(existingBalances.eth) || 0,
      sol: Number(existingBalances.sol) || 0,
      bnb: Number(existingBalances.bnb) || 0,
    });
    user.claimedWelcomeBonus = true;
  } else {
    // Initial zero balances - strictly 0 for all assets (BTC, ETH, SOL, BNB, USDT, E4F)
    balances.set(userId, {
      usdt: 0,
      e4f: 0,
      btc: 0,
      eth: 0,
      sol: 0,
      bnb: 0,
    });

    // Award Welcome Bonus to eligible new users (applied at most once per account)
    if (systemSettings.welcomeBonusEnabled !== false && !user.claimedWelcomeBonus) {
      creditWelcomeBonus(userId);
    }
  }

  // Initialize 5 Gift Boxes
  userGiftBoxes.set(userId, [
    { id: 1, boxNumber: 1, name: 'Bronze Treasure', rewardAsset: 'E4F', rewardAmount: 2.5, color: '#38BDF8', isOpened: false },
    { id: 2, boxNumber: 2, name: 'Silver Cache', rewardAsset: 'USDT', rewardAmount: 1.5, color: '#A855F7', isOpened: false },
    { id: 3, boxNumber: 3, name: 'Gold Vault', rewardAsset: 'E4F', rewardAmount: 5.0, color: '#EAB308', isOpened: false },
    { id: 4, boxNumber: 4, name: 'Ruby Chest', rewardAsset: 'USDT', rewardAmount: 3.0, color: '#EF4444', isOpened: false },
    { id: 5, boxNumber: 5, name: 'Diamond Relic', rewardAsset: 'E4F', rewardAmount: 10.0, color: '#10B981', isOpened: false },
  ]);

  // Initialize daily check-in (never wipe existing streak or claim state)
  if (!userDailyCheckIns.has(userId)) {
    loadUserDailyCheckIn(userId).catch(() => {});
  }

  // Persist newly created user to Supabase and memory
  syncUserToSupabase(user).catch(() => {});
  setSupabaseBalance(userId, balances.get(userId)!).catch(() => {});
  persistDatabaseSync();

  return user;
}

// Calculate custom referral mining boost percentage based on admin settings
function calculateMiningBoost(referralCount: number): number {
  const tiers = systemSettings.referralMiningBoostTiers as any[];
  if (!Array.isArray(tiers) || tiers.length === 0) {
    return 0;
  }
  // Sort descending by minReferrals
  const sorted = [...tiers].sort((a: any, b: any) => b.minReferrals - a.minReferrals);
  for (const tier of sorted) {
    if (referralCount >= tier.minReferrals) {
      return (tier.boostPercent !== undefined ? tier.boostPercent : tier.boostPercentage) || 0;
    }
  }
  return 0;
}

function creditWelcomeBonus(userId: string) {
  const user = users.get(userId);
  const userBalance = balances.get(userId);
  if (!user || !userBalance) return;
  if (systemSettings.welcomeBonusEnabled === false) return;
  if (user.claimedWelcomeBonus) return;

  const bonusUSDT = Number(systemSettings.welcomeBonusUSDT !== undefined ? systemSettings.welcomeBonusUSDT : 25);
  const bonusE4F = Number(systemSettings.welcomeBonusE4F !== undefined ? systemSettings.welcomeBonusE4F : 10);

  const hasWelcomeTx = transactions.some(
    t => t.userId === userId && (t.source === 'WELCOME_BONUS_PROMO' || t.source === 'WELCOME_BONUS_USDT' || t.source === 'WELCOME_BONUS_E4F')
  );
  if (hasWelcomeTx) {
    user.claimedWelcomeBonus = true;
    return;
  }

  // 1. Credit Admin-configured USDT Welcome Bonus (Promotional credit)
  if (bonusUSDT > 0) {
    userBalance.usdt = Number((userBalance.usdt + bonusUSDT).toFixed(4));
    recordTransaction({
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId,
      asset: 'USDT',
      amount: bonusUSDT,
      direction: 'IN',
      source: 'WELCOME_BONUS_PROMO',
      status: 'COMPLETED',
      timestamp: Date.now(),
      note: 'Promotional Welcome Credit (Non-Withdrawable until qualification)',
    });
  }

  // 2. Credit Admin-configured E4F Welcome Bonus
  if (bonusE4F > 0) {
    userBalance.e4f = Number((userBalance.e4f + bonusE4F).toFixed(4));
    recordTransaction({
      id: `tx_${Date.now() + 1}_${Math.random().toString(36).substring(2, 7)}`,
      userId,
      asset: 'E4F',
      amount: bonusE4F,
      direction: 'IN',
      source: 'WELCOME_BONUS_E4F',
      status: 'COMPLETED',
      timestamp: Date.now(),
      note: 'Pre-Listing E4F Welcome Allocation',
    });
  }

  // Ensure non-bonus assets default safely
  if (userBalance.btc === undefined) userBalance.btc = 0;
  if (userBalance.eth === undefined) userBalance.eth = 0;
  if (userBalance.sol === undefined) userBalance.sol = 0;
  if (userBalance.bnb === undefined) userBalance.bnb = 0;

  user.claimedWelcomeBonus = true;

  auditLogs.unshift({
    id: `audit_${Date.now()}`,
    adminId: 'SYSTEM',
    action: 'WELCOME_BONUS_GRANTED',
    target: userId,
    details: `Granted promotional welcome bonus: ${bonusUSDT} USDT + ${bonusE4F} E4F`,
    timestamp: Date.now(),
  });

  syncUserToSupabase(user).catch(() => {});
  setSupabaseBalance(userId, userBalance).catch(() => {});
  persistDatabaseSync();
}

// ----------------------------------------------------
// Market Price Cache with Live Fallback
// ----------------------------------------------------
interface PriceTicker {
  symbol: string;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  lastUpdated: number;
}

const marketCache: Record<string, PriceTicker> = {
  'BTC/USDT': { symbol: 'BTC/USDT', price: 81650.00, change24h: -2.26, high24h: 84150.00, low24h: 81500.00, volume24h: 16768.2, lastUpdated: Date.now() },
  'ETH/USDT': { symbol: 'ETH/USDT', price: 2430.50, change24h: -3.57, high24h: 2530.00, low24h: 2410.00, volume24h: 245745.9, lastUpdated: Date.now() },
  'SOL/USDT': { symbol: 'SOL/USDT', price: 103.80, change24h: -3.63, high24h: 108.60, low24h: 103.50, volume24h: 2137943.0, lastUpdated: Date.now() },
  'BNB/USDT': { symbol: 'BNB/USDT', price: 729.30, change24h: -2.15, high24h: 747.00, low24h: 728.50, volume24h: 72959.8, lastUpdated: Date.now() },
  'XRP/USDT': { symbol: 'XRP/USDT', price: 1.3270, change24h: -3.41, high24h: 1.3860, low24h: 1.3260, volume24h: 120404137.0, lastUpdated: Date.now() },
  'DOGE/USDT': { symbol: 'DOGE/USDT', price: 0.0820, change24h: -2.85, high24h: 0.0856, low24h: 0.0818, volume24h: 547276990.0, lastUpdated: Date.now() },
  'TON/USDT': { symbol: 'TON/USDT', price: 1.6000, change24h: 0.95, high24h: 1.6410, low24h: 1.5800, volume24h: 4800378.0, lastUpdated: Date.now() },
  'ADA/USDT': { symbol: 'ADA/USDT', price: 0.2267, change24h: -3.28, high24h: 0.2391, low24h: 0.2266, volume24h: 93258506.0, lastUpdated: Date.now() },
  'TRX/USDT': { symbol: 'TRX/USDT', price: 0.3332, change24h: 1.68, high24h: 0.3342, low24h: 0.3272, volume24h: 157926040.0, lastUpdated: Date.now() },
  'LTC/USDT': { symbol: 'LTC/USDT', price: 59.01, change24h: -3.48, high24h: 62.45, low24h: 58.70, volume24h: 333873.0, lastUpdated: Date.now() },
};

// Try fetching fresh prices from Binance API periodically
async function refreshMarketPrices() {
  try {
    const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'TONUSDT', 'ADAUSDT', 'TRXUSDT', 'LTCUSDT'];
    const query = encodeURIComponent(JSON.stringify(symbols));
    const urls = [
      `https://api.binance.com/api/v3/ticker/24hr?symbols=${query}`,
      `https://data-api.binance.vision/api/v3/ticker/24hr?symbols=${query}`,
    ];

    let fetchedData: any[] | null = null;
    for (const url of urls) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
        if (res.ok) {
          fetchedData = await res.json();
          if (Array.isArray(fetchedData) && fetchedData.length > 0) break;
        }
      } catch {}
    }

    if (Array.isArray(fetchedData)) {
      for (const item of fetchedData) {
        if (symbols.includes(item.symbol)) {
          const pair = item.symbol.replace('USDT', '/USDT');
          marketCache[pair] = {
            symbol: pair,
            price: parseFloat(item.lastPrice),
            change24h: parseFloat(item.priceChangePercent),
            high24h: parseFloat(item.highPrice),
            low24h: parseFloat(item.lowPrice),
            volume24h: parseFloat(item.volume),
            lastUpdated: Date.now(),
          };
        }
      }
    }
  } catch {
    // Graceful fallback to cached tickers
  }
}
const marketTimer = setInterval(refreshMarketPrices, 15000);
marketTimer.unref?.();
refreshMarketPrices();

// ====================================================
// REST API ROUTES
// ====================================================

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'E4F Web3 Exchange', serverTime: Date.now() });
});

// 1. Authentication (/api/auth)
app.post('/api/auth/telegram', async (req: Request, res: Response) => {
  const { initData, demoUser, storedUserId, referralCode, cachedBalances } = req.body;

  // If client provided a storedUserId with valid session token, restore existing authenticated account
  if (storedUserId && typeof storedUserId === 'string') {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : ((req.headers['x-session-token'] as string) || (req.body.token as string) || '').trim();

    if (token) {
      const verified = verifyUserSessionToken(token);
      if (verified.valid && verified.userId === storedUserId) {
        let existingUser = await getUserFromSupabase(storedUserId);
        if (!existingUser) {
          const rawNum = parseInt(storedUserId.replace('usr_', '')) || 123456789;
          existingUser = await getOrCreateUserAsync(rawNum, 'E4F User', '', 'user', false, referralCode, cachedBalances);
        }
        if (existingUser) {
          const userBalances = await getSupabaseBalance(existingUser.id);
          return res.json({
            success: true,
            user: existingUser,
            balances: userBalances,
            token,
            serverTime: Date.now(),
          });
        }
      }
    }
  }

  let tgUser: { id: number; first_name: string; last_name?: string; username?: string } | null = null;
  let parsedReferral = (referralCode || req.body?.start_param || req.body?.startapp || '').toString().trim();

  // Cryptographic verification of Telegram initData is MANDATORY.
  // Without a valid signature there is no login: no demo user, no guest user, no "trust the payload".
  const devLoginAllowed = !isProduction && !TELEGRAM_BOT_TOKEN; // local development only
  if (initData && typeof initData === 'string' && initData.trim().length > 0 && TELEGRAM_BOT_TOKEN) {
    const verifiedTg = verifyTelegramInitData(initData, TELEGRAM_BOT_TOKEN);
    if (!verifiedTg.valid || !verifiedTg.user || !verifiedTg.user.id) {
      console.warn('[Telegram Auth] Rejected login:', verifiedTg.error);
      return res.status(401).json({ success: false, error: 'Telegram authentication failed. Please reopen the app from Telegram.' });
    }
    tgUser = verifiedTg.user;
    try {
      const urlParams = new URLSearchParams(initData);
      const startParam = urlParams.get('start_param') || urlParams.get('startapp') || urlParams.get('tgWebAppStartParam') || urlParams.get('start') || urlParams.get('ref');
      if (startParam && !parsedReferral) parsedReferral = startParam.trim();
    } catch {}
  } else if (devLoginAllowed) {
    try {
      const urlParams = new URLSearchParams(String(initData || ''));
      const userParam = urlParams.get('user');
      if (userParam) tgUser = JSON.parse(userParam);
    } catch {}
    if (!tgUser && demoUser && demoUser.id) {
      tgUser = { id: Number(demoUser.id), first_name: demoUser.first_name || 'E4F User', last_name: demoUser.last_name || '', username: demoUser.username || 'user' };
    }
    if (!tgUser) tgUser = { id: 123456789, first_name: 'E4F Dev', username: 'dev_user' };
  } else if (!TELEGRAM_BOT_TOKEN) {
    console.error('[SECURITY] TELEGRAM_BOT_TOKEN is not configured on the server; logins are refused.');
    return res.status(503).json({ success: false, error: 'Server is not configured yet. Please try again later.' });
  } else {
    return res.status(401).json({ success: false, error: 'Please open this app from Telegram to sign in.' });
  }

  // 1. AUTH LOGIC - telegram_id is IMMUTABLE PRIMARY KEY:
  // Check Supabase users, profiles, and wallets table with telegram_id FIRST
  if (supabase && tgUser) {
    const tgId = Number(tgUser.id);
    const fixedUserId = `usr_${tgId}`;

    try {
      const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .eq('telegram_id', tgId)
        .maybeSingle();

      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('telegram_id', tgId)
        .maybeSingle();

      const { data: existingWallet } = await supabase
        .from('wallets')
        .select('*')
        .eq('telegram_id', tgId)
        .maybeSingle();

      if (existingUser || existingProfile || existingWallet) {
        // User already exists! DO NOT overwrite referral_code, DO NOT create new wallet, return old account as-is!
        const rec = existingUser || existingProfile;
        let permanentRefCode = (tgId === 8827675419)
          ? 'E4F786112'
          : (existingUser?.referral_code || existingProfile?.referral_code);

        if (tgId === 8827675419) {
          permanentRefCode = 'E4F786112';
          supabase.from('users').update({ referral_code: 'E4F786112' }).eq('telegram_id', 8827675419).then(() => {});
          supabase.from('profiles').update({ referral_code: 'E4F786112' }).eq('telegram_id', 8827675419).then(() => {});
        } else if (!permanentRefCode) {
          permanentRefCode = generateUniqueReferralCode(tgId);
          supabase.from('users').update({ referral_code: permanentRefCode }).eq('telegram_id', tgId).then(() => {});
          supabase.from('profiles').update({ referral_code: permanentRefCode }).eq('telegram_id', tgId).then(() => {});
        }

        const restoredUser: UserRecord = {
          id: fixedUserId,
          uid: rec?.uid || `8${Math.abs((tgId % 8999999) + 1000000)}`,
          telegramId: tgId,
          firstName: rec?.first_name || tgUser.first_name || 'E4F User',
          lastName: rec?.last_name || tgUser.last_name || '',
          username: rec?.username || tgUser.username || 'user',
          photoUrl: rec?.photo_url || (tgUser as any).photo_url || '',
          referralCode: permanentRefCode,
          referredBy: rec?.referred_by || undefined,
          createdAt: rec?.created_at ? new Date(rec.created_at).getTime() : Date.now(),
          status: rec?.status || 'ACTIVE',
          claimedWelcomeBonus: Boolean(rec?.claimed_welcome_bonus),
          isDemoUser: false,
          isVerified: Boolean(rec?.is_verified),
          depositBalance: Number(rec?.deposit_balance) || 0,
          depositAddress: rec?.deposit_address || generateUserDepositAddress(fixedUserId, rec?.uid || '81234567'),
        };

        // Fetch balances directly from existing wallet or balances table
        let userBalances: BalanceRecord;
        if (existingWallet) {
          userBalances = {
            usdt: Number(existingWallet.USDT !== undefined ? existingWallet.USDT : existingWallet.balance) || 0,
            e4f: Number(existingWallet.E4F) || 0,
            bnb: Number(existingWallet.BNB) || 0,
            btc: Number(existingWallet.BTC) || 0,
            eth: Number(existingWallet.ETH) || 0,
            sol: Number(existingWallet.SOL) || 0,
            ton: Number(existingWallet.TON) || 0,
            xrp: Number(existingWallet.XRP) || 0,
            doge: Number(existingWallet.DOGE) || 0,
            ada: Number(existingWallet.ADA) || 0,
            trx: Number(existingWallet.TRX) || 0,
            ltc: Number(existingWallet.LTC) || 0,
          };
          setSupabaseBalance(fixedUserId, userBalances).catch(() => {});
        } else {
          userBalances = await getSupabaseBalance(fixedUserId);
        }

        users.set(fixedUserId, restoredUser);
        balances.set(fixedUserId, userBalances);
        const sessionToken = generateUserSessionToken(fixedUserId);

        return res.json({
          success: true,
          user: restoredUser,
          balances: userBalances,
          token: sessionToken,
          serverTime: Date.now(),
        });
      }
    } catch (checkErr: any) {
      console.warn('[Supabase Auth Check existing user warning]:', checkErr.message);
    }
  }

  // 2. Truly new user registration via get_or_restore_user RPC or getOrCreateUserAsync
  if (supabase && tgUser) {
    try {

      const { data: rpcData, error: rpcError } = await supabase.rpc('get_or_restore_user', {
        p_telegram_id: tgUser.id,
        p_first_name: tgUser.first_name || 'E4F User',
        p_last_name: tgUser.last_name || '',
        p_username: tgUser.username || '',
        p_photo_url: (tgUser as any).photo_url || '',
        p_referral_code: parsedReferral || null,
        p_device_hash: req.body.deviceHash || req.body.device_hash || null,
      });

      if (rpcError) {
        console.warn('[Supabase RPC Warning] get_or_restore_user RPC call returned:', rpcError.message);
        // If RPC is missing or failed, fall back to direct Supabase tables (profiles / wallets) without losing balances!
        try {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('telegram_id', tgUser.id)
            .maybeSingle();

          const { data: walletData } = await supabase
            .from('wallets')
            .select('*')
            .eq('telegram_id', tgUser.id)
            .maybeSingle();

          if (profileData) {
            let refCode = (tgUser.id === 8827675419) ? 'E4F786112' : profileData.referral_code;
            if (!refCode) {
              refCode = generateUniqueReferralCode(tgUser.id);
              if (supabase) {
                supabase.from('profiles').update({ referral_code: refCode }).eq('telegram_id', tgUser.id).then(() => {});
                supabase.from('users').update({ referral_code: refCode }).eq('telegram_id', tgUser.id).then(() => {});
              }
            }

            const fallbackU: UserRecord = {
              id: profileData.id || `usr_${tgUser.id}`,
              uid: profileData.uid || `8${Math.abs(tgUser.id % 8999999 + 1000000)}`,
              telegramId: tgUser.id,
              firstName: profileData.first_name || tgUser.first_name || 'E4F User',
              lastName: profileData.last_name || tgUser.last_name || '',
              username: profileData.username || tgUser.username || '',
              photoUrl: profileData.photo_url || (tgUser as any).photo_url || '',
              referralCode: refCode,
              referredBy: profileData.referred_by || undefined,
              createdAt: profileData.created_at ? new Date(profileData.created_at).getTime() : Date.now(),
              status: profileData.status || 'ACTIVE',
              claimedWelcomeBonus: Boolean(profileData.claimed_welcome_bonus),
              isDemoUser: false,
              isVerified: Boolean(profileData.is_verified),
              depositBalance: 0,
              depositAddress: generateUserDepositAddress(`usr_${tgUser.id}`, profileData.uid || '81234567'),
            };

            const fallbackB: BalanceRecord = walletData ? {
              usdt: Number(walletData.USDT !== undefined ? walletData.USDT : walletData.balance) || 0,
              e4f: Number(walletData.E4F) || 0,
              bnb: Number(walletData.BNB) || 0,
              btc: Number(walletData.BTC) || 0,
              eth: Number(walletData.ETH) || 0,
              sol: Number(walletData.SOL) || 0,
              ton: Number(walletData.TON) || 0,
              xrp: Number(walletData.XRP) || 0,
              doge: Number(walletData.DOGE) || 0,
              ada: Number(walletData.ADA) || 0,
              trx: Number(walletData.TRX) || 0,
              ltc: Number(walletData.LTC) || 0,
            } : await getSupabaseBalance(fallbackU.id);

            users.set(fallbackU.id, fallbackU);
            balances.set(fallbackU.id, fallbackB);
            const sessionToken = generateUserSessionToken(fallbackU.id);

            return res.json({
              success: true,
              user: fallbackU,
              balances: fallbackB,
              token: sessionToken,
              serverTime: Date.now(),
            });
          }
        } catch (tableErr) {
          console.warn('[Supabase Fallback Warning] Direct table query warning:', tableErr);
        }

        if (isProduction && !supabase) {
          return res.status(500).json({
            success: false,
            error: `Database authentication failed: ${rpcError.message}`,
          });
        }
      } else if (rpcData && rpcData.success && rpcData.user) {
        const u = rpcData.user;
        const b = rpcData.balances;
        if (tgUser.id === 8827675419 || u.telegramId === 8827675419) {
          u.referralCode = 'E4F786112';
        }
        users.set(u.id, u);
        balances.set(u.id, b);
        const sessionToken = generateUserSessionToken(u.id);

        return res.json({
          success: true,
          user: u,
          balances: b,
          token: sessionToken,
          serverTime: Date.now(),
          welcomeBonusGranted: Boolean(rpcData.welcome_bonus_granted),
        });
      }
    } catch (err: any) {
      console.warn('[Supabase Warning] Exception in get_or_restore_user RPC:', err);
    }
  }

  // Refuse fallback if in production without database
  if (isProduction && !supabase) {
    return res.status(500).json({
      success: false,
      error: 'Supabase database is required in production. Memory fallback is disabled to protect wallet balances.',
    });
  }

  const user = await getOrCreateUserAsync(tgUser.id, tgUser.first_name, tgUser.last_name, tgUser.username, false, parsedReferral, cachedBalances);

  // Link referred_by if new user joined with referral code
  if (!user.referredBy && parsedReferral) {
    const trimmed = parsedReferral.trim().toUpperCase();
    for (const [id, u] of users.entries()) {
      if (u.referralCode && u.referralCode.toUpperCase() === trimmed && id !== user.id) {
        user.referredBy = id;
        break;
      }
    }
    if (!user.referredBy && supabase) {
      try {
        const { data: refProfile } = await supabase
          .from('profiles')
          .select('id, telegram_id, referral_code')
          .ilike('referral_code', trimmed)
          .maybeSingle();
        if (refProfile && refProfile.telegram_id !== user.telegramId) {
          user.referredBy = refProfile.id || `usr_${refProfile.telegram_id}`;
        }
      } catch {}
    }
    if (user.referredBy) {
      syncUserToSupabase(user).catch(() => {});
      if (!referralHistory.some(r => r.referredUserId === user.id)) {
        referralHistory.push({
          id: `ref_${Date.now()}_${user.id}`,
          referrerId: user.referredBy,
          referredUserId: user.id,
          referredUid: user.uid,
          referredName: user.firstName,
          timestamp: Date.now(),
          status: 'ACTIVE',
          minedDays: 0,
          rewardEarned: 0,
        });
      }
      persistDatabaseSync();
    }
  }

  const userBalances = await getSupabaseBalance(user.id);
  const sessionToken = generateUserSessionToken(user.id);

  res.json({
    success: true,
    user,
    balances: userBalances,
    token: sessionToken,
    serverTime: Date.now(),
  });
});

// Explicit /api/balance Routes (Directly reading & writing from Supabase table 'balances')
app.get('/api/balance/:userId', requireUserAuth, async (req: Request, res: Response) => {
  const { userId } = req.params;
  const userBalances = await getSupabaseBalance(userId);
  res.json({ success: true, balances: userBalances, serverTime: Date.now() });
});

app.get('/api/balance', async (req: Request, res: Response) => {
  const userId = (req.query.userId as string) || (req.query.user_id as string);
  if (!userId) {
    return res.status(400).json({ success: false, error: 'userId is required' });
  }
  const userBalances = await getSupabaseBalance(userId);
  res.json({ success: true, balances: userBalances, serverTime: Date.now() });
});

app.post('/api/balance/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;
  const incoming = req.body.balances || req.body;
  const updated = await setSupabaseBalance(userId, incoming);
  res.json({ success: true, balances: updated, serverTime: Date.now() });
});

app.post('/api/balance', async (req: Request, res: Response) => {
  const userId = req.body.userId || req.body.user_id;
  if (!userId) {
    return res.status(400).json({ success: false, error: 'userId is required' });
  }
  const incoming = req.body.balances || req.body;
  const updated = await setSupabaseBalance(userId, incoming);
  res.json({ success: true, balances: updated, serverTime: Date.now() });
});

// Endpoint to check existing user and permanent referral code by telegram_id
app.get('/api/user/by-telegram/:telegramId', async (req: Request, res: Response) => {
  const tgId = Number(req.params.telegramId);
  if (!tgId || isNaN(tgId)) {
    return res.status(400).json({ success: false, error: 'Valid telegramId required' });
  }

  // 1. Permanent code lock for telegram_id 8827675419
  if (tgId === 8827675419) {
    return res.json({
      success: true,
      exists: true,
      referralCode: 'E4F786112',
      telegramId: tgId,
    });
  }

  // 2. Check Supabase 'users' and 'profiles' tables
  if (supabase) {
    try {
      const { data: dbUser } = await supabase
        .from('users')
        .select('*')
        .eq('telegram_id', tgId)
        .maybeSingle();

      if (dbUser) {
        return res.json({
          success: true,
          exists: true,
          referralCode: dbUser.referral_code,
        });
      }

      const { data: dbProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('telegram_id', tgId)
        .maybeSingle();

      if (dbProfile) {
        return res.json({
          success: true,
          exists: true,
          referralCode: dbProfile.referral_code,
        });
      }

      const { data: dbWallet } = await supabase
        .from('wallets')
        .select('*')
        .eq('telegram_id', tgId)
        .maybeSingle();

      if (dbWallet) {
        return res.json({
          success: true,
          exists: true,
          referralCode: null,
        });
      }
    } catch (err: any) {
      console.warn('[by-telegram API] Supabase query warning:', err.message);
    }
  }

  // 3. In-memory check
  const memUser = users.get(`usr_${tgId}`);
  if (memUser) {
    return res.json({
      success: true,
      exists: true,
      referralCode: memUser.referralCode,
    });
  }

  return res.json({
    success: true,
    exists: false,
    referralCode: null,
  });
});

// 2. User & Balances (/api/user/profile)
app.get('/api/user/:userId/profile', requireUserAuth, async (req: Request, res: Response) => {
  const { userId } = req.params;
  const parsedTelegramId = parseInt(userId.replace(/\D/g, '')) || 123456789;
  const user = users.get(userId) || (await getUserFromSupabase(userId)) || (await getOrCreateUserAsync(parsedTelegramId, 'E4F User'));
  let currentBal = balances.get(user.id);
  if (!currentBal) {
    currentBal = { usdt: 0, e4f: 0, btc: 0, eth: 0, sol: 0, bnb: 0 };
    balances.set(user.id, currentBal);
  }
  const hasWelcome = transactions.some(
    t => t.userId === user.id && (t.source === 'WELCOME_BONUS_USDT' || t.source === 'WELCOME_BONUS_E4F')
  );
  if (!hasWelcome && currentBal.usdt === 0 && currentBal.e4f === 0) {
    creditWelcomeBonus(user.id);
  }
  if (user.firstName === 'Telegram User') {
    user.firstName = 'E4F User';
  }
  if (!user.depositAddress) {
    user.depositAddress = generateUserDepositAddress(user.id, user.uid);
  }
  const userBalances = await getSupabaseBalance(user.id);
  // 90-day retention cutoff: return all user transactions within 90 days (up to 200)
  const cutoff = Date.now() - NINETY_DAYS_MS;
  let userTxs = transactions.filter(t => t.userId === user.id && t.timestamp >= cutoff);
  if (userTxs.length === 0 && supabase) {
    try {
      const { data } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('timestamp', { ascending: false })
        .limit(100);
      if (data && data.length > 0) {
        userTxs = data.map((d: any) => ({
          id: d.id,
          userId: d.user_id,
          asset: d.asset,
          amount: Number(d.amount),
          direction: d.direction,
          source: d.source,
          status: d.status,
          timestamp: Number(d.timestamp),
          referenceId: d.reference_id,
          note: d.note,
        }));
      }
    } catch {}
  }

  res.json({
    user,
    balances: userBalances,
    recentTransactions: userTxs.slice(0, 200),
    serverTime: Date.now(),
  });
});

// Self-Account Deletion
app.post('/api/user/:userId/delete', requireUserAuth, async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { confirmText } = req.body;

  if (confirmText !== 'DELETE') {
    return res.status(400).json({ success: false, error: 'Please confirm account deletion by providing "DELETE"' });
  }

  const user = users.get(userId);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });

  // Call Supabase authoritative permanent deletion RPC
  if (supabase) {
    try {
      const tgId = user.telegramId || (userId.startsWith('usr_') ? parseInt(userId.replace('usr_', ''), 10) : null);
      if (tgId) {
        await supabase.rpc('delete_user_permanently', { p_telegram_id: tgId });
      }
    } catch (dbErr) {
      console.warn('[Supabase] Warning invoking delete_user_permanently RPC:', dbErr);
    }
  }

  user.status = 'SUSPENDED';
  balances.set(userId, { usdt: 0, e4f: 0, btc: 0, eth: 0, sol: 0, bnb: 0 });

  auditLogs.unshift({
    id: `audit_${Date.now()}`,
    adminId: 'USER_SELF',
    action: 'ACCOUNT_DELETED',
    target: userId,
    details: `User UID ${user.uid} (${user.firstName}) permanently requested self-account deletion.`,
    timestamp: Date.now(),
  });

  persistDatabaseSync();

  res.json({ success: true, message: 'Account permanently deleted and sessions cleared.' });
});

// Update Username
app.post('/api/user/:userId/username', (req: Request, res: Response) => {
  const { userId } = req.params;
  const { username } = req.body;
  if (!username || typeof username !== 'string' || username.trim().length < 3) {
    return res.status(400).json({ success: false, error: 'Username must be at least 3 characters' });
  }
  const cleanUsername = username.trim().replace(/^@/, '');
  const user = users.get(userId);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });
  user.username = cleanUsername;
  res.json({ success: true, user, message: 'Username updated successfully' });
});

// Public System Settings (e.g. deposit address, deposit toggle for client UI)
app.get(['/api/system/public-settings', '/api/system/settings', '/system/public-settings', '/system/settings'], async (_req: Request, res: Response) => {
  if (supabase) {
    try {
      const { data } = await supabase.from('system_settings').select('settings').eq('id', 'global_settings').maybeSingle();
      if (data && data.settings && typeof data.settings === 'object') {
        Object.assign(systemSettings, data.settings);
        normalizeAdSlotSettings();
        const OLD_IDS = new Set(['54110', '54111', '410260', '54618', '54617', '54597', '2217']);
        delete (systemSettings as any).spin_01_adsgram;
        delete (systemSettings as any).spin_05_adexora;
        delete (systemSettings as any).box_01_adsgram;
        delete (systemSettings as any).box_05_adexora;
        delete (systemSettings as any).mining_01_adsgram;
        delete (systemSettings as any).mining_05_adexora;

        if (systemSettings.spin_03_onclicka === '6153717') systemSettings.spin_03_onclicka = '6153717';
        if (systemSettings.box_03_onclicka === '6153772') systemSettings.box_03_onclicka = '6153772';
        if (systemSettings.mining_03_onclicka === '6153774') systemSettings.mining_03_onclicka = '6153774';

        if (!systemSettings.adProvider || (systemSettings as any).adProvider === 'AdsGram' || (systemSettings as any).adProvider === 'Adexora') {
          systemSettings.adProvider = 'RichAds';
        }
        if (!systemSettings.miningPrimaryNetwork || (systemSettings as any).miningPrimaryNetwork === 'AdsGram' || (systemSettings as any).miningPrimaryNetwork === 'Adexora') {
          systemSettings.miningPrimaryNetwork = 'RichAds';
        }
        if (!systemSettings.miningSecondaryNetwork || (systemSettings as any).miningSecondaryNetwork === 'AdsGram' || (systemSettings as any).miningSecondaryNetwork === 'Adexora') {
          systemSettings.miningSecondaryNetwork = 'Monetag';
        }
        systemSettings.e4fPlannedTargetPriceRange = 'Not Listed Yet';
      }
    } catch {}
    systemSettings.e4fPlannedTargetPriceRange = 'Not Listed Yet';
  }

  // Ensure full E4F IDs
  if (systemSettings.spin_03_onclicka === '6153717') systemSettings.spin_03_onclicka = '6153717';
  if (systemSettings.box_03_onclicka === '6153772') systemSettings.box_03_onclicka = '6153772';
  if (systemSettings.mining_03_onclicka === '6153774') systemSettings.mining_03_onclicka = '6153774';

  res.json({
    success: true,
    ...systemSettings,
    depositsEnabled: systemSettings.depositsEnabled === true,
    withdrawalsEnabled: systemSettings.withdrawalsEnabled !== false,
    minWithdrawalLimit: systemSettings.minWithdrawalLimit !== undefined ? systemSettings.minWithdrawalLimit : 0.1,
    maxWithdrawalLimit: systemSettings.maxWithdrawalLimit || 1000.0,
    withdrawalFee: systemSettings.withdrawalFee !== undefined ? systemSettings.withdrawalFee : 1.0,
    networkWithdrawSettings: systemSettings.networkWithdrawSettings || defaultNetworkWithdrawSettings,
    bscDepositAddress: systemSettings.bscDepositAddress || '0x63562945f7845aa1130a5b1499720b29788c82db',
    depositMinUSDT: systemSettings.depositMinUSDT !== undefined ? systemSettings.depositMinUSDT : 2.0,
    depositFirstBonusUSDT: systemSettings.depositFirstBonusUSDT !== undefined ? systemSettings.depositFirstBonusUSDT : 10.0,
    e4fPlannedListingDate: systemSettings.e4fPlannedListingDate || '2028-02-28',
    referralBonusUSDT: systemSettings.referralBonusUSDT !== undefined ? systemSettings.referralBonusUSDT : 5.0,
    welcomeBonusUSDT: systemSettings.welcomeBonusUSDT !== undefined ? systemSettings.welcomeBonusUSDT : 25.0,
    welcomeBonusE4F: systemSettings.welcomeBonusE4F !== undefined ? systemSettings.welcomeBonusE4F : 10.0,
    adProvider: systemSettings.adProvider || 'RichAds',
    rewardedAdRequired: systemSettings.rewardedAdRequired !== false,
    adRequired: systemSettings.rewardedAdRequired !== false,
    adDurationSeconds: systemSettings.miningAdDurationSeconds || systemSettings.adMiningDurationSeconds || 30,
    miningAdDurationSeconds: systemSettings.miningAdDurationSeconds || systemSettings.adMiningDurationSeconds || 30,
    spinAdDurationSeconds: systemSettings.spinAdDurationSeconds || 30,
    giftBoxAdDurationSeconds: systemSettings.giftBoxAdDurationSeconds || 30,
    miningRatePerHour: systemSettings.miningRatePerHour || 0.25,
    miningDurationHours: systemSettings.miningDurationHours || 8,
    monetagTelegramSdkEnabled: systemSettings.monetagTelegramSdkEnabled !== false,
    monetagZoneId: systemSettings.monetagZoneId || '12044377',
    monetagDirectLink: '',
    adsterraDirectLink: systemSettings.adsterraDirectLink || 'https://beta.publishers.adsterra.com/direct-link-demo',
    // Waterfall Ad IDs (5 Tiers: RichAds, Monetag, OnClickA)
    spin_01_richads: resolveAdId('SPIN', 1),
    spin_02_monetag: resolveAdId('SPIN', 2),
    spin_03_onclicka: resolveAdId('SPIN', 3),
    spin_04_richads: resolveAdId('SPIN', 4),
    spin_05_monetag: resolveAdId('SPIN', 5),
    box_01_richads: resolveAdId('GIFT_BOX', 1),
    box_02_monetag: resolveAdId('GIFT_BOX', 2),
    box_03_onclicka: resolveAdId('GIFT_BOX', 3),
    box_04_richads: resolveAdId('GIFT_BOX', 4),
    box_05_monetag: resolveAdId('GIFT_BOX', 5),
    // Mining Ad Gate & Waterfall (Configurable by Admin without app updates)
    miningPrimaryNetwork: systemSettings.miningPrimaryNetwork || 'RichAds',
    miningSecondaryNetwork: systemSettings.miningSecondaryNetwork || 'Monetag',
    miningWaterfallEnabled: systemSettings.miningWaterfallEnabled !== false,
    mining_01_richads: resolveAdId('MINING', 1),
    mining_02_monetag: resolveAdId('MINING', 2),
    mining_03_onclicka: resolveAdId('MINING', 3),
    mining_04_richads: resolveAdId('MINING', 4),
    mining_05_monetag: resolveAdId('MINING', 5),
  });
});

// Live Instant Ad Gate Configuration for Mining, Spin, and Gift Boxes
app.get('/api/ad-config', (req: Request, res: Response) => {
  res.json({
    success: true,
    mining_01_richads: resolveAdId('MINING', 1),
    mining_02_monetag: resolveAdId('MINING', 2),
    mining_03_onclicka: resolveAdId('MINING', 3),
    mining_04_richads: resolveAdId('MINING', 4),
    mining_05_monetag: resolveAdId('MINING', 5),
    spin_01_richads: resolveAdId('SPIN', 1),
    spin_02_monetag: resolveAdId('SPIN', 2),
    spin_03_onclicka: resolveAdId('SPIN', 3),
    spin_04_richads: resolveAdId('SPIN', 4),
    spin_05_monetag: resolveAdId('SPIN', 5),
    box_01_richads: resolveAdId('GIFT_BOX', 1),
    box_02_monetag: resolveAdId('GIFT_BOX', 2),
    box_03_onclicka: resolveAdId('GIFT_BOX', 3),
    box_04_richads: resolveAdId('GIFT_BOX', 4),
    box_05_monetag: resolveAdId('GIFT_BOX', 5),
    miningAdDuration: Number(systemSettings.miningAdDurationSeconds || systemSettings.adMiningDurationSeconds || 30),
    spinAdDuration: Number(systemSettings.spinAdDurationSeconds || 30),
    giftBoxAdDuration: Number(systemSettings.giftBoxAdDurationSeconds || 30),
  });
});

// ---------------------------------------------------------------------------
// Account Verification = "Trusted Miner" (Zero ID Card / No KYC Required)
// A user who mines at least once on 120 consecutive UTC days is verified automatically on the 120th day.
// The old deposit-based verification was removed completely.
// ---------------------------------------------------------------------------
const TRUSTED_MINER_DAYS = 120;

async function computeMiningStreak(userId: string, now: number): Promise<number> {
  const DAY = 86400000;
  const days = new Set<number>();
  for (const s of miningSessions) {
    if (s.userId === userId) days.add(Math.floor(Number(s.startTime) / DAY));
  }
  if (supabase) {
    try {
      const { data } = await supabase
        .from('mining_sessions')
        .select('start_time')
        .eq('user_id', userId)
        .gte('start_time', now - (TRUSTED_MINER_DAYS + 5) * DAY);
      (data || []).forEach((r: any) => days.add(Math.floor(Number(r.start_time) / DAY)));
    } catch {}
  }
  const today = Math.floor(now / DAY);
  // Count back from today (or from yesterday if the user has not mined yet today)
  let d = days.has(today) ? today : today - 1;
  let streak = 0;
  while (days.has(d)) { streak++; d--; }
  return streak;
}

async function evaluateTrustedMiner(userId: string, now: number): Promise<void> {
  let u: UserRecord | null | undefined = users.get(userId);
  if (!u && supabase) u = await getUserFromSupabase(userId);
  if (!u || u.isVerified) return;
  const streak = await computeMiningStreak(userId, now);
  if (streak >= TRUSTED_MINER_DAYS) {
    u.isVerified = true;
    users.set(u.id, u);
    await syncUserToSupabase(u);
    scheduleSaveDatabase();
  }
}

// Old deposit-based verification endpoint is removed
app.post('/api/user/:userId/verify-account', (_req: Request, res: Response) => {
  return res.status(410).json({
    success: false,
    error: 'Deposit verification has been removed. Mine every day for 120 days in a row to become a Trusted Miner.',
  });
});

app.get('/api/user/:userId/trusted-miner', requireUserAuth, async (req: Request, res: Response) => {
  const { userId } = req.params;
  let user: UserRecord | null | undefined = users.get(userId);
  if (!user && supabase) user = await getUserFromSupabase(userId);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });
  const streak = await computeMiningStreak(userId, Date.now());
  return res.json({
    success: true,
    streakDays: Math.min(streak, TRUSTED_MINER_DAYS),
    requiredDays: TRUSTED_MINER_DAYS,
    isVerified: Boolean(user.isVerified),
  });
});

// 3. Mining API (/api/mining)
app.get('/api/mining/:userId/status', requireUserAuth, async (req: Request, res: Response) => {
  const { userId } = req.params;
  const now = Date.now();

  let userSessions = miningSessions.filter(s => s.userId === userId);
  if (userSessions.length === 0 && supabase) {
    try {
      const { data: dbSessions } = await supabase
        .from('mining_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('start_time', { ascending: false });
      if (dbSessions && dbSessions.length > 0) {
        for (const ds of dbSessions) {
          const rec: MiningRecord = {
            id: ds.id,
            userId: ds.user_id,
            startTime: Number(ds.start_time),
            endTime: Number(ds.end_time),
            durationSeconds: Number(ds.duration_seconds),
            miningRatePerHour: Number(ds.mining_rate_per_hour),
            estimatedReward: Number(ds.estimated_reward),
            status: ds.status as any,
            adVerified: Boolean(ds.ad_verified),
            adSessionId: ds.ad_session_id,
            claimedAt: ds.claimed_at ? Number(ds.claimed_at) : undefined,
          };
          if (!miningSessions.some(m => m.id === rec.id)) {
            miningSessions.push(rec);
          }
        }
        userSessions = miningSessions.filter(s => s.userId === userId);
      }
    } catch {}
  }

  const activeSession = userSessions.find(s => s.status === 'ACTIVE');

  // Check if session has ended
  if (activeSession && now >= activeSession.endTime) {
    activeSession.status = 'COMPLETED';
  }

  const completedSessions = userSessions.filter(s => s.status === 'CLAIMED' || s.status === 'COMPLETED');
  const totalMinedE4F = userSessions
    .filter(s => s.status === 'CLAIMED')
    .reduce((sum, s) => sum + s.estimatedReward, 0);

  const startOfToday = new Date().setHours(0, 0, 0, 0);
  const todayMinedE4F = userSessions
    .filter(s => s.status === 'CLAIMED' && (s.claimedAt || 0) >= startOfToday)
    .reduce((sum, s) => sum + s.estimatedReward, 0);

  // Milestone: 28 Feb 2028
  const seasonEnd = new Date('2028-02-28T00:00:00Z').getTime();
  const daysRemaining = Math.max(0, Math.ceil((seasonEnd - now) / (1000 * 60 * 60 * 24)));

  // Referral mining boost calculation
  const referralCount = Number((systemSettings as any).baseReferralBoostCount ?? 12); // Base user referral network (admin-configurable)
  const boostPercent = calculateMiningBoost(referralCount);
  const baseRate = systemSettings.miningRatePerHour;
  const boostedRate = Number((baseRate * (1 + boostPercent / 100)).toFixed(4));

  res.json({
    serverTime: now,
    activeSession: activeSession || null,
    activeAdSession: null,
    todayMiningE4F: todayMinedE4F,
    totalMiningE4F: totalMinedE4F,
    totalSessionsCompleted: completedSessions.length,
    miningRatePerHour: systemSettings.miningRatePerHour,
    referralCount,
    miningBoostPercent: boostPercent,
    boostedMiningRatePerHour: boostedRate,
    durationHours: systemSettings.miningDurationHours,
    adRequired: systemSettings.rewardedAdRequired !== false,
    adDurationSeconds: systemSettings.miningAdDurationSeconds || systemSettings.adMiningDurationSeconds || 30,
    miningAdDurationSeconds: systemSettings.miningAdDurationSeconds || systemSettings.adMiningDurationSeconds || 30,
    spinAdDurationSeconds: systemSettings.spinAdDurationSeconds || 30,
    giftBoxAdDurationSeconds: systemSettings.giftBoxAdDurationSeconds || 30,
    miningPrimaryNetwork: systemSettings.miningPrimaryNetwork || 'RichAds',
    miningSecondaryNetwork: systemSettings.miningSecondaryNetwork || 'Monetag',
    miningWaterfallEnabled: systemSettings.miningWaterfallEnabled !== false,
    mining_01_richads: resolveAdId('MINING', 1),
    mining_02_monetag: resolveAdId('MINING', 2),
    mining_03_onclicka: resolveAdId('MINING', 3),
    mining_04_richads: resolveAdId('MINING', 4),
    mining_05_monetag: resolveAdId('MINING', 5),
    adsterraDirectLink: systemSettings.adsterraDirectLink,
    monetagDirectLink: systemSettings.monetagDirectLink,
    seasonEndDate: seasonEnd,
    seasonDaysRemaining: daysRemaining,
    plannedTargetPriceRange: systemSettings.e4fPlannedTargetPriceRange,
  });
});

// =========================================================================
// SECURE AD ENGINE
// - Ad sessions are STATELESS signed tokens (HMAC). They work on every serverless instance.
// - A reward token ("claimToken") is signed, short lived and can be redeemed exactly ONCE
//   (durable one-time redemption in Supabase table e4f_ad_redeemed).
// - Daily limits (5 spins / 5 gift boxes) live in Supabase table e4f_daily_claims, not in memory.
// - The server decides which network/slot belongs to a spin or box. The client cannot choose.
// - There is NO client-side or "clm_" fallback anywhere. No ad = no reward.
// =========================================================================
type AdAction = 'MINING' | 'SPIN' | 'GIFT_BOX';
type AdNetwork = 'RichAds' | 'Monetag' | 'OnClickA';

interface AdTier {
  index: number;
  provider: AdNetwork;
  id: string;
  label: string;
}

// Fixed network per slot (matches the approved "FINAL AD LOGIC" design)
const AD_SLOT_NETWORKS: Record<AdAction, AdNetwork[]> = {
  MINING: ['RichAds', 'Monetag', 'OnClickA', 'RichAds', 'Monetag'],
  SPIN: ['RichAds', 'Monetag', 'OnClickA', 'Monetag', 'Monetag'],
  GIFT_BOX: ['RichAds', 'Monetag', 'OnClickA', 'Monetag', 'Monetag'],
};
const AD_SLOT_DEFAULT_IDS: Record<AdAction, string[]> = {
  MINING: ['410204', '12044377', '6153774', '410204', '12044377'],
  SPIN: ['410203', '12044377', '6153717', '12044377', '12044377'],
  GIFT_BOX: ['410202', '12044377', '6153772', '12044377', '12044377'],
};
const AD_SETTING_PREFIX: Record<AdAction, string> = { MINING: 'mining', SPIN: 'spin', GIFT_BOX: 'box' };
const AD_SETTING_SUFFIX = ['richads', 'monetag', 'onclicka', 'richads', 'monetag'];
const AD_ID_PATTERN: Record<AdNetwork, RegExp> = {
  RichAds: /^\d{6}$/,
  Monetag: /^\d{7,9}$/,
  OnClickA: /^\d{5,10}E4F$/i,
};

function adSettingKey(action: AdAction, slot: number): string {
  return `${AD_SETTING_PREFIX[action]}_0${slot}_${AD_SETTING_SUFFIX[slot - 1]}`;
}

/** Resolve the ad id for a slot. Admin may change the id, but never the network type of the slot. */
function resolveAdId(action: AdAction, slot: number): string {
  const network = AD_SLOT_NETWORKS[action][slot - 1];
  const raw = String((systemSettings as any)[adSettingKey(action, slot)] ?? '').trim();
  if (raw && AD_ID_PATTERN[network].test(raw)) return raw;
  return AD_SLOT_DEFAULT_IDS[action][slot - 1];
}

/** Write the resolved (valid) ids back into settings so every endpoint/admin panel shows the same values. */
function normalizeAdSlotSettings(): void {
  (['MINING', 'SPIN', 'GIFT_BOX'] as AdAction[]).forEach((action) => {
    for (let slot = 1; slot <= 5; slot++) {
      (systemSettings as any)[adSettingKey(action, slot)] = resolveAdId(action, slot);
    }
  });
}
normalizeAdSlotSettings();

function getAdTiers(action: AdAction, slot?: number): AdTier[] {
  const build = (s: number): AdTier => {
    const provider = AD_SLOT_NETWORKS[action][s - 1];
    const label = action === 'MINING'
      ? `${provider} (Tier ${s})`
      : `${provider} (${action === 'SPIN' ? 'Spin' : 'Box'} ${s})`;
    return { index: action === 'MINING' ? s : 1, provider, id: resolveAdId(action, s), label };
  };
  if (action === 'MINING') return [1, 2, 3, 4, 5].map(build);
  const s = Math.max(1, Math.min(5, Number(slot) || 1));
  return [build(s)];
}

// ---- signed payloads -----------------------------------------------------
const AD_SESSION_TTL_MS = 15 * 60 * 1000;
const AD_CLAIM_TTL_MS = 10 * 60 * 1000;

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function fromB64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}
function adSign(kind: 'session' | 'watch' | 'claim' | 'timer', payload: Record<string, any>): string {
  const body = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', SESSION_SECRET_KEY).update(`e4f-ad|${kind}|${body}`).digest('hex');
  return `${body}.${sig}`;
}
function adVerify(kind: 'session' | 'watch' | 'claim' | 'timer', token: any): Record<string, any> | null {
  if (typeof token !== 'string' || token.length > 2000) return null;
  const dot = token.indexOf('.');
  if (dot < 1) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac('sha256', SESSION_SECRET_KEY).update(`e4f-ad|${kind}|${body}`).digest('hex');
  const a = Buffer.from(sig, 'utf-8');
  const b = Buffer.from(expected, 'utf-8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const obj = JSON.parse(fromB64url(body).toString('utf-8'));
    return obj && typeof obj === 'object' ? obj : null;
  } catch {
    return null;
  }
}

// ---- durable storage (Supabase) with a dev-only in-memory fallback ---------
const memDailyClaims = new Map<string, Set<number>>();
const memRedeemed = new Set<string>();
const memPostbacks = new Set<string>();
const todayUTC = (): string => new Date().toISOString().slice(0, 10);

class AdStoreError extends Error {}

async function getDailySlots(userId: string, type: 'SPIN' | 'GIFT_BOX'): Promise<number[]> {
  const day = todayUTC();
  if (supabase) {
    const { data, error } = await supabase
      .from('e4f_daily_claims')
      .select('slot')
      .eq('user_id', userId)
      .eq('day', day)
      .eq('type', type);
    if (error) throw new AdStoreError(error.message);
    return (data || []).map((r: any) => Number(r.slot));
  }
  if (isProduction) throw new AdStoreError('Database is not configured');
  return Array.from(memDailyClaims.get(`${userId}|${day}|${type}`) || []);
}

/** Returns true when the slot was claimed now, false when it was already claimed (race / replay). */
async function claimDailySlot(userId: string, type: 'SPIN' | 'GIFT_BOX', slot: number): Promise<boolean> {
  const day = todayUTC();
  if (supabase) {
    const { error } = await supabase.from('e4f_daily_claims').insert({ user_id: userId, day, type, slot });
    if (!error) return true;
    if ((error as any).code === '23505') return false;
    throw new AdStoreError(error.message);
  }
  if (isProduction) throw new AdStoreError('Database is not configured');
  const k = `${userId}|${day}|${type}`;
  const set = memDailyClaims.get(k) || new Set<number>();
  if (set.has(slot)) return false;
  set.add(slot);
  memDailyClaims.set(k, set);
  return true;
}

async function redeemSessionOnce(sid: string, userId: string, action: AdAction, slot: number): Promise<boolean> {
  if (supabase) {
    const { error } = await supabase
      .from('e4f_ad_redeemed')
      .insert({ session_id: sid, user_id: userId, action, slot, redeemed_at: new Date().toISOString() });
    if (!error) return true;
    if ((error as any).code === '23505') return false;
    throw new AdStoreError(error.message);
  }
  if (isProduction) throw new AdStoreError('Database is not configured');
  if (memRedeemed.has(sid)) return false;
  memRedeemed.add(sid);
  return true;
}

async function hasMonetagPostback(sid: string): Promise<boolean> {
  if (supabase) {
    const { data, error } = await supabase.from('e4f_ad_postbacks').select('ymid').eq('ymid', sid).maybeSingle();
    if (error) throw new AdStoreError(error.message);
    return Boolean(data);
  }
  return memPostbacks.has(sid);
}

function adStoreFail(res: Response, err: any) {
  console.error('[AdEngine] store error:', err?.message || err);
  return res.status(503).json({
    success: false,
    error: 'Rewards are temporarily unavailable. Please try again in a moment.',
  });
}

// ---- tiny per-instance rate limiter (extra protection, not the only one) ----
const adRateBuckets = new Map<string, { n: number; t: number }>();
function adRateLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const b = adRateBuckets.get(key);
  if (!b || now - b.t > windowMs) {
    adRateBuckets.set(key, { n: 1, t: now });
    if (adRateBuckets.size > 5000) {
      for (const [k, v] of adRateBuckets) if (now - v.t > windowMs) adRateBuckets.delete(k);
    }
    return false;
  }
  b.n += 1;
  return b.n > max;
}

function firstUnusedSlot(used: number[], max: number): number {
  for (let s = 1; s <= max; s++) if (!used.includes(s)) return s;
  return 0;
}
const spinMaxDaily = (): number => Math.max(1, Math.min(5, Number(systemSettings.rewardSpinMaxDaily) || 5));
const boxMaxDaily = (): number => Math.max(1, Math.min(5, Number(systemSettings.giftBoxMaxDaily) || 5));

/** Is there a mining session still running for this user? (memory first, then database) */
async function userHasActiveMining(userId: string, now: number): Promise<boolean> {
  if (miningSessions.some(s => s.userId === userId && s.status === 'ACTIVE' && now < s.endTime)) return true;
  if (supabase) {
    try {
      const { data } = await supabase
        .from('mining_sessions')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'ACTIVE')
        .gt('end_time', now)
        .limit(1);
      if (data && data.length > 0) return true;
    } catch {}
  }
  return false;
}

type RedeemResult = { ok: boolean; slot?: number; status?: number; error?: string };

/**
 * Validates a reward token and burns it. Called by mining start, spin and gift box.
 * The token must be: correctly signed, not expired, issued to THIS user, for THIS action and slot,
 * and never redeemed before.
 */
async function redeemAdClaim(
  userId: string,
  adSessionId: any,
  claimToken: any,
  action: AdAction,
  expectedSlot: number
): Promise<RedeemResult> {
  const c = adVerify('claim', claimToken);
  if (!c || typeof adSessionId !== 'string' || c.sid !== adSessionId || c.uid !== userId || c.act !== action) {
    return { ok: false, status: 403, error: 'Rewarded ad verification failed. Please watch the ad again.' };
  }
  if (Date.now() > Number(c.exp)) {
    return { ok: false, status: 403, error: 'The ad reward expired. Please watch the ad again.' };
  }
  if (Number(c.slot) !== expectedSlot) {
    return { ok: false, status: 403, error: 'This ad was issued for a different slot.' };
  }
  const fresh = await redeemSessionOnce(String(c.sid), userId, action, expectedSlot);
  if (!fresh) {
    return { ok: false, status: 403, error: 'This ad reward has already been used. Please watch a new ad.' };
  }
  return { ok: true, slot: expectedSlot };
}

// Public ad config: always the validated slot ids (never stale/invalid values)
function publicAdConfig() {
  const cfg: Record<string, any> = {};
  (['MINING', 'SPIN', 'GIFT_BOX'] as AdAction[]).forEach((action) => {
    for (let slot = 1; slot <= 5; slot++) cfg[adSettingKey(action, slot)] = resolveAdId(action, slot);
  });
  return cfg;
}

// ---------------------------------------------------------------------------
// 1) Create an ad session (server decides slot + network)
// ---------------------------------------------------------------------------
// Admin ban/suspension is enforced on reward + money routes (30s cache, DB is the source of truth)
const suspendCache = new Map<string, { v: boolean; t: number }>();
async function isUserSuspended(userId: string): Promise<boolean> {
  const c = suspendCache.get(userId);
  if (c && Date.now() - c.t < 30000) return c.v;
  let v = false;
  try {
    if (supabase) {
      const { data } = await supabase.from('users').select('status').eq('id', userId).maybeSingle();
      v = data?.status === 'SUSPENDED';
    }
    const mem = users.get(userId);
    if (mem && mem.status === 'SUSPENDED') v = true;
  } catch {}
  suspendCache.set(userId, { v, t: Date.now() });
  return v;
}

app.post('/api/ads/session/create', requireUserAuth, async (req: Request, res: Response) => {
  const userId = String((req as any).verifiedUserId || '');
  const actionType = String(req.body?.actionType || '').toUpperCase() as AdAction;
  if (!userId) return res.status(401).json({ success: false, error: 'Authentication required' });
  if (await isUserSuspended(userId)) return res.status(403).json({ success: false, error: 'Your account is suspended.' });
  if (!['MINING', 'SPIN', 'GIFT_BOX'].includes(actionType)) {
    return res.status(400).json({ success: false, error: 'Invalid actionType. Must be MINING, SPIN or GIFT_BOX' });
  }
  if (adRateLimited(`create|${userId}`, 20, 60_000)) {
    return res.status(429).json({ success: false, error: 'Too many requests. Please wait a moment.' });
  }

  try {
    const now = Date.now();
    let slot = 0;

    if (actionType === 'MINING') {
      if (await userHasActiveMining(userId, now)) {
        return res.status(400).json({ success: false, error: 'A mining session is already active' });
      }
    } else if (actionType === 'SPIN') {
      const max = spinMaxDaily();
      const used = await getDailySlots(userId, 'SPIN');
      slot = firstUnusedSlot(used, max);
      if (!slot) {
        return res.status(400).json({ success: false, error: `Daily spin limit of ${max} reached. Resets at 00:00 UTC.` });
      }
    } else {
      const max = boxMaxDaily();
      const boxNum = Number(req.body?.targetId);
      if (!Number.isInteger(boxNum) || boxNum < 1 || boxNum > max) {
        return res.status(400).json({ success: false, error: 'Invalid gift box number' });
      }
      const used = await getDailySlots(userId, 'GIFT_BOX');
      if (used.length >= max) {
        return res.status(400).json({ success: false, error: `Daily gift box limit of ${max} reached. Resets at 00:00 UTC.` });
      }
      if (used.includes(boxNum)) {
        return res.status(400).json({ success: false, error: `Gift Box #${boxNum} already opened today.` });
      }
      slot = boxNum;
    }

    const sid = `ad_${crypto.randomBytes(12).toString('hex')}`;
    const token = adSign('session', { sid, uid: userId, act: actionType, slot, iat: now, exp: now + AD_SESSION_TTL_MS });
    const tiers = getAdTiers(actionType, slot);
    const durationSeconds = Number(
      actionType === 'MINING'
        ? (systemSettings.miningAdDurationSeconds || systemSettings.adMiningDurationSeconds || 30)
        : actionType === 'SPIN'
        ? (systemSettings.spinAdDurationSeconds || 30)
        : (systemSettings.giftBoxAdDurationSeconds || 30)
    ) || 30;

    if (supabase) {
      Promise.resolve(
        supabase.from('e4f_ad_views').insert({
          user_id: userId,
          network: tiers[0].provider,
          placement: actionType + (slot ? `_${slot}` : ''),
          created_at: new Date().toISOString(),
        })
      ).catch(() => {});
    }

    return res.json({
      success: true,
      sessionId: sid,
      token,
      actionType,
      targetId: slot || undefined,
      durationSeconds,
      tiers,
      zoneId: tiers[0].id,
      provider: tiers[0].provider,
      directLink: '',
      serverTime: now,
    });
  } catch (err: any) {
    return adStoreFail(res, err);
  }
});

function readAdSession(req: Request): { ok: boolean; p?: Record<string, any>; userId?: string; status?: number; error?: string } {
  const userId = String((req as any).verifiedUserId || '');
  const p = adVerify('session', req.body?.token);
  if (!p || p.sid !== req.body?.sessionId || p.uid !== userId) {
    return { ok: false, status: 400, error: 'Invalid or expired ad session' };
  }
  if (Date.now() > Number(p.exp)) {
    return { ok: false, status: 400, error: 'Ad session expired. Please start a new one.' };
  }
  return { ok: true, p, userId };
}

// ---------------------------------------------------------------------------
// 2) The user pressed "Watch Ad": server starts its own clock and returns a signed watch ticket
// ---------------------------------------------------------------------------
app.post('/api/ads/session/start-watching', requireUserAuth, (req: Request, res: Response) => {
  const r = readAdSession(req);
  if (!r.ok) return res.status(r.status || 400).json({ success: false, error: r.error || 'Invalid ad session' });
  const now = Date.now();
  const watchTicket = adSign('watch', { sid: r.p!.sid, uid: r.userId, st: now });
  return res.json({ success: true, startedAt: now, watchTicket, serverTime: now });
});

app.post('/api/ads/session/cancel', requireUserAuth, (_req: Request, res: Response) => {
  // Sessions are stateless; nothing to clean up. A cancelled session simply is never completed.
  res.json({ success: true, message: 'Session cancelled' });
});

// Monetag server-to-server postback (optional hard proof that the ad really played).
// In Monetag dashboard set: https://YOUR-DOMAIN/api/monetag/postback?ymid={ymid}&zone_id={zone_id}&secret=YOUR_MONETAG_POSTBACK_SECRET
app.get('/api/monetag/postback', async (req: Request, res: Response) => {
  const sid = String(req.query.ymid || '');
  const required = process.env.MONETAG_POSTBACK_SECRET || '';
  if (required && String(req.query.secret || '') !== required) {
    return res.status(403).send('Forbidden');
  }
  if (!/^ad_[0-9a-f]{24}$/.test(sid)) return res.status(200).send('OK');
  try {
    if (supabase) {
      await supabase.from('e4f_ad_postbacks').upsert({
        ymid: sid,
        zone_id: String(req.query.zone_id || ''),
        created_at: new Date().toISOString(),
      });
    } else {
      memPostbacks.add(sid);
    }
  } catch (e) {
    console.warn('[Monetag Postback] store failed', e);
  }
  return res.status(200).send('OK');
});

// ---------------------------------------------------------------------------
// 3) The ad network reported "finished": server checks its OWN clock and issues the reward token
// ---------------------------------------------------------------------------
app.post('/api/ads/session/complete', requireUserAuth, async (req: Request, res: Response) => {
  const r = readAdSession(req);
  if (!r.ok) return res.status(r.status || 400).json({ success: false, error: r.error || 'Invalid ad session' });
  const p = r.p as Record<string, any>;
  const userId = r.userId as string;
  const action = p.act as AdAction;
  const slot = Number(p.slot) || 0;

  const ticket = adVerify('watch', req.body?.watchTicket);
  if (!ticket || ticket.sid !== p.sid || ticket.uid !== userId || Number(ticket.st) < Number(p.iat) - 1000) {
    return res.status(400).json({ success: false, error: 'You must open and watch the real ad before claiming reward.', canVerify: false });
  }

  const now = Date.now();
  const elapsedMs = now - Number(ticket.st);
  if (elapsedMs < 0 || elapsedMs > AD_SESSION_TTL_MS) {
    return res.status(400).json({ success: false, error: 'Ad verification expired. Please start a new one.' });
  }

  // Which network played? For spin / gift box the server knows (dedicated slot). For mining the client reports which
  // tier of the waterfall finished; it can only be one of the three real networks.
  let network: AdNetwork;
  if (action === 'MINING') {
    const claimed = String(req.body?.network || '');
    network = (['RichAds', 'Monetag', 'OnClickA'] as AdNetwork[]).includes(claimed as AdNetwork) ? (claimed as AdNetwork) : 'RichAds';
  } else {
    network = AD_SLOT_NETWORKS[action][slot - 1];
    // Backup rule: if the slot's own ad had no fill (twice), the app shows Monetag 12044377 instead.
    if (String(req.body?.network || '') === 'Monetag') network = 'Monetag';
  }

  const floorSeconds = Math.max(3, Number(systemSettings.adMinWatchSeconds) || 5);
  const minSeconds = floorSeconds;
  if (elapsedMs < minSeconds * 1000) {
    const remainingSeconds = Math.max(1, Math.ceil((minSeconds * 1000 - elapsedMs) / 1000));
    return res.status(400).json({
      success: false,
      error: `Watch the full ad to get the reward. (${remainingSeconds}s remaining)`,
      remainingSeconds,
      canVerify: false,
    });
  }

  // Optional strict mode: Monetag must confirm through the server-to-server postback.
  if (network === 'Monetag' && process.env.REQUIRE_MONETAG_POSTBACK === '1') {
    let confirmed = false;
    try {
      for (let i = 0; i < 4 && !confirmed; i++) {
        confirmed = await hasMonetagPostback(String(p.sid));
        if (!confirmed) await new Promise(r2 => setTimeout(r2, 800));
      }
    } catch (e) {
      return adStoreFail(res, e);
    }
    if (!confirmed) {
      return res.status(400).json({ success: false, error: 'Ad completion could not be confirmed. Please try again.' });
    }
  }

  const claimToken = adSign('claim', { sid: p.sid, uid: userId, act: action, slot, vat: now, exp: now + AD_CLAIM_TTL_MS });

  if (supabase) {
    Promise.resolve(
      supabase.from('e4f_ad_events').insert({
        user_id: userId,
        network,
        placement: action + (slot ? `_${slot}` : ''),
        reward_token: String(p.sid),
        created_at: new Date().toISOString(),
      })
    ).catch(() => {});
  }

  return res.json({ success: true, verified: true, sessionId: p.sid, claimToken, serverTime: now });
});

// Logging endpoints are authenticated; the server already records views/events itself.
app.post('/api/ads/log-view', requireUserAuth, (_req: Request, res: Response) => res.json({ success: true }));
app.post('/api/ads/log-event', requireUserAuth, (_req: Request, res: Response) => res.json({ success: true }));

// Retired endpoints (they could mint rewards without a real ad). Kept only to return a clear answer.
app.all(
  ['/api/ads/anti-fake/start-session', '/api/ads/anti-fake/daily-status', '/api/ads/anti-fake/verify-and-reward',
   '/api/mining/ad-session', '/api/mining/start-ad-playback', '/api/mining/verify-ad'],
  (_req: Request, res: Response) => res.status(410).json({ success: false, error: 'This endpoint has been retired.' })
);
app.get('/api/mining/:userId/ad-session', (_req: Request, res: Response) =>
  res.json({ success: true, hasActiveSession: false, session: null, serverTime: Date.now() })
);

// Start Mining Session (Guarded by strict ad-session verification for both endpoints)
const handleStartMining = async (req: Request, res: Response) => {
  const userId = String((req as any).verifiedUserId || '');
  const { adSessionId, claimToken } = req.body || {};
  const now = Date.now();
  if (!userId) return res.status(401).json({ success: false, error: 'Authentication required' });

  const user = await getUserFromSupabase(userId);
  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }

  // Check if an active session already exists
  let existingActive = miningSessions.find(s => s.userId === userId && s.status === 'ACTIVE' && now < s.endTime);
  if (!existingActive && supabase) {
    try {
      const { data: dbActive } = await supabase
        .from('mining_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'ACTIVE')
        .gt('end_time', now)
        .maybeSingle();
      if (dbActive) {
        existingActive = {
          id: dbActive.id,
          userId: dbActive.user_id,
          startTime: Number(dbActive.start_time),
          endTime: Number(dbActive.end_time),
          durationSeconds: Number(dbActive.duration_seconds),
          miningRatePerHour: Number(dbActive.mining_rate_per_hour),
          estimatedReward: Number(dbActive.estimated_reward),
          status: 'ACTIVE',
          adVerified: Boolean(dbActive.ad_verified),
          adSessionId: dbActive.ad_session_id,
        };
      }
    } catch {}
  }

  if (existingActive) {
    return res.status(400).json({ success: false, error: 'A mining session is already active' });
  }

  // A completed rewarded ad is required to start mining UNLESS the admin switched the mining Ad Gate OFF.
  // The decision is made here on the server from the saved admin setting; a client can never skip the ad by itself.
  const miningAdRequired = systemSettings.rewardedAdRequired !== false;
  let adVerified = false;
  if (miningAdRequired) {
    if (!adSessionId || !claimToken) {
      return res.status(403).json({
        success: false,
        error: 'Mining locked. Rewarded ad completion is required to start mining.',
      });
    }
    try {
      const redeemed = await redeemAdClaim(userId, adSessionId, claimToken, 'MINING', 0);
      if (!redeemed.ok) {
        return res.status(redeemed.status || 403).json({ success: false, error: redeemed.error || 'Ad verification failed' });
      }
    } catch (err: any) {
      return adStoreFail(res, err);
    }
    adVerified = true;
  }

  const durationSec = systemSettings.miningDurationHours * 3600;
  const referralCount = Number((systemSettings as any).baseReferralBoostCount ?? 12);
  const boostPercent = calculateMiningBoost(referralCount);
  const effectiveMiningRate = Number((systemSettings.miningRatePerHour * (1 + boostPercent / 100)).toFixed(4));
  const estimatedReward = Number((effectiveMiningRate * systemSettings.miningDurationHours).toFixed(4));

  const session: MiningRecord = {
    id: `mine_${now}_${Math.random().toString(36).substring(2, 7)}`,
    userId,
    startTime: now,
    endTime: now + durationSec * 1000,
    durationSeconds: durationSec,
    miningRatePerHour: effectiveMiningRate,
    estimatedReward,
    status: 'ACTIVE',
    adVerified,
    adSessionId: adSessionId || '',
  };

  miningSessions.push(session);
  if (supabase) {
    try {
      // Finished-but-unclaimed sessions must not count as "active" (one ACTIVE session per user is enforced by a DB index)
      await supabase
        .from('mining_sessions')
        .update({ status: 'COMPLETED' })
        .eq('user_id', userId)
        .eq('status', 'ACTIVE')
        .lte('end_time', now);
      const { error: insErr } = await supabase.from('mining_sessions').insert({
        id: session.id,
        user_id: userId,
        start_time: session.startTime,
        end_time: session.endTime,
        duration_seconds: session.durationSeconds,
        mining_rate_per_hour: session.miningRatePerHour,
        estimated_reward: session.estimatedReward,
        status: session.status,
        ad_verified: session.adVerified,
        ad_session_id: session.adSessionId || '',
      });
      if (insErr) {
        if ((insErr as any).code === '23505') {
          // Another request already started mining for this user (one active session per user)
          const idx = miningSessions.indexOf(session);
          if (idx >= 0) miningSessions.splice(idx, 1);
          return res.status(400).json({ success: false, error: 'A mining session is already active' });
        }
        console.warn('[Supabase] Failed to persist mining session:', insErr.message);
      }
    } catch (e) {
      console.warn('[Supabase] Failed to persist mining session:', e);
    }
  }

  // Trusted Miner: 120 consecutive UTC days of mining => the account is verified automatically
  try { await evaluateTrustedMiner(userId, now); } catch (e) { console.warn('[TrustedMiner] check failed:', e); }

  // One-time 5 USDT Referral Bonus awarded to referrer when invited friend starts mining
  try {
    let miningUser = users.get(userId);
    if (!miningUser && supabase) {
      miningUser = (await getUserFromSupabase(userId)) || undefined;
    }
    const referrerId = miningUser?.referredBy;
    if (referrerId && referrerId !== userId) {
      // Check if bonus was already granted for this friend
      let refRecord = referralHistory.find(r => r.referredUserId === userId);
      let alreadyAwarded = Boolean(refRecord && (refRecord.rewardEarned > 0 || refRecord.status === 'QUALIFIED'));

      if (!alreadyAwarded && supabase) {
        try {
          const refereeTgId = miningUser?.telegramId || parseInt(userId.replace('usr_', '')) || 0;
          if (refereeTgId > 0) {
            const { data: dbRef } = await supabase
              .from('referrals')
              .select('*')
              .eq('referee_id', refereeTgId)
              .maybeSingle();
            if (dbRef && (Number(dbRef.bonus_amount) >= 5 || dbRef.status === 'QUALIFIED')) {
              alreadyAwarded = true;
              if (refRecord) {
                refRecord.status = 'QUALIFIED';
                refRecord.rewardEarned = Number(dbRef.bonus_amount) || 5;
              }
            }
          }
        } catch {}
      }

      if (!alreadyAwarded) {
        const bonusUSDT = systemSettings.referralBonusUSDT !== undefined ? systemSettings.referralBonusUSDT : 5.0;

        // 1. Credit referrer balance atomically
        const referrerBal = await getSupabaseBalance(referrerId);
        referrerBal.usdt = Number(((referrerBal.usdt || 0) + bonusUSDT).toFixed(6));
        balances.set(referrerId, referrerBal);
        await setSupabaseBalance(referrerId, referrerBal);

        // 2. Log financial transaction for referrer
        const friendName = miningUser?.firstName || 'Friend';
        const bonusTx: TxRecord = {
          id: `tx_ref_${Date.now()}_${userId}`,
          userId: referrerId,
          asset: 'USDT',
          amount: bonusUSDT,
          direction: 'IN',
          source: 'REFERRAL_BONUS',
          status: 'COMPLETED',
          timestamp: Date.now(),
          note: `Referral bonus: ${bonusUSDT} USDT credited as invited friend (${friendName}) started mining`,
        };
        await recordTransaction(bonusTx);

        // 3. Mark referral record as QUALIFIED so bonus is strictly given only once
        if (refRecord) {
          refRecord.status = 'QUALIFIED';
          refRecord.rewardEarned = bonusUSDT;
          refRecord.minedDays = Math.max(refRecord.minedDays || 0, 1);
        } else {
          referralHistory.push({
            id: `ref_${Date.now()}_${userId}`,
            referrerId,
            referredUserId: userId,
            referredUid: miningUser?.uid || '',
            referredName: friendName,
            timestamp: Date.now(),
            status: 'QUALIFIED',
            minedDays: 1,
            rewardEarned: bonusUSDT,
          });
        }

        // 4. Upsert into Supabase referrals table
        if (supabase) {
          try {
            const referrerTgId = parseInt(referrerId.replace('usr_', '')) || 0;
            const refereeTgId = miningUser?.telegramId || parseInt(userId.replace('usr_', '')) || 0;
            if (referrerTgId > 0 && refereeTgId > 0) {
              await supabase.from('referrals').upsert({
                referrer_id: referrerTgId,
                referee_id: refereeTgId,
                bonus_amount: bonusUSDT,
                status: 'QUALIFIED',
              }, { onConflict: 'referee_id' });
            }
          } catch (e) {
            console.warn('[Supabase] Failed to persist referral bonus to table:', e);
          }
        }
        console.log(`[Referral] Credited ${bonusUSDT} USDT to referrer ${referrerId} for friend ${userId} starting mining`);
      }
    }
  } catch (refBonusErr) {
    console.warn('[Referral] Error evaluating friend mining referral bonus:', refBonusErr);
  }

  scheduleSaveDatabase();

  res.json({
    success: true,
    session,
    serverTime: now,
  });
};

app.post('/api/mining/start', requireUserAuth, handleStartMining);
app.post('/api/start-mining', requireUserAuth, handleStartMining);

// Claim Mining Reward (Manual Claim after 8 Hours)
app.post('/api/mining/claim', requireUserAuth, async (req: Request, res: Response) => {
  const userId = String((req as any).verifiedUserId || '');
  const { sessionId } = req.body || {};
  const now = Date.now();
  if (!userId) return res.status(401).json({ success: false, error: 'Authentication required' });

  let session = miningSessions.find(s => s.id === sessionId && s.userId === userId);
  if (!session && supabase) {
    try {
      const { data: dbSession } = await supabase
        .from('mining_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('user_id', userId)
        .maybeSingle();
      if (dbSession) {
        session = {
          id: dbSession.id,
          userId: dbSession.user_id,
          startTime: Number(dbSession.start_time),
          endTime: Number(dbSession.end_time),
          durationSeconds: Number(dbSession.duration_seconds),
          miningRatePerHour: Number(dbSession.mining_rate_per_hour),
          estimatedReward: Number(dbSession.estimated_reward),
          status: dbSession.status as any,
          adVerified: Boolean(dbSession.ad_verified),
          adSessionId: dbSession.ad_session_id,
          claimedAt: dbSession.claimed_at ? Number(dbSession.claimed_at) : undefined,
        };
        miningSessions.push(session);
      }
    } catch {}
  }

  if (!session) {
    return res.status(404).json({ success: false, error: 'Mining session not found' });
  }

  if (session.status === 'CLAIMED') {
    return res.status(400).json({ success: false, error: 'Session reward has already been claimed' });
  }

  if (now < session.endTime) {
    const remainingSec = Math.ceil((session.endTime - now) / 1000);
    return res.status(400).json({ success: false, error: `Mining session still in progress. ${remainingSec}s remaining` });
  }

  // Atomic one-time claim marker in the database (works across serverless instances).
  // Only the request that flips the row from not-CLAIMED to CLAIMED may credit the reward.
  if (supabase) {
    try {
      const { data: flipped, error: flipErr } = await supabase
        .from('mining_sessions')
        .update({ status: 'CLAIMED', claimed_at: now })
        .eq('id', session.id)
        .eq('user_id', userId)
        .neq('status', 'CLAIMED')
        .select('id');
      if (flipErr) throw new Error(flipErr.message);
      if (!flipped || flipped.length === 0) {
        session.status = 'CLAIMED';
        return res.status(400).json({ success: false, error: 'Session reward has already been claimed' });
      }
    } catch (claimErr: any) {
      console.error('[Mining] atomic claim failed:', claimErr?.message || claimErr);
      return res.status(503).json({ success: false, error: 'Could not claim right now. Please try again.' });
    }
  }

  // Credit E4F to balance (Server Authoritative)
  const userBalance = await getSupabaseBalance(userId);
  if (!userBalance) {
    if (supabase) {
      try { await supabase.from('mining_sessions').update({ status: 'COMPLETED', claimed_at: null }).eq('id', session.id); } catch {}
    }
    return res.status(404).json({ success: false, error: 'User wallet balance not found' });
  }

  userBalance.e4f = Number((userBalance.e4f + session.estimatedReward).toFixed(6));
  session.status = 'CLAIMED';
  session.claimedAt = now;

  // Ledger entry
  const tx: TxRecord = {
    id: `tx_${now}_${Math.random().toString(36).substring(2, 7)}`,
    userId,
    asset: 'E4F',
    amount: session.estimatedReward,
    direction: 'IN',
    source: 'MINING_REWARD',
    status: 'COMPLETED',
    timestamp: now,
    referenceId: session.id,
    note: `8-Hour Session Mined (+${session.estimatedReward.toFixed(2)} E4F)`,
  };

  // Authoritative persistence to Supabase and disk
  await recordTransaction(tx);
  await setSupabaseBalance(userId, userBalance).catch(() => {});
  if (supabase) {
    try {
      await supabase.from('mining_sessions').update({ status: 'CLAIMED', claimed_at: now }).eq('id', session.id);
    } catch {}
  }
  scheduleSaveDatabase();

  res.json({
    success: true,
    rewardAmount: session.estimatedReward,
    asset: 'E4F',
    newBalance: userBalance.e4f,
    transaction: tx,
  });
});

// Mining History
app.get('/api/mining/:userId/history', requireUserAuth, (req: Request, res: Response) => {
  const { userId } = req.params;
  const history = miningSessions
    .filter(s => s.userId === userId)
    .sort((a, b) => b.startTime - a.startTime);
  res.json({ history });
});

// 4. Rewards API (/api/rewards)
// Daily Check-in (7-Day Consecutive Streak & Rewards Progression with Supabase e4f_daily_checkins)
app.get('/api/rewards/:userId/daily-checkin', requireUserAuth, async (req: Request, res: Response) => {
  const { userId } = req.params;
  const checkIn = await loadUserDailyCheckIn(userId);
  const { todayUtc, yesterdayUtc } = getUtcDates();

  const todayClaimed = Boolean(checkIn.lastDate && checkIn.lastDate === todayUtc);
  let nextDayToClaim = 1;
  let activeClaimedDays: number[] = [];

  const currentDay = checkIn.currentDay || checkIn.currentStreak || 0;

  if (todayClaimed) {
    activeClaimedDays = Array.from({ length: currentDay }, (_, i) => i + 1);
    nextDayToClaim = (currentDay % 7) + 1;
  } else if (checkIn.lastDate === yesterdayUtc) {
    if (currentDay >= 7) {
      nextDayToClaim = 1;
      activeClaimedDays = [];
    } else {
      nextDayToClaim = currentDay + 1;
      activeClaimedDays = Array.from({ length: currentDay }, (_, i) => i + 1);
    }
  } else {
    // Streak reset or new user
    nextDayToClaim = 1;
    activeClaimedDays = [];
  }

  const rewards = (systemSettings.dailyCheckInRewards && systemSettings.dailyCheckInRewards.length > 0)
    ? systemSettings.dailyCheckInRewards
    : defaultDailyCheckInRewards;

  res.json({
    currentStreak: currentDay,
    current_day: currentDay,
    streak_count: checkIn.streakCount || 0,
    todayClaimed,
    lastCheckInDate: checkIn.lastDate,
    last_claim_date: checkIn.lastDate,
    rewards,
    claimedDays: activeClaimedDays,
    nextDayToClaim,
  });
});

app.post('/api/rewards/daily-checkin/claim', requireUserAuth, async (req: Request, res: Response) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ success: false, error: 'User ID is required' });

  const checkIn = await loadUserDailyCheckIn(userId);
  const { todayUtc, yesterdayUtc } = getUtcDates();

  if (checkIn.lastDate === todayUtc) {
    const currentDay = checkIn.currentDay || checkIn.currentStreak || 1;
    return res.status(400).json({
      success: false,
      error: 'Daily check-in already claimed for today. Next reward available at 00:00 UTC.',
      todayClaimed: true,
      lastCheckInDate: todayUtc,
      last_claim_date: todayUtc,
      nextDayToClaim: (currentDay % 7) + 1,
    });
  }

  let targetDay = 1;
  let newStreak = 1;

  if (checkIn.lastDate === yesterdayUtc) {
    const prevDay = checkIn.currentDay || checkIn.currentStreak || 0;
    targetDay = (prevDay % 7) + 1;
    newStreak = (checkIn.streakCount || 0) + 1;
  } else {
    targetDay = 1;
    newStreak = 1;
  }

  // Update in-memory state immediately for instant response
  checkIn.currentDay = targetDay;
  checkIn.currentStreak = targetDay;
  checkIn.lastDate = todayUtc;
  checkIn.streakCount = newStreak;
  checkIn.claimedDays = Array.from({ length: targetDay }, (_, i) => i + 1);
  userDailyCheckIns.set(userId, checkIn);

  const rewards = (systemSettings.dailyCheckInRewards && systemSettings.dailyCheckInRewards.length > 0)
    ? systemSettings.dailyCheckInRewards
    : defaultDailyCheckInRewards;

  const reward = rewards.find(r => r.day === targetDay) || rewards[targetDay - 1] || rewards[0];

  let userBalance = balances.get(userId);
  if (!userBalance) {
    userBalance = await getSupabaseBalance(userId);
  }
  if (reward.asset === 'USDT') {
    userBalance.usdt = Math.round((userBalance.usdt + reward.amount) * 1000000) / 1000000;
  } else {
    userBalance.e4f = Math.round((userBalance.e4f + reward.amount) * 1000000) / 1000000;
  }
  balances.set(userId, userBalance);

  // Background persistence without blocking response
  if (supabase) {
    (supabase.from('e4f_daily_checkins').upsert({
      user_id: userId,
      current_day: targetDay,
      last_claim_date: todayUtc,
      streak_count: newStreak,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' }) as PromiseLike<any>).then(() => {}, (err: any) => {
      console.warn('[Supabase Checkin Error]:', err?.message);
    });
  }
  setSupabaseBalance(userId, userBalance).catch(() => {});

  const checkinTx: TxRecord = {
    id: `tx_${Date.now()}_checkin`,
    userId,
    asset: reward.asset,
    amount: reward.amount,
    direction: 'IN',
    source: 'DAILY_CHECKIN',
    status: 'COMPLETED',
    timestamp: Date.now(),
    note: `Day ${targetDay} Check-in Reward (+${reward.amount} ${reward.asset})`,
  };
  recordTransaction(checkinTx).catch(() => {});

  return res.json({
    success: true,
    current_day: targetDay,
    currentStreak: targetDay,
    streak: targetDay,
    streak_count: newStreak,
    reward,
    balances: userBalance,
    claimedDays: checkIn.claimedDays,
    todayClaimed: true,
    lastCheckInDate: todayUtc,
    last_claim_date: todayUtc,
    nextDayToClaim: (targetDay % 7) + 1,
  });
});

// Spin & Win Wheel (Server-Determined Result with Rewarded Ad Verification)
app.get('/api/rewards/:userId/spin-status', requireUserAuth, async (req: Request, res: Response) => {
  const { userId } = req.params;
  try {
    const maxSpins = spinMaxDaily();
    const used = await getDailySlots(userId, 'SPIN');
    const spinsUsed = Math.min(maxSpins, used.length);
    const spinsRemaining = Math.max(0, maxSpins - spinsUsed);
    const activePrizes = systemSettings.spinWheelPrizes && systemSettings.spinWheelPrizes.length > 0
      ? systemSettings.spinWheelPrizes
      : defaultSpinWheelPrizes;

    res.json({
      spinsUsed,
      maxSpins,
      spinsRemainingToday: spinsRemaining,
      nextSpinSlot: firstUnusedSlot(used, maxSpins) || null,
      adRequired: true,
      prizes: activePrizes,
      zoneId: resolveAdId('SPIN', 2),
      provider: 'RichAds',
    });
  } catch (err: any) {
    return adStoreFail(res, err);
  }
});

app.post(['/api/rewards/spin', '/api/rewards/spin/claim', '/rewards/spin', '/rewards/spin/claim'], requireUserAuth, async (req: Request, res: Response) => {
  const userId = String((req as any).verifiedUserId || '');
  const { adSessionId, claimToken } = req.body || {};
  if (!userId) return res.status(401).json({ success: false, error: 'Authentication required' });

  try {
    // 1. Daily limit (durable) and the slot this spin belongs to
    const maxSpins = spinMaxDaily();
    const used = await getDailySlots(userId, 'SPIN');
    const slot = firstUnusedSlot(used, maxSpins);
    if (!slot) {
      return res.status(400).json({
        success: false,
        error: `Daily spin limit of ${maxSpins} reached. Resets tomorrow at 00:00 UTC.`,
        spinsRemainingToday: 0,
      });
    }

    // 2. A finished rewarded ad of THIS slot is ALWAYS required (cannot be switched off)
    if (!adSessionId || !claimToken) {
      return res.status(403).json({
        success: false,
        error: 'Spin locked. Rewarded ad completion is strictly required for each spin.',
      });
    }
    const redeemed = await redeemAdClaim(userId, adSessionId, claimToken, 'SPIN', slot);
    if (!redeemed.ok) {
      return res.status(redeemed.status || 403).json({ success: false, error: redeemed.error || 'Ad verification failed' });
    }

    // 3. Claim the slot atomically (a duplicate / parallel request loses here and gets nothing)
    if (!(await claimDailySlot(userId, 'SPIN', slot))) {
      return res.status(409).json({ success: false, error: 'This spin has already been used.' });
    }

    // 4. Reward
    const userBalance = await getSupabaseBalance(userId);
    if (!userBalance) return res.status(404).json({ success: false, error: 'User not found' });

    const spinsUsedToday = used.length + 1;
    const spinsRemainingToday = Math.max(0, maxSpins - spinsUsedToday);

    const activePrizes = systemSettings.spinWheelPrizes && systemSettings.spinWheelPrizes.length > 0
      ? systemSettings.spinWheelPrizes
      : defaultSpinWheelPrizes;

    const selectedIndex = crypto.randomInt(0, activePrizes.length);
    const prize = activePrizes[selectedIndex];

    if (prize.asset === 'USDT') {
      userBalance.usdt += prize.amount;
    } else {
      userBalance.e4f += prize.amount;
    }

    const tx: TxRecord = {
      id: `tx_${Date.now()}_spin`,
      userId,
      asset: prize.asset,
      amount: prize.amount,
      direction: 'IN',
      source: 'SPIN_REWARD',
      status: 'COMPLETED',
      timestamp: Date.now(),
      note: `Spin & Win Prize: ${prize.label} (${spinsUsedToday}/${maxSpins})`,
    };
    await recordTransaction(tx);
    await setSupabaseBalance(userId, userBalance).catch(() => {});
    scheduleSaveDatabase();

    return res.json({
      success: true,
      prizeIndex: selectedIndex,
      prize,
      balances: userBalance,
      transaction: tx,
      spinsRemainingToday,
      spinsUsedToday,
    });
  } catch (err: any) {
    return adStoreFail(res, err);
  }
});

app.get('/api/rewards/:userId/gift-boxes', requireUserAuth, async (req: Request, res: Response) => {
  const { userId } = req.params;
  try {
    const maxBoxes = boxMaxDaily();
    const opened = await getDailySlots(userId, 'GIFT_BOX');
    const boxesRemainingToday = Math.max(0, maxBoxes - opened.length);
    const canOpenToday = opened.length < maxBoxes;

    const activeBoxConfigs = systemSettings.giftBoxesConfig && systemSettings.giftBoxesConfig.length > 0
      ? systemSettings.giftBoxesConfig
      : defaultGiftBoxesConfig;

    const boxes = activeBoxConfigs.map((cfg, idx) => {
      const boxId = cfg.id || (idx + 1);
      return {
        id: boxId,
        boxNumber: cfg.boxNumber || (idx + 1),
        name: cfg.name,
        rewardAsset: cfg.rewardAsset,
        rewardAmount: cfg.rewardAmount,
        color: cfg.color || '#38BDF8',
        isOpened: opened.includes(Number(boxId)),
      };
    });

    res.json({
      boxes,
      canOpenToday,
      boxesUsedToday: opened.length,
      maxDailyBoxes: maxBoxes,
      boxesRemainingToday,
      adRequired: true,
      zoneId: resolveAdId('GIFT_BOX', 2),
      provider: 'RichAds',
    });
  } catch (err: any) {
    return adStoreFail(res, err);
  }
});

app.post(['/api/rewards/gift-box/open', '/api/rewards/gift-box/claim', '/rewards/gift-box/open', '/rewards/gift-box/claim'], requireUserAuth, async (req: Request, res: Response) => {
  const userId = String((req as any).verifiedUserId || '');
  const { boxId, adSessionId, claimToken } = req.body || {};
  if (!userId) return res.status(401).json({ success: false, error: 'Authentication required' });

  const numBoxId = Number(boxId);
  const maxBoxes = boxMaxDaily();
  if (!Number.isInteger(numBoxId) || numBoxId < 1 || numBoxId > maxBoxes) {
    return res.status(400).json({ success: false, error: 'Invalid gift box number' });
  }

  try {
    // 1. Durable daily limit
    const opened = await getDailySlots(userId, 'GIFT_BOX');
    if (opened.length >= maxBoxes) {
      return res.status(400).json({
        success: false,
        error: `Daily gift box limit of ${maxBoxes} reached. Resets at 00:00 UTC.`,
        boxesRemainingToday: 0,
      });
    }
    if (opened.includes(numBoxId)) {
      return res.status(400).json({
        success: false,
        error: `Gift Box #${numBoxId} has already been opened today. Resets at 00:00 UTC.`,
      });
    }

    // 2. A finished rewarded ad of THIS box slot is ALWAYS required
    if (!adSessionId || !claimToken) {
      return res.status(403).json({
        success: false,
        error: 'Box locked. Rewarded ad completion is strictly required to unlock this gift box.',
      });
    }
    const redeemed = await redeemAdClaim(userId, adSessionId, claimToken, 'GIFT_BOX', numBoxId);
    if (!redeemed.ok) {
      return res.status(redeemed.status || 403).json({ success: false, error: redeemed.error || 'Ad verification failed' });
    }

    // 3. Atomically claim this box for today
    if (!(await claimDailySlot(userId, 'GIFT_BOX', numBoxId))) {
      return res.status(409).json({ success: false, error: `Gift Box #${numBoxId} has already been opened today.` });
    }

    // 4. Reward
    const userBalance = await getSupabaseBalance(userId);
    if (!userBalance) return res.status(404).json({ success: false, error: 'User not found' });

    const activeBoxConfigs = systemSettings.giftBoxesConfig && systemSettings.giftBoxesConfig.length > 0
      ? systemSettings.giftBoxesConfig
      : defaultGiftBoxesConfig;

    const boxConfig = activeBoxConfigs.find(b => b.id === numBoxId) || activeBoxConfigs[numBoxId - 1] || {
      id: numBoxId,
      boxNumber: numBoxId,
      name: `Mystery Box #${numBoxId}`,
      rewardAsset: 'E4F' as const,
      rewardAmount: 2.5,
    };

    if (boxConfig.rewardAsset === 'USDT') {
      userBalance.usdt += boxConfig.rewardAmount;
    } else {
      userBalance.e4f += boxConfig.rewardAmount;
    }

    const boxesUsedToday = opened.length + 1;
    const tx: TxRecord = {
      id: `tx_${Date.now()}_box`,
      userId,
      asset: boxConfig.rewardAsset,
      amount: boxConfig.rewardAmount,
      direction: 'IN',
      source: 'GIFT_BOX_REWARD',
      status: 'COMPLETED',
      timestamp: Date.now(),
      note: `${boxConfig.name} Opened (+${boxConfig.rewardAmount} ${boxConfig.rewardAsset}) [${boxesUsedToday}/${maxBoxes}]`,
    };
    await recordTransaction(tx);
    await setSupabaseBalance(userId, userBalance).catch(() => {});
    scheduleSaveDatabase();

    return res.json({
      success: true,
      box: { ...boxConfig, isOpened: true },
      rewardAmount: boxConfig.rewardAmount,
      rewardAsset: boxConfig.rewardAsset,
      balances: userBalance,
      boxesRemainingToday: Math.max(0, maxBoxes - boxesUsedToday),
      boxesUsedToday,
      maxDailyBoxes: maxBoxes,
    });
  } catch (err: any) {
    return adStoreFail(res, err);
  }
});

// 5. Tasks API (/api/tasks)
// ---------------------------------------------------------------------
// Persistent admin content (notices + tasks). Vercel serverless keeps no
// memory between requests, so admin-created notices/tasks are stored in
// Supabase (table e4f_content) and loaded into the arrays on each request.
// ---------------------------------------------------------------------
let contentLoadedAt = 0;
async function loadAdminContent(force = false) {
  if (!supabase) return;
  if (!force && Date.now() - contentLoadedAt < 4000) return;
  try {
    const { data, error } = await supabase.from('e4f_content').select('key,value').in('key', ['announcements', 'dynamic_tasks', 'task_queue']);
    if (error) return;
    for (const row of data || []) {
      if (!Array.isArray(row.value)) continue;
      if (row.key === 'announcements') { announcements.splice(0, announcements.length, ...row.value); }
      if (row.key === 'dynamic_tasks') { dynamicTasks.splice(0, dynamicTasks.length, ...row.value); }
      if (row.key === 'task_queue') { taskSubmissionsQueue.splice(0, taskSubmissionsQueue.length, ...row.value); }
    }
    contentLoadedAt = Date.now();
  } catch {}
}
async function saveAdminContent(): Promise<boolean> {
  if (!supabase) return true;
  try {
    const now = new Date().toISOString();
    const { error } = await supabase.from('e4f_content').upsert([
      { key: 'announcements', value: announcements, updated_at: now },
      { key: 'dynamic_tasks', value: dynamicTasks, updated_at: now },
      { key: 'task_queue', value: taskSubmissionsQueue.slice(0, 500), updated_at: now },
    ], { onConflict: 'key' });
    if (error) { console.error('[content] save failed', error.message); return false; }
    contentLoadedAt = Date.now();
    return true;
  } catch (e) { console.error('[content] save failed', e); return false; }
}
// Real membership check for Telegram channel/group tasks (needs the bot to be an admin of that chat).
// Returns 'member' | 'not_member' | 'unknown' (unknown = cannot be verified automatically).
async function verifyTelegramMembership(taskUrl: string, telegramUserId: number): Promise<'member' | 'not_member' | 'unknown'> {
  try {
    if (!TELEGRAM_BOT_TOKEN || !telegramUserId) return 'unknown';
    const m = String(taskUrl || '').match(/^https?:\/\/(?:t|telegram)\.me\/([A-Za-z][A-Za-z0-9_]{3,})\/?$/i);
    if (!m) return 'unknown';
    const chat = '@' + m[1];
    const r = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getChatMember?chat_id=${encodeURIComponent(chat)}&user_id=${telegramUserId}`,
      { signal: AbortSignal.timeout(5000) }
    );
    const j: any = await r.json().catch(() => null);
    if (!j || !j.ok) return 'unknown';
    const st = String(j.result?.status || '');
    if (st === 'member' || st === 'administrator' || st === 'creator') return 'member';
    if (st === 'restricted') return j.result?.is_member ? 'member' : 'not_member';
    if (st === 'left' || st === 'kicked') return 'not_member';
    return 'unknown';
  } catch { return 'unknown'; }
}
// One-time task reward guard (durable): PK (user_id, task_id) in e4f_task_claims.
async function claimTaskOnce(userId: string, taskId: string): Promise<boolean> {
  if (!supabase) return !isProduction;
  const { error } = await supabase.from('e4f_task_claims').insert({ user_id: userId, task_id: taskId });
  if (!error) return true;
  if ((error as any).code === '23505') return false;
  throw new Error('task-claim-store: ' + error.message);
}
// Rebuild this user's task statuses from the database (works on any serverless instance).
async function hydrateUserTasks(userId: string) {
  if (!supabase) return;
  try {
    const list: Array<{ taskId: string; status: string; proof?: string; timestamp: number }> = [];
    const { data } = await supabase.from('e4f_task_claims').select('task_id,claimed_at').eq('user_id', userId);
    for (const r of data || []) list.push({ taskId: r.task_id, status: 'APPROVED', timestamp: Date.parse(r.claimed_at) || Date.now() });
    for (const q of taskSubmissionsQueue) {
      if (q.userId !== userId || list.some(x => x.taskId === q.taskId)) continue;
      list.push({ taskId: q.taskId, status: q.status, proof: q.proof, timestamp: q.timestamp });
    }
    userTaskSubmissions.set(userId, list);
  } catch {}
}
app.use(['/api/announcements', '/api/tasks', '/api/admin/announcements', '/api/admin/tasks', '/api/admin/task-submissions'], async (req: Request, res: Response, next: NextFunction) => {
  await loadAdminContent(req.method !== 'GET');
  if (req.method !== 'GET' && req.method !== 'OPTIONS' && (req.originalUrl.startsWith('/api/admin/') || req.originalUrl.startsWith('/api/tasks/submit'))) {
    // Answer only after the change is stored in the database, so an admin never sees a fake "saved".
    const origJson = res.json.bind(res);
    (res as any).json = (body: any) => {
      if (res.statusCode >= 400) return origJson(body);
      saveAdminContent().then((ok) => {
        if (ok) return origJson(body);
        res.status(500);
        return origJson({ success: false, error: 'Could not save to the database. Run the latest SQL file in Supabase (e4f_content table) and try again.' });
      });
      return res;
    };
  }
  next();
});

app.get('/api/tasks/:userId', requireUserAuth, async (req: Request, res: Response) => {
  const { userId } = req.params;
  await hydrateUserTasks(userId);
  const userSubs = userTaskSubmissions.get(userId) || [];

  const tasksWithStatus = dynamicTasks.map(t => {
    const sub = userSubs.find(s => s.taskId === t.id);
    const timerKey = `${userId}_${t.id}`;
    const activeTimer = activeTaskTimers.get(timerKey);
    const isCompleted = sub?.status === 'APPROVED';

    return {
      ...t,
      status: sub ? sub.status : 'AVAILABLE',
      isCompleted,
      submittedProof: sub?.proof,
      timerActive: !!activeTimer,
      timerStartTime: activeTimer?.startTime,
    };
  });

  res.json({ tasks: tasksWithStatus });
});

// Start Website / Video Task Timer
app.post('/api/tasks/start-timer', requireUserAuth, (req: Request, res: Response) => {
  const { userId, taskId, accumulatedSeconds } = req.body;
  const timerOwner = String((req as any).verifiedUserId || userId);
  const task = dynamicTasks.find(t => t.id === taskId);
  if (!task) return res.status(404).json({ success: false, error: 'Task not found' });
  if (task.verificationMethod !== 'TIMER' && (!task.durationSeconds || task.durationSeconds <= 0)) {
    return res.status(400).json({ success: false, error: 'This task does not use timer verification' });
  }

  const durationSeconds = Math.max(5, task.durationSeconds || 30);
  const timerKey = `${userId}_${taskId}`;
  const existing = activeTaskTimers.get(timerKey);
  const acc = typeof accumulatedSeconds === 'number' && !isNaN(accumulatedSeconds)
    ? Math.max(0, Math.min(durationSeconds, accumulatedSeconds))
    : (existing?.accumulatedSeconds || 0);

  activeTaskTimers.set(timerKey, {
    startTime: Date.now(),
    accumulatedSeconds: acc,
    durationSeconds,
  });

  // Stateless proof of when the task was FIRST opened (survives serverless instance changes)
  const prevTimer = adVerify('timer', req.body?.timerToken);
  const prevOk = !!(prevTimer && prevTimer.uid === timerOwner && prevTimer.tid === taskId);
  const firstStart = prevOk ? Number(prevTimer!.fs) : Date.now();
  const strict = systemSettings.strictTaskTimer !== false;
  // Strict mode: counted time lives ONLY inside the signed token and only grows through
  // /api/tasks/timer-ping while the user is really on the task. The client value is ignored.
  const countedSec = prevOk ? Math.max(0, Math.min(durationSeconds, Number(prevTimer!.acc) || 0)) : 0;
  const timerToken = adSign('timer', { uid: timerOwner, tid: taskId, fs: firstStart, acc: countedSec, ls: Date.now() });

  res.json({
    success: true,
    timerToken,
    strict,
    startTime: Date.now(),
    durationSeconds,
    accumulatedSeconds: strict ? Math.floor(countedSec) : acc,
    url: (task as any).actionUrl || task.url,
  });
});

// Timer heartbeat: the server only counts time while the app keeps pinging (app visible).
// If the user leaves, switches tab, or closes/kills the app, pings stop and the timer stalls.
const TIMER_PING_MAX_GAP_SEC = 15;
app.post('/api/tasks/timer-ping', requireUserAuth, (req: Request, res: Response) => {
  const { userId, taskId } = req.body || {};
  const owner = String((req as any).verifiedUserId || userId);
  const task = dynamicTasks.find(t => t.id === taskId);
  if (!task) return res.status(404).json({ success: false, error: 'Task not found' });
  const requiredSeconds = Math.max(5, task.durationSeconds || 30);
  const tt = adVerify('timer', req.body?.timerToken);
  if (!tt || tt.uid !== owner || tt.tid !== taskId) {
    return res.status(400).json({ success: false, error: 'Timer not started. Please start the task again.' });
  }
  const now = Date.now();
  const ls = Number(tt.ls) || 0;
  let acc = Math.max(0, Math.min(requiredSeconds, Number(tt.acc) || 0));
  const gap = ls > 0 ? (now - ls) / 1000 : 0;
  // credit only continuous activity; a longer silence means the user was away -> no credit
  if (ls > 0 && gap >= 0 && gap <= TIMER_PING_MAX_GAP_SEC) acc = Math.min(requiredSeconds, acc + gap);
  const paused = req.body?.pause === true;
  const timerToken = adSign('timer', { uid: owner, tid: taskId, fs: Number(tt.fs) || now, acc, ls: paused ? 0 : now });
  res.json({
    success: true,
    timerToken,
    strict: systemSettings.strictTaskTimer !== false,
    durationSeconds: requiredSeconds,
    accumulatedSeconds: Math.floor(acc),
    remainingSeconds: Math.max(0, Math.ceil(requiredSeconds - acc)),
    done: acc >= requiredSeconds - 1,
  });
});

// Verify Website / Video Task Timer
app.post('/api/tasks/verify-timer', requireUserAuth, async (req: Request, res: Response) => {
  const { userId, taskId, accumulatedSeconds } = req.body;
  const user = await getUserFromSupabase(userId);
  const userBalance = await getSupabaseBalance(userId);
  if (!user || !userBalance) return res.status(404).json({ success: false, error: 'User not found' });

  const task = dynamicTasks.find(t => t.id === taskId);
  if (!task) return res.status(404).json({ success: false, error: 'Task not found' });

  if (task.verificationMethod === 'MANUAL') {
    return res.status(400).json({ success: false, error: 'This task needs admin review. Submit your proof instead.' });
  }
  const timerKey = `${userId}_${taskId}`;
  const requiredSeconds = Math.max(5, task.durationSeconds || 30);
  const tt = adVerify('timer', req.body?.timerToken);
  if (!tt || tt.uid !== String((req as any).verifiedUserId || userId) || tt.tid !== taskId) {
    return res.status(400).json({ success: false, error: 'Start the task first, then wait for the timer to finish.', remainingSeconds: requiredSeconds });
  }
  const strictMode = systemSettings.strictTaskTimer !== false;
  const waitedSeconds = strictMode ? (Number(tt.acc) || 0) : (Date.now() - Number(tt.fs)) / 1000;
  if (waitedSeconds < requiredSeconds - 1) {
    const remaining = Math.max(1, Math.ceil(requiredSeconds - waitedSeconds));
    return res.status(400).json({
      success: false,
      error: `Time not completed. ${requiredSeconds}s of active time required (${remaining}s remaining). Leaving the app pauses the timer.`,
      remainingSeconds: remaining,
      accumulatedSeconds: Math.floor(waitedSeconds),
    });
  }

  // Timer verified!
  activeTaskTimers.delete(timerKey);

  await hydrateUserTasks(userId);
  try {
    if (!(await claimTaskOnce(userId, taskId))) {
      return res.status(400).json({ success: false, error: 'Task already completed and rewarded' });
    }
  } catch (e) { return res.status(503).json({ success: false, error: 'Temporary storage error. Please try again.' }); }

  let userSubs = userTaskSubmissions.get(userId);
  if (!userSubs) {
    userSubs = [];
    userTaskSubmissions.set(userId, userSubs);
  }

  const existing = userSubs.find(s => s.taskId === taskId);
  if (existing && existing.status === 'APPROVED') {
    return res.status(400).json({ success: false, error: 'Task already completed and rewarded' });
  }

  if (existing) {
    existing.status = 'APPROVED';
  } else {
    userSubs.push({ taskId, status: 'APPROVED', timestamp: Date.now() });
  }

  if (task.rewardAsset === 'USDT') {
    userBalance.usdt = Number((userBalance.usdt + task.rewardAmount).toFixed(6));
  } else {
    userBalance.e4f = Number((userBalance.e4f + task.rewardAmount).toFixed(6));
  }

  const tx: TxRecord = {
    id: `tx_${Date.now()}_task`,
    userId,
    asset: task.rewardAsset as 'USDT' | 'E4F',
    amount: task.rewardAmount,
    direction: 'IN',
    source: 'TASK_REWARD',
    status: 'COMPLETED',
    timestamp: Date.now(),
    note: `Website Visit Completed: ${task.title} (${requiredSeconds}s verified)`,
  };
  await recordTransaction(tx);
  await setSupabaseBalance(userId, userBalance).catch(() => {});
  scheduleSaveDatabase();

  res.json({
    success: true,
    status: 'APPROVED',
    reward: task.rewardAmount,
    asset: task.rewardAsset,
    balances: userBalance,
  });
});

app.post('/api/tasks/submit', requireUserAuth, async (req: Request, res: Response) => {
  const { userId, taskId, proof, usernameOrLink, screenshot, description } = req.body;
  const user = await getUserFromSupabase(userId);
  const userBalance = await getSupabaseBalance(userId);
  if (!user || !userBalance) return res.status(404).json({ success: false, error: 'User not found' });

  const task = dynamicTasks.find(t => t.id === taskId);
  if (!task) return res.status(404).json({ success: false, error: 'Task not found' });

  await hydrateUserTasks(userId);
  let userSubs = userTaskSubmissions.get(userId);
  if (!userSubs) {
    userSubs = [];
    userTaskSubmissions.set(userId, userSubs);
  }

  const existing = userSubs.find(s => s.taskId === taskId);
  if (existing && existing.status === 'APPROVED') {
    return res.status(400).json({ success: false, error: 'Task already completed and rewarded' });
  }
  if (existing && existing.status === 'SUBMITTED') {
    return res.status(400).json({ success: false, error: 'Your proof is already waiting for admin review.' });
  }

  const primaryProof = String(usernameOrLink || proof || '').trim().slice(0, 500);
  if (screenshot && String(screenshot).length > 400000) {
    return res.status(413).json({ success: false, error: 'Screenshot is too large. Please upload a smaller image.' });
  }

  // AUTO tasks are paid ONLY when the app can really verify them (Telegram channel/group membership).
  // Anything that cannot be verified automatically goes to the admin review queue instead of paying instantly.
  let autoVerified = false;
  if (task.verificationMethod === 'AUTO') {
    const tgId = Number((user as any).telegramId) || parseInt(String(userId).replace('usr_', '')) || 0;
    const member = await verifyTelegramMembership(task.url, tgId);
    if (member === 'not_member') {
      return res.status(400).json({ success: false, error: 'Please join first, then try again. We could not find you in the channel.' });
    }
    autoVerified = member === 'member';
  }

  if (task.verificationMethod === 'AUTO' && autoVerified) {
    try {
      if (!(await claimTaskOnce(userId, taskId))) {
        return res.status(400).json({ success: false, error: 'Task already completed and rewarded' });
      }
    } catch (e) { return res.status(503).json({ success: false, error: 'Temporary storage error. Please try again.' }); }
    if (existing) {
      existing.status = 'APPROVED';
    } else {
      userSubs.push({ taskId, status: 'APPROVED', proof: primaryProof, timestamp: Date.now() });
    }

    if (task.rewardAsset === 'USDT') {
      userBalance.usdt = Number((userBalance.usdt + task.rewardAmount).toFixed(6));
    } else {
      userBalance.e4f = Number((userBalance.e4f + task.rewardAmount).toFixed(6));
    }

    const tx: TxRecord = {
      id: `tx_${Date.now()}_task`,
      userId,
      asset: task.rewardAsset as 'USDT' | 'E4F',
      amount: task.rewardAmount,
      direction: 'IN',
      source: 'TASK_REWARD',
      status: 'COMPLETED',
      timestamp: Date.now(),
      note: `Task Reward: ${task.title}`,
    };
    await recordTransaction(tx);
    await setSupabaseBalance(userId, userBalance).catch(() => {});
    scheduleSaveDatabase();

    return res.json({ success: true, status: 'APPROVED', reward: task.rewardAmount, asset: task.rewardAsset, balances: userBalance });
  } else {
    if (existing) {
      existing.status = 'SUBMITTED';
      existing.proof = primaryProof;
    } else {
      userSubs.push({ taskId, status: 'SUBMITTED', proof: primaryProof, timestamp: Date.now() });
    }

    // Add to admin review queue
    const subRecord: TaskSubmissionRecord = {
      id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId,
      userUid: user.uid || userId,
      taskId: task.id,
      taskTitle: task.title,
      proof: primaryProof,
      usernameOrLink: primaryProof,
      screenshot: screenshot ? String(screenshot) : undefined,
      description: description ? String(description).trim().slice(0, 1000) : undefined,
      status: 'SUBMITTED',
      rewardAmount: task.rewardAmount,
      rewardAsset: task.rewardAsset,
      timestamp: Date.now(),
    };
    taskSubmissionsQueue.unshift(subRecord);
    scheduleSaveDatabase();

    return res.json({ success: true, status: 'SUBMITTED', message: 'Submitted successfully. The reward is added after admin review.' });
  }
});

// 6. Referral API (/api/referrals)
app.get('/api/referrals/:userId', requireUserAuth, async (req: Request, res: Response) => {
  const { userId } = req.params;
  const user = await getUserFromSupabase(userId);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });

  // Permanent Referrals: Never filtered or deleted, stored permanently for life!
  let dbReferrals: any[] = [];
  let dbInvitedUsers: any[] = [];
  if (supabase) {
    try {
      const tgId = user.telegramId;
      const { data, error } = await supabase
        .from('referrals')
        .select('*')
        .eq('referrer_id', tgId);
      if (!error && Array.isArray(data)) {
        dbReferrals = data;
      }
    } catch (err) {
      console.warn('[Supabase] Warning fetching referrals from DB:', err);
    }

    try {
      const tgId = user.telegramId;
      const refCode = user.referralCode || 'NO_CODE';
      const { data, error } = await supabase
        .from('users')
        .select('id, uid, telegram_id, first_name, username, created_at')
        .or(`referred_by.eq.${userId},referred_by.eq.${refCode},referred_by.eq.${tgId}`);
      if (!error && Array.isArray(data)) {
        dbInvitedUsers = data;
      }
    } catch (err: any) {
      console.warn('[Supabase] Warning fetching invited users from users table:', err?.message);
    }
  }

  const userReferrals = referralHistory.filter(r => r.referrerId === userId);
  const directInvitedUsers = Array.from(users.values()).filter(
    u => u.id !== userId && (
      u.referredBy === userId ||
      (user.referralCode && u.referredBy === user.referralCode) ||
      (user.telegramId && u.referredBy === String(user.telegramId))
    )
  );

  // 100% Real User Referral Stats (zero fake/demo numbers)
  const totalInvited = Math.max(userReferrals.length, directInvitedUsers.length, dbReferrals.length, dbInvitedUsers.length);
  const qualified = userReferrals.filter(r => r.status === 'QUALIFIED').length;
  const active = Math.max(0, totalInvited - qualified);
  const pending = 0;
  const totalEarnedUSDT = qualified * systemSettings.referralBonusUSDT;

  if (user.telegramId === 8827675419 || userId === 'usr_8827675419') {
    user.referralCode = 'E4F786112';
  } else if (!user.referralCode || user.referralCode === 'E4F-REF' || user.referralCode === 'E4F-VIP888') {
    user.referralCode = generateUniqueReferralCode(user.telegramId);
    syncUserToSupabase(user).catch(() => {});
  }

  const combinedHistory = [...userReferrals];
  if (combinedHistory.length === 0 && dbInvitedUsers.length > 0) {
    for (const inv of dbInvitedUsers) {
      combinedHistory.push({
        id: `ref_${inv.id}`,
        referrerId: userId,
        referredUserId: inv.id,
        referredUid: inv.uid || `8${Math.abs((inv.telegram_id || 0) % 8999999 + 1000000)}`,
        referredName: inv.first_name || 'E4F Miner',
        timestamp: inv.created_at ? new Date(inv.created_at).getTime() : Date.now(),
        status: 'ACTIVE',
        minedDays: 1,
        rewardEarned: 0,
      });
    }
  }

  res.json({
    referralCode: user.referralCode,
    referralLink: `https://t.me/E4F_Web3_mining_bot/app?startapp=${user.referralCode}`,
    totalInvited,
    qualified,
    active,
    pending,
    totalEarnedUSDT,
    referralRewardAmount: systemSettings.referralBonusUSDT,
    qualificationCriteria: `Invited friend starting mining qualifies for a one-time ${systemSettings.referralBonusUSDT} USDT bonus.`,
    history: combinedHistory.slice(0, 50),
  });
});

// 7. Market & Asset API (/api/market)
// Pre-listing Rule: E4F price is ALWAYS null, value: '—'
app.get('/api/market/assets', (req: Request, res: Response) => {
  const assets = [
    {
      symbol: 'E4F/USDT',
      baseAsset: 'E4F',
      quoteAsset: 'USDT',
      name: 'E4F Token',
      isListed: false,
      price: null,
      priceChangePercent24h: null,
      high24h: null,
      low24h: null,
      volume24h: null,
      icon: '/e4f_coin.jpg',
      statusText: 'NOT LISTED YET',
      plannedListingDate: systemSettings.e4fPlannedListingDate,
      plannedTargetPriceRange: systemSettings.e4fPlannedTargetPriceRange,
    },
    {
      symbol: 'BTC/USDT',
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
      name: 'Bitcoin',
      isListed: true,
      price: marketCache['BTC/USDT'].price,
      priceChangePercent24h: marketCache['BTC/USDT'].change24h,
      high24h: marketCache['BTC/USDT'].high24h,
      low24h: marketCache['BTC/USDT'].low24h,
      volume24h: marketCache['BTC/USDT'].volume24h,
      icon: 'https://cryptologos.cc/logos/bitcoin-btc-logo.svg?v=040',
    },
    {
      symbol: 'ETH/USDT',
      baseAsset: 'ETH',
      quoteAsset: 'USDT',
      name: 'Ethereum',
      isListed: true,
      price: marketCache['ETH/USDT'].price,
      priceChangePercent24h: marketCache['ETH/USDT'].change24h,
      high24h: marketCache['ETH/USDT'].high24h,
      low24h: marketCache['ETH/USDT'].low24h,
      volume24h: marketCache['ETH/USDT'].volume24h,
      icon: 'https://cryptologos.cc/logos/ethereum-eth-logo.svg?v=040',
    },
    {
      symbol: 'SOL/USDT',
      baseAsset: 'SOL',
      quoteAsset: 'USDT',
      name: 'Solana',
      isListed: true,
      price: marketCache['SOL/USDT'].price,
      priceChangePercent24h: marketCache['SOL/USDT'].change24h,
      high24h: marketCache['SOL/USDT'].high24h,
      low24h: marketCache['SOL/USDT'].low24h,
      volume24h: marketCache['SOL/USDT'].volume24h,
      icon: 'https://cryptologos.cc/logos/solana-sol-logo.svg?v=040',
    },
    {
      symbol: 'BNB/USDT',
      baseAsset: 'BNB',
      quoteAsset: 'USDT',
      name: 'BNB Chain',
      isListed: true,
      price: marketCache['BNB/USDT'].price,
      priceChangePercent24h: marketCache['BNB/USDT'].change24h,
      high24h: marketCache['BNB/USDT'].high24h,
      low24h: marketCache['BNB/USDT'].low24h,
      volume24h: marketCache['BNB/USDT'].volume24h,
      icon: 'https://cryptologos.cc/logos/bnb-bnb-logo.svg?v=040',
    },
    {
      symbol: 'XRP/USDT',
      baseAsset: 'XRP',
      quoteAsset: 'USDT',
      name: 'XRP',
      isListed: true,
      price: marketCache['XRP/USDT'].price,
      priceChangePercent24h: marketCache['XRP/USDT'].change24h,
      high24h: marketCache['XRP/USDT'].high24h,
      low24h: marketCache['XRP/USDT'].low24h,
      volume24h: marketCache['XRP/USDT'].volume24h,
      icon: 'https://cryptologos.cc/logos/xrp-xrp-logo.svg?v=040',
    },
  ];

  res.json({ assets, serverTime: Date.now() });
});

// Candlestick Data Generation based on Real Live/Cached Price
app.get('/api/market/klines', (req: Request, res: Response) => {
  const pair = (req.query.pair as string) || 'BTC/USDT';
  const timeframe = (req.query.timeframe as string) || '15m';

  if (pair.startsWith('E4F')) {
    return res.status(400).json({ error: 'E4F is not listed yet. No market data available.' });
  }

  const ticker = marketCache[pair] || marketCache['BTC/USDT'];
  const basePrice = ticker.price;
  const count = 30;
  const klines = [];
  const now = Math.floor(Date.now() / 60000) * 60000;
  const intervalMs = timeframe === '1m' ? 60000 : timeframe === '5m' ? 300000 : timeframe === '15m' ? 900000 : 3600000;

  let currentClose = basePrice * 0.98;
  for (let i = count - 1; i >= 0; i--) {
    const time = now - i * intervalMs;
    const volatility = basePrice * 0.0035;
    const delta = (Math.sin(i * 0.4) + (Math.random() - 0.48)) * volatility;
    const open = currentClose;
    const close = i === 0 ? basePrice : Math.max(1, open + delta);
    const high = Math.max(open, close) + Math.random() * (volatility * 0.8);
    const low = Math.min(open, close) - Math.random() * (volatility * 0.8);
    const volume = Math.round((Math.random() * 5 + 1) * (basePrice > 1000 ? 2 : 500));
    klines.push({ time, open, high, low, close, volume });
    currentClose = close;
  }

  res.json({ pair, timeframe, klines });
});

// Live Order Book
app.get('/api/market/orderbook', (req: Request, res: Response) => {
  const pair = (req.query.pair as string) || 'BTC/USDT';
  if (pair.startsWith('E4F')) {
    return res.status(400).json({ error: 'E4F is not listed yet. Order book unavailable.' });
  }

  const ticker = marketCache[pair] || marketCache['BTC/USDT'];
  const p = ticker.price;
  const step = p * 0.0002;

  const bids = [];
  const asks = [];
  let cumBid = 0;
  let cumAsk = 0;

  for (let i = 1; i <= 8; i++) {
    const bPrice = Number((p - i * step).toFixed(2));
    const bAmt = Number((Math.random() * 0.8 + 0.1).toFixed(4));
    cumBid += bAmt;
    bids.push({ price: bPrice, amount: bAmt, total: Number(cumBid.toFixed(4)) });

    const aPrice = Number((p + i * step).toFixed(2));
    const aAmt = Number((Math.random() * 0.8 + 0.1).toFixed(4));
    cumAsk += aAmt;
    asks.push({ price: aPrice, amount: aAmt, total: Number(cumAsk.toFixed(4)) });
  }

  res.json({
    pair,
    lastPrice: p,
    spread: Number((asks[0].price - bids[0].price).toFixed(2)),
    bids,
    asks: asks.reverse(),
  });
});

// 8. Spot Trading Engine (/api/trade/order)
app.post('/api/trade/order', requireUserAuth, async (req: Request, res: Response) => {
  const { userId, pair, side, type, price, amount } = req.body;
  if (pair.startsWith('E4F')) {
    return res.status(400).json({ success: false, error: 'E4F is not listed yet. Trading unavailable.' });
  }

  let userBalance = balances.get(userId);
  if (!userBalance) {
    userBalance = await getSupabaseBalance(userId);
  }

  const ticker = marketCache[pair];
  if (!ticker) return res.status(400).json({ success: false, error: 'Unsupported trading pair' });

  const executionPrice = type === 'MARKET' ? ticker.price : Number(price);
  const totalCostUSDT = executionPrice * Number(amount);

  if (side === 'BUY') {
    if (userBalance.usdt < totalCostUSDT) {
      return res.status(400).json({ success: false, error: `Insufficient USDT balance. Available: ${userBalance.usdt.toFixed(2)} USDT, Required: ${totalCostUSDT.toFixed(2)} USDT` });
    }
    userBalance.usdt = Number(Math.max(0, userBalance.usdt - totalCostUSDT).toFixed(4));
    if (pair === 'BTC/USDT') userBalance.btc = Number((userBalance.btc + Number(amount)).toFixed(6));
    if (pair === 'ETH/USDT') userBalance.eth = Number((userBalance.eth + Number(amount)).toFixed(6));
    if (pair === 'SOL/USDT') userBalance.sol = Number((userBalance.sol + Number(amount)).toFixed(6));
    if (pair === 'BNB/USDT') userBalance.bnb = Number((userBalance.bnb + Number(amount)).toFixed(6));
  } else {
    // SELL
    let userCoinAmt = 0;
    if (pair === 'BTC/USDT') userCoinAmt = userBalance.btc;
    if (pair === 'ETH/USDT') userCoinAmt = userBalance.eth;
    if (pair === 'SOL/USDT') userCoinAmt = userBalance.sol;
    if (pair === 'BNB/USDT') userCoinAmt = userBalance.bnb;

    if (userCoinAmt < Number(amount)) {
      return res.status(400).json({ success: false, error: `Insufficient ${pair.split('/')[0]} balance. Available: ${userCoinAmt}` });
    }

    if (pair === 'BTC/USDT') userBalance.btc = Number(Math.max(0, userBalance.btc - Number(amount)).toFixed(6));
    if (pair === 'ETH/USDT') userBalance.eth = Number(Math.max(0, userBalance.eth - Number(amount)).toFixed(6));
    if (pair === 'SOL/USDT') userBalance.sol = Number(Math.max(0, userBalance.sol - Number(amount)).toFixed(6));
    if (pair === 'BNB/USDT') userBalance.bnb = Number(Math.max(0, userBalance.bnb - Number(amount)).toFixed(6));

    userBalance.usdt = Number((userBalance.usdt + totalCostUSDT).toFixed(4));
  }

  const orderId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const order = {
    id: orderId,
    userId,
    pair,
    side: side as 'BUY' | 'SELL',
    type: type as 'MARKET' | 'LIMIT',
    price: executionPrice,
    amount: Number(amount),
    totalUSDT: totalCostUSDT,
    filledAmount: Number(amount),
    status: 'FILLED' as const,
    timestamp: Date.now(),
  };
  spotOrders.unshift(order);

  const tradeTx: TxRecord = {
    id: `tx_${Date.now()}_trade`,
    userId,
    asset: side === 'BUY' ? 'USDT' : (pair.split('/')[0] as any),
    amount: side === 'BUY' ? totalCostUSDT : Number(amount),
    direction: side === 'BUY' ? 'OUT' : 'IN',
    source: side === 'BUY' ? 'SPOT_TRADE_BUY' : 'SPOT_TRADE_SELL',
    status: 'COMPLETED',
    timestamp: Date.now(),
    referenceId: orderId,
    note: `${side} ${amount} ${pair} @ ${executionPrice.toFixed(2)}`,
  };
  await recordTransaction(tradeTx);
  await setSupabaseBalance(userId, userBalance).catch(() => {});

  if (supabase) {
    try {
      await supabase.from('spot_orders').insert({
        id: order.id,
        user_id: userId,
        pair: order.pair,
        side: order.side,
        type: order.type,
        price: order.price,
        amount: order.amount,
        total_usdt: order.totalUSDT,
        filled_amount: order.filledAmount,
        status: order.status,
        timestamp: order.timestamp,
      });
    } catch {}
  }

  // Immediately persist trade order & updated balances to disk atomically
  persistDatabaseSync();

  res.json({
    success: true,
    order,
    balances: userBalance,
  });
});

app.get('/api/trade/:userId/orders', requireUserAuth, async (req: Request, res: Response) => {
  const { userId } = req.params;
  const cutoff = Date.now() - NINETY_DAYS_MS;
  const inMemory = spotOrders.filter(o => o.userId === userId && o.timestamp >= cutoff);
  const orderMap = new Map<string, any>();

  for (const o of inMemory) {
    orderMap.set(o.id, o);
  }

  if (supabase) {
    try {
      const { data } = await supabase
        .from('spot_orders')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(100);
      if (data && data.length > 0) {
        for (const d of data) {
          if (!orderMap.has(d.id)) {
            orderMap.set(d.id, {
              id: d.id,
              userId: d.user_id,
              pair: d.pair,
              side: d.side,
              type: d.type,
              price: Number(d.price),
              amount: Number(d.amount),
              totalUSDT: Number(d.total_usdt),
              filledAmount: Number(d.filled_amount),
              status: d.status,
              timestamp: Number(d.timestamp),
            });
          }
        }
      }
    } catch {}
  }

  // Fallback: Reconstruct from recorded transactions in memory and Supabase
  let tradeTxs = transactions.filter(t => t.userId === userId && (t.source === 'SPOT_TRADE_BUY' || t.source === 'SPOT_TRADE_SELL'));
  if (tradeTxs.length === 0 && supabase) {
    try {
      const { data } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .in('source', ['SPOT_TRADE_BUY', 'SPOT_TRADE_SELL'])
        .order('timestamp', { ascending: false })
        .limit(100);
      if (data && data.length > 0) {
        tradeTxs = data.map((d: any) => ({
          id: d.id,
          userId: d.user_id,
          asset: d.asset,
          amount: Number(d.amount),
          direction: d.direction,
          source: d.source,
          status: d.status,
          timestamp: Number(d.timestamp),
          referenceId: d.reference_id,
          note: d.note,
        }));
      }
    } catch {}
  }

  for (const t of tradeTxs) {
    const oId = t.referenceId || t.id;
    if (!orderMap.has(oId)) {
      const parts = (t.note || '').split(' ');
      const side = parts[0] === 'BUY' ? 'BUY' : 'SELL';
      const amount = Number(parts[1]) || t.amount;
      const pair = parts[2] || `${t.asset}/USDT`;
      const price = Number(parts[4]) || 0;
      orderMap.set(oId, {
        id: oId,
        userId: t.userId,
        pair,
        side: side as 'BUY' | 'SELL',
        type: 'MARKET' as const,
        price,
        amount,
        totalUSDT: price ? Number((price * amount).toFixed(2)) : t.amount,
        filledAmount: amount,
        status: 'FILLED' as const,
        timestamp: t.timestamp,
      });
    }
  }

  const allOrders = Array.from(orderMap.values()).sort((a, b) => b.timestamp - a.timestamp);
  res.json({ orders: allOrders.slice(0, 200) });
});

// Helper to gather all internal E4F addresses (BEP20, TRC20, TON), UIDs, referral codes, and internal transaction IDs
function getAllE4FInternalEntities(): {
  addresses: Set<string>;
  ids: Set<string>;
  withdrawalHashes: Set<string>;
} {
  const addresses = new Set<string>();
  const ids = new Set<string>();
  const withdrawalHashes = new Set<string>();

  const addAllNetworkForms = (addr: string) => {
    if (!addr || typeof addr !== 'string') return;
    const clean = addr.trim().toLowerCase();
    addresses.add(clean);
    if (clean.startsWith('0x') && clean.length >= 40) {
      addresses.add(('t' + clean.slice(2, 35)).toLowerCase());
      addresses.add(('eq' + clean.slice(2, 34)).toLowerCase());
      addresses.add(('uq' + clean.slice(2, 34)).toLowerCase());
    }
  };

  // 1. Official system addresses
  const officialAddrs = [
    '0x63562945f7845aa1130a5b1499720b29788c82db',
    '0x187c938bbdfedf58c688b8699a909bd262ed6f20',
    systemSettings.bscDepositAddress || '',
  ];
  officialAddrs.forEach(addAllNetworkForms);

  // 2. All registered users' addresses and identifiers
  for (const [_, u] of users.entries()) {
    if (u.depositAddress) addAllNetworkForms(u.depositAddress);
    if (u.uid) ids.add(u.uid.trim().toLowerCase());
    if (u.id) ids.add(u.id.trim().toLowerCase());
    if (u.referralCode) ids.add(u.referralCode.trim().toLowerCase());
    if (u.username) ids.add(u.username.trim().toLowerCase());
  }

  // 3. All internal transaction records & withdrawal hashes
  for (const t of transactions) {
    if (t.id) ids.add(t.id.trim().toLowerCase());
    if (t.txHash) withdrawalHashes.add(t.txHash.trim().toLowerCase());
    if (t.referenceId) withdrawalHashes.add(t.referenceId.trim().toLowerCase());
  }

  return { addresses, ids, withdrawalHashes };
}

function isValidExternalTxid(txid: string, network: string): boolean {
  if (!txid || typeof txid !== 'string') return false;
  const clean = txid.trim();
  const net = (network || '').toUpperCase();

  // BEP20 (BSC) / ETH: standard 66-char hex with 0x, or 64-char hex
  if (net.includes('BEP20') || net.includes('BSC') || net.includes('ERC20')) {
    return /^0x[a-fA-F0-9]{64}$/.test(clean) || /^[a-fA-F0-9]{64}$/.test(clean);
  }

  // TRC20: standard 64-char hex transaction ID
  if (net.includes('TRC20') || net.includes('TRON')) {
    return /^[a-fA-F0-9]{64}$/.test(clean);
  }

  // TON: 64-char hex or 43-48 char base64 string
  if (net.includes('TON')) {
    return /^[a-fA-F0-9]{64}$/.test(clean) || /^[a-zA-Z0-9+/=_-]{43,48}$/.test(clean);
  }

  // Fallback for any other network: must be at least 64 hex characters or standard hash
  return /^[a-fA-F0-9]{64}$/.test(clean) || /^0x[a-fA-F0-9]{64}$/.test(clean);
}

// 9. Wallet Operations (Deposit & Withdrawal)
app.post('/api/wallet/deposit', requireUserAuth, async (req: Request, res: Response) => {
  const { userId, asset, network, amount, txid, senderAddress } = req.body;
  if (asset === 'E4F') {
    return res.status(400).json({ success: false, error: 'E4F is not listed yet. Deposits not available.' });
  }

  if (!systemSettings.depositsEnabled) {
    return res.status(403).json({ success: false, error: 'Open soon.' });
  }

  const user = await getUserFromSupabase(userId);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });

  // STRICT RULE: Require external blockchain transaction hash (TXID)
  if (!txid || typeof txid !== 'string' || txid.trim().length < 40) {
    return res.status(400).json({
      success: false,
      error: 'External Transaction Hash (TXID) is required. Deposits must be sent from an external exchange (Binance, Bybit, OKX) or external wallet (Trust Wallet, MetaMask) with a valid 64-character hash.',
    });
  }

  const cleanTxid = txid.trim().toLowerCase();
  const cleanSender = (senderAddress || '').trim().toLowerCase();
  const netKey = (network || 'BEP20').toUpperCase();

  // Validate blockchain TXID format
  if (!isValidExternalTxid(cleanTxid, netKey)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid external Transaction Hash (TXID). Please provide a valid 64-character transaction hash from Binance, Bybit, Trust Wallet, etc.',
    });
  }

  const { addresses, ids, withdrawalHashes } = getAllE4FInternalEntities();

  // ANTI-SELF DEPOSIT & ANTI-INTERNAL TRANSFER RULE:
  if (addresses.has(cleanTxid) || addresses.has(cleanSender)) {
    return res.status(400).json({
      success: false,
      error: 'Cannot deposit using an internal E4F deposit address. Deposits must originate from an external exchange (e.g. Binance, Bybit) or non-custodial wallet.',
    });
  }

  if (
    ids.has(cleanTxid) ||
    ids.has(cleanSender) ||
    cleanTxid.startsWith('tx_') ||
    cleanTxid.startsWith('wd_') ||
    cleanSender.startsWith('tx_')
  ) {
    return res.status(400).json({
      success: false,
      error: 'Internal transfers between E4F accounts or within the same app are strictly prohibited. Deposits must come from an external exchange or wallet.',
    });
  }

  if (withdrawalHashes.has(cleanTxid)) {
    return res.status(400).json({
      success: false,
      error: 'Internal E4F withdrawal hash cannot be reused as a deposit. Deposit must be sent from an external exchange or wallet.',
    });
  }

  if (
    cleanSender.includes('e4f') ||
    cleanSender.includes('earn4future') ||
    cleanSender.includes('internal') ||
    cleanSender.includes('same app')
  ) {
    return res.status(400).json({
      success: false,
      error: 'Deposits cannot originate from E4F or internal accounts. Please transfer from an external exchange (Binance, Bybit, OKX, etc.) or external wallet.',
    });
  }

  // Prevent duplicate TXID in Supabase and memory
  if (supabase) {
    try {
      const { data: dupDeposit } = await supabase
        .from('deposits')
        .select('id')
        .eq('txid', cleanTxid)
        .maybeSingle();
      if (dupDeposit) {
        return res.status(400).json({
          success: false,
          error: 'This external Transaction Hash (TXID) has already been submitted.',
        });
      }
    } catch {}
  }

  const isDuplicate = transactions.some(
    t => (t.source === 'DEPOSIT' && t.referenceId && t.referenceId.toLowerCase() === cleanTxid) ||
         (t.txHash && t.txHash.toLowerCase() === cleanTxid)
  );
  if (isDuplicate) {
    return res.status(400).json({
      success: false,
      error: 'This external Transaction Hash (TXID) has already been submitted and processed.',
    });
  }

  const num = parseFloat(amount);
  if (isNaN(num) || num <= 0) return res.status(400).json({ success: false, error: 'Invalid deposit amount' });

  const minDepositLimit = typeof systemSettings.depositMinUSDT === 'number' && systemSettings.depositMinUSDT >= 2.0
    ? systemSettings.depositMinUSDT
    : 2.0;
  if (asset === 'USDT' && num < minDepositLimit) {
    return res.status(400).json({
      success: false,
      error: `Minimum deposit amount is ${minDepositLimit} USDT.`,
    });
  }

  if (!user.depositAddress) {
    user.depositAddress = generateUserDepositAddress(user.id, user.uid);
  }

  const depositId = `dep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const depositRecord = {
    id: depositId,
    user_id: userId,
    asset,
    network: network || 'BEP20',
    amount: num,
    txid: cleanTxid,
    sender_address: cleanSender || 'External Wallet',
    status: 'PENDING',
    created_at: new Date().toISOString(),
  };

  // Insert into Supabase deposits table
  if (supabase) {
    try {
      await supabase.from('deposits').insert([depositRecord]);
    } catch (err) {
      console.warn('[Supabase] Warning inserting deposit record:', err);
    }
  }

  const tx: TxRecord = {
    id: depositId,
    userId,
    asset,
    amount: num,
    direction: 'IN',
    source: 'DEPOSIT',
    status: 'PENDING',
    timestamp: Date.now(),
    referenceId: cleanTxid,
    address: senderAddress || 'External Wallet',
    network: network || 'BEP20 (BSC)',
    note: `External ${network} Deposit (TXID: ${txid.substring(0, 10)}...) pending verification`,
  };
  await recordTransaction(tx);
  persistDatabaseSync();

  // Return pending verification response without crediting unverified funds
  res.json({
    success: true,
    message: 'Deposit submitted for blockchain verification. Your funds will be credited once confirmed by the system.',
    deposit: depositRecord,
    status: 'PENDING',
  });
});

const handleWithdrawRequest = async (req: Request, res: Response) => {
  const { userId, asset, address, network, amount } = req.body;
  if (await isUserSuspended(String((req as any).verifiedUserId || userId))) {
    return res.status(403).json({ success: false, error: 'Your account is suspended.' });
  }
  if (asset === 'E4F') {
    return res.status(400).json({ success: false, error: 'E4F is not listed yet. Withdrawals not available.' });
  }

  if (systemSettings.withdrawalsEnabled === false) {
    return res.status(403).json({ success: false, error: 'Open soon' });
  }

  // Validate destination address format
  if (!address || typeof address !== 'string' || address.trim().length < 10) {
    return res.status(400).json({ success: false, error: 'Please enter a valid external withdrawal address.' });
  }

  const cleanDest = address.trim().toLowerCase();
  const netKey = (network || 'TRC20').toUpperCase();

  // ANTI-SELF WITHDRAWAL / ANTI-INTERNAL TRANSFER RULE:
  // Cannot withdraw to an internal E4F deposit address, user ID, referral code, or from one E4F to another E4F!
  const { addresses, ids } = getAllE4FInternalEntities();

  if (addresses.has(cleanDest)) {
    return res.status(400).json({
      success: false,
      error: 'Internal E4F transfers are strictly prohibited. You cannot withdraw to your own or another user\'s E4F deposit address. Withdrawals must be sent directly to an external exchange (Binance, Bybit, OKX) or personal cold wallet.',
    });
  }

  if (ids.has(cleanDest) || cleanDest.includes('e4f') || cleanDest.includes('earn4future')) {
    return res.status(400).json({
      success: false,
      error: 'Withdrawals to internal E4F user IDs, referral codes, or usernames are not allowed. Please enter an external blockchain wallet address.',
    });
  }

  // Network address format validation
  if (netKey.includes('TRC20') && (!cleanDest.startsWith('t') || cleanDest.length < 30)) {
    return res.status(400).json({ success: false, error: 'Invalid TRC20 address. TRC20 addresses must start with "T".' });
  }
  if (netKey.includes('BEP20') && (!cleanDest.startsWith('0x') || cleanDest.length < 42)) {
    return res.status(400).json({ success: false, error: 'Invalid BEP20 address. BEP20 addresses must start with "0x".' });
  }
  if (netKey.includes('TON') && (!cleanDest.startsWith('eq') && !cleanDest.startsWith('uq') && !cleanDest.startsWith('0:'))) {
    return res.status(400).json({ success: false, error: 'Invalid TON address. TON addresses must start with "EQ" or "UQ".' });
  }

  // Read balance directly from Supabase
  const userBalance = await getSupabaseBalance(userId);
  if (!userBalance) return res.status(404).json({ success: false, error: 'User not found' });

  const num = parseFloat(amount);
  if (isNaN(num) || num <= 0) return res.status(400).json({ success: false, error: 'Invalid amount' });

  const netConfig = (systemSettings.networkWithdrawSettings && systemSettings.networkWithdrawSettings[netKey]) || {
    minAmount: systemSettings.minWithdrawalLimit !== undefined ? systemSettings.minWithdrawalLimit : 0.1,
    maxAmount: systemSettings.maxWithdrawalLimit || 1000.0,
    fee: systemSettings.withdrawalFee !== undefined ? systemSettings.withdrawalFee : (asset === 'USDT' ? 1.0 : 0.0005),
    enabled: true,
  };

  if (netConfig.enabled === false) {
    return res.status(400).json({ success: false, error: `${netKey} withdrawals are temporarily disabled.` });
  }

  const minLimit = Math.max(0.1, typeof netConfig.minAmount === 'number' ? netConfig.minAmount : 0.1);
  const maxLimit = Math.min(5000, typeof netConfig.maxAmount === 'number' ? netConfig.maxAmount : 5000.0);
  const fee = typeof netConfig.fee === 'number' ? netConfig.fee : (asset === 'USDT' ? 1.0 : 0.0005);

  if (num < minLimit) {
    return res.status(400).json({
      success: false,
      error: `Minimum withdrawal limit is ${minLimit} ${asset} on ${netKey}.`,
    });
  }

  if (num > maxLimit) {
    return res.status(400).json({
      success: false,
      error: `Maximum withdrawal limit is ${maxLimit} ${asset} on ${netKey}. Please reduce amount.`,
    });
  }

  const withdrawalId = `wd_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // Use Atomic PostgreSQL Stored Procedure in Supabase with FOR UPDATE lock
  if (supabase) {
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('execute_atomic_withdrawal', {
        p_withdrawal_id: withdrawalId,
        p_user_id: userId,
        p_amount: num,
        p_fee: fee,
        p_currency: asset,
        p_network: network || 'TRC20',
        p_wallet_address: address || '',
      });

      if (rpcErr) {
        return res.status(400).json({ success: false, error: rpcErr.message || 'Withdrawal failed' });
      }

      const updatedBalance = await getSupabaseBalance(userId);
      return res.json({
        success: true,
        message: 'Withdrawal request submitted for security review',
        withdrawalId,
        balances: updatedBalance,
      });
    } catch (err: any) {
      console.warn('[Supabase] Atomic withdrawal exception:', err);
      return res.status(500).json({ success: false, error: err.message || 'Withdrawal processing error' });
    }
  }

  // In-memory fallback (when Supabase is not yet connected in dev)
  if (asset === 'USDT') {
    if (userBalance.usdt < num + fee) {
      return res.status(400).json({ success: false, error: `Insufficient balance (including ${fee} USDT network fee)` });
    }
    userBalance.usdt = Number((userBalance.usdt - (num + fee)).toFixed(6));
  } else {
    const assetKey = asset.toLowerCase() as keyof BalanceRecord;
    const currentAmt = (userBalance as any)[assetKey] || 0;
    if (currentAmt < num + fee) {
      return res.status(400).json({ success: false, error: `Insufficient ${asset} balance (including fee)` });
    }
    (userBalance as any)[assetKey] = Number((currentAmt - (num + fee)).toFixed(6));
  }

  const withdrawalRecord = {
    id: withdrawalId,
    user_id: userId,
    amount: num,
    currency: asset,
    status: 'pending',
    wallet_address: address || '',
    created_at: new Date().toISOString(),
  };

  const tx: TxRecord = {
    id: withdrawalId,
    userId,
    asset,
    amount: num,
    direction: 'OUT',
    source: 'WITHDRAWAL',
    status: 'PENDING',
    timestamp: Date.now(),
    address: address || '',
    network: network || 'BEP20 (BSC)',
    fee,
    note: `Withdrawal to ${address ? address.substring(0, 8) + '...' : ''} (${network || 'BEP20'})`,
  };
  transactions.unshift(tx);
  persistDatabaseSync();

  res.json({
    success: true,
    message: 'Withdrawal request submitted for security review',
    transaction: tx,
    withdrawal: withdrawalRecord,
    balances: userBalance,
  });
};

app.post('/api/wallet/withdraw', requireUserAuth, handleWithdrawRequest);
app.post('/api/withdraw', requireUserAuth, handleWithdrawRequest);

// 3. User Withdrawals History Route (Directly from Supabase table 'withdrawals')
// 3. User Withdrawals History Route: Filtered to last 90 days for user app (.gte created_at)
app.get('/api/withdrawals/:userId', requireUserAuth, async (req: Request, res: Response) => {
  const { userId } = req.params;
  const ninetyDaysAgoMs = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const ninetyDaysAgoISO = new Date(ninetyDaysAgoMs).toISOString();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('withdrawals')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', ninetyDaysAgoISO)
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        return res.json({ success: true, withdrawals: data });
      }
    } catch (err) {
      console.warn('[Supabase] Error reading withdrawals table:', err);
    }
  }

  // Fallback to in-memory transactions (strictly filtering last 90 days for user app)
  const fallback = transactions
    .filter(t => t.userId === userId && t.source === 'WITHDRAWAL' && t.timestamp >= ninetyDaysAgoMs)
    .map(t => ({
      id: t.id,
      user_id: t.userId,
      amount: t.amount,
      currency: t.asset,
      status: t.status === 'COMPLETED' ? 'success' : (t.status === 'REJECTED' ? 'rejected' : 'pending'),
      wallet_address: t.address || '',
      created_at: new Date(t.timestamp).toISOString(),
    }));

  res.json({ success: true, withdrawals: fallback });
});

// 10. Announcements & Support
app.get('/api/announcements', (_req: Request, res: Response) => {
  res.json({ announcements: announcements.filter(a => a.isActive) });
});

app.get('/api/support/:userId/tickets', requireUserAuth, (req: Request, res: Response) => {
  const { userId } = req.params;
  res.json({ tickets: supportTickets.filter(t => t.userId === userId) });
});

app.post('/api/support/create', (req: Request, res: Response) => {
  const { userId, subject, message } = req.body;
  const ticket = {
    id: `tic_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
    userId,
    subject,
    message,
    status: 'OPEN' as const,
    createdAt: Date.now(),
  };
  supportTickets.unshift(ticket);
  res.json({ success: true, ticket });
});

// The admin password lives ONLY in the server environment variable ADMIN_SECRET.
// It is never written in source code, never sent to the browser, and there are no fallback passwords.
const ADMIN_SECRET: string = (process.env.ADMIN_SECRET || process.env.ADMIN_PASSWORD || '').trim();
const SESSION_SECRET: string = SESSION_SECRET_KEY;
if (!ADMIN_SECRET) {
  console.error('[SECURITY] ADMIN_SECRET is not set. Admin login is DISABLED until you set it in the server environment.');
}

function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function verifyAdminPassword(candidate: string): boolean {
  if (!ADMIN_SECRET) return false;
  if (!candidate || typeof candidate !== 'string') return false;
  return safeEqual(candidate.trim(), ADMIN_SECRET);
}

function generateAdminSessionToken(): string {
  const expiresAt = Date.now() + 4 * 60 * 60 * 1000; // 4 hours
  const payload = `admin:${expiresAt}`;
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  return `${payload}:${signature}`;
}

function verifyAdminSessionToken(token: string): boolean {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split(':');
  if (parts.length !== 3) return false;
  const [role, expiresAtStr, signature] = parts;
  if (role !== 'admin') return false;
  const expiresAt = parseInt(expiresAtStr, 10);
  if (isNaN(expiresAt) || Date.now() > expiresAt) return false;

  const expectedSignature = crypto.createHmac('sha256', SESSION_SECRET).update(`${role}:${expiresAt}`).digest('hex');
  const sigBuffer = Buffer.from(signature, 'utf-8');
  const expBuffer = Buffer.from(expectedSignature, 'utf-8');
  if (sigBuffer.length !== expBuffer.length || !crypto.timingSafeEqual(sigBuffer, expBuffer)) {
    return false;
  }
  return true;
}

function requireAdminAuth(req: Request, res: Response, next: () => void) {
  // Credentials are accepted ONLY from headers (never from the URL, which ends up in logs).
  const adminKey = ((req.headers['x-admin-key'] as string) || '').trim();
  const adminToken = ((req.headers['x-admin-token'] as string) || '').trim();

  if (adminToken && verifyAdminSessionToken(adminToken)) return next();

  if (adminKey) {
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'ip').split(',')[0].trim();
    if (adRateLimited(`adminkey|${ip}`, 30, 10 * 60_000)) {
      return res.status(429).json({ success: false, error: 'Too many attempts. Try again later.' });
    }
    if (verifyAdminPassword(adminKey)) return next();
  }

  return res.status(401).json({ success: false, error: 'Unauthorized: Valid Admin authentication required.' });
}

const handleAdminLogin = (req: Request, res: Response) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed. Admin login requires POST with JSON body.' });
  }
  if (!ADMIN_SECRET) {
    return res.status(503).json({ success: false, error: 'Admin login is not configured on the server (ADMIN_SECRET missing).' });
  }

  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'ip').split(',')[0].trim();
  if (adRateLimited(`adminlogin|${ip}`, 8, 10 * 60_000)) {
    return res.status(429).json({ success: false, error: 'Too many login attempts. Try again in a few minutes.' });
  }

  let body: any = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  } else if (Buffer.isBuffer(body)) {
    try { body = JSON.parse(body.toString('utf8')); } catch { body = {}; }
  }
  const rawInput = body && typeof body === 'object'
    ? (body.password || body.key || body.pin || body.adminPassword || body.secret || body.admin_secret || '')
    : '';
  const input = typeof rawInput === 'string' ? rawInput.trim() : '';

  if (input && verifyAdminPassword(input)) {
    return res.json({
      success: true,
      token: generateAdminSessionToken(),
      role: 'SUPER_ADMIN',
    });
  }

  auditLogs.unshift({
    id: `audit_${Date.now()}`,
    adminId: 'UNKNOWN',
    action: 'ADMIN_LOGIN_FAILED',
    target: ip,
    details: 'Failed admin login attempt',
    timestamp: Date.now(),
  });
  return res.status(401).json({ success: false, error: 'Invalid Admin Secret Password' });
};

app.post(['/api/admin/login', '/admin/login', '/api/admin/auth/login', '/admin/auth/login'], handleAdminLogin);

app.get(['/api/admin/dashboard', '/admin/dashboard'], requireAdminAuth, async (_req: Request, res: Response) => {
  let totalUsers = users.size;
  let activeUsers = 0;

  if (supabase) {
    try {
      // 1. Total users: Query profiles table first, fallback to users table
      const { count: pCount, error: pErr } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });
      if (!pErr && typeof pCount === 'number' && pCount > 0) {
        totalUsers = pCount;
      } else {
        const { count: uCount, error: uErr } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true });
        if (!uErr && typeof uCount === 'number' && uCount > 0) {
          totalUsers = Math.max(totalUsers, uCount);
        }
      }

      // 2. Active users in last 24 hours (updated_at > now() - 24h)
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count: pActiveCount, error: pActErr } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gt('updated_at', twentyFourHoursAgo);

      if (!pActErr && typeof pActiveCount === 'number') {
        activeUsers = pActiveCount;
      } else {
        const { count: aCount, error: aErr } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .or(`status.eq.ACTIVE,updated_at.gt.${twentyFourHoursAgo}`);
        if (!aErr && typeof aCount === 'number') {
          activeUsers = aCount;
        }
      }
    } catch (e: any) {
      console.warn('[Supabase Dashboard Users Count Error]:', e?.message);
    }
  }

  if (activeUsers === 0) {
    activeUsers = Array.from(users.values()).filter(u => u.status === 'ACTIVE').length || totalUsers;
  }

  let totalE4FDistributed = 0;
  let totalUSDTDistributed = 0;

  for (const b of balances.values()) {
    totalE4FDistributed += b.e4f || 0;
    totalUSDTDistributed += b.usdt || 0;
  }

  const activeMiners = miningSessions.filter(s => s.status === 'ACTIVE').length;
  const pendingProofSubmissions = taskSubmissionsQueue.filter(s => s.status === 'SUBMITTED').length;

  res.json({
    totalUsers,
    activeUsers,
    activeMiners,
    totalMiningSessions: miningSessions.length,
    totalE4FDistributed: Number(totalE4FDistributed.toFixed(2)),
    totalUSDTDistributed: Number(totalUSDTDistributed.toFixed(2)),
    totalOrders: spotOrders.length,
    totalTickets: supportTickets.length,
    pendingProofSubmissions,
    systemSettings: {
      ...systemSettings,
      spin_03_onclicka: String(systemSettings.spin_03_onclicka || '6153717').replace(/E4F$/i, ''),
      box_03_onclicka: String(systemSettings.box_03_onclicka || '6153772').replace(/E4F$/i, ''),
      mining_03_onclicka: String(systemSettings.mining_03_onclicka || '6153774').replace(/E4F$/i, ''),
    },
    recentAuditLogs: auditLogs.slice(0, 20),
  });
});

app.post(['/api/admin/settings', '/admin/settings'], requireAdminAuth, async (req: Request, res: Response) => {
  let updates = req.body;
  if (typeof updates === 'string') {
    try { updates = JSON.parse(updates); } catch {}
  } else if (Buffer.isBuffer(updates)) {
    try { updates = JSON.parse(updates.toString('utf8')); } catch {}
  }
  if (!updates || typeof updates !== 'object') {
    updates = {};
  }

  if (Array.isArray(updates.dailyCheckInRewards)) {
    updates.dailyCheckInRewards = updates.dailyCheckInRewards.slice(0, 7).map((item: any, idx: number) => ({
      day: item.day || (idx + 1),
      asset: item.asset === 'USDT' ? 'USDT' : 'E4F',
      amount: Math.round(Math.max(0.0001, Number(item.amount) || 0.01) * 10000) / 10000,
    }));
    systemSettings.dailyCheckInRewards = updates.dailyCheckInRewards;

    if (supabase) {
      for (const r of updates.dailyCheckInRewards) {
        (supabase.from('e4f_daily_rewards_config').upsert({
          day_number: r.day,
          reward_amount: r.amount,
          reward_type: r.asset,
          is_active: true,
        }, { onConflict: 'day_number' }) as PromiseLike<any>).then(() => {}, () => {});
      }
    }
  }
  if (updates.networkWithdrawSettings && typeof updates.networkWithdrawSettings === 'object') {
    const existing = systemSettings.networkWithdrawSettings || defaultNetworkWithdrawSettings;
    const cleanedNetSettings: Record<string, any> = { ...existing };
    for (const [netName, val] of Object.entries(updates.networkWithdrawSettings)) {
      if (typeof val === 'object' && val !== null) {
        const v = val as any;
        const key = netName.toUpperCase();
        cleanedNetSettings[key] = {
          enabled: v.enabled !== false,
          minAmount: Math.round(Math.max(0.1, Math.min(5000, Number(v.minAmount) || 0.1)) * 100) / 100,
          maxAmount: Math.round(Math.max(0.1, Math.min(5000, Number(v.maxAmount) || 5000)) * 100) / 100,
          fee: Math.round(Math.max(0, Math.min(500, Number(v.fee) || 0)) * 100) / 100,
        };
      }
    }
    updates.networkWithdrawSettings = cleanedNetSettings;
  }
  if (updates.minWithdrawalLimit !== undefined) {
    updates.minWithdrawalLimit = Math.round(Math.max(0.1, Math.min(5000, Number(updates.minWithdrawalLimit) || 0.1)) * 100) / 100;
  }
  if (updates.maxWithdrawalLimit !== undefined) {
    updates.maxWithdrawalLimit = Math.round(Math.max(0.1, Math.min(5000, Number(updates.maxWithdrawalLimit) || 5000)) * 100) / 100;
  }
  if (updates.withdrawalFee !== undefined) {
    updates.withdrawalFee = Math.round(Math.max(0, Math.min(500, Number(updates.withdrawalFee) || 0)) * 100) / 100;
  }
  if (updates.depositsEnabled !== undefined) {
    updates.depositsEnabled = updates.depositsEnabled === true || updates.depositsEnabled === 'true';
  }
  if (updates.withdrawalsEnabled !== undefined) {
    updates.withdrawalsEnabled = updates.withdrawalsEnabled === true || updates.withdrawalsEnabled === 'true';
  }
  if (updates.depositMinUSDT !== undefined) {
    const minVal = Number(updates.depositMinUSDT);
    // Minimum starts from 2 USDT or any custom value set by admin (e.g. 2, 3, 4, etc.)
    updates.depositMinUSDT = !isNaN(minVal) && minVal >= 2.0 ? Math.round(minVal * 100) / 100 : 2.0;
  }
  if (updates.depositFirstBonusUSDT !== undefined) {
    const bonusVal = Number(updates.depositFirstBonusUSDT);
    // Custom bonus set by admin without app update
    updates.depositFirstBonusUSDT = !isNaN(bonusVal) && bonusVal >= 0 ? Math.round(bonusVal * 100) / 100 : 0;
  }
  if (updates.welcomeBonusUSDT !== undefined) {
    const v = Number(updates.welcomeBonusUSDT);
    updates.welcomeBonusUSDT = !isNaN(v) && v >= 0 ? Math.round(v * 100) / 100 : 25;
  }
  if (updates.welcomeBonusE4F !== undefined) {
    const v = Number(updates.welcomeBonusE4F);
    updates.welcomeBonusE4F = !isNaN(v) && v >= 0 ? Math.round(v * 100) / 100 : 10;
  }
  if (updates.referralBonusUSDT !== undefined) {
    const v = Number(updates.referralBonusUSDT);
    updates.referralBonusUSDT = !isNaN(v) && v >= 0 ? Math.round(v * 100) / 100 : 5;
  }
  if (updates.rewardedAdRequired !== undefined) {
    updates.rewardedAdRequired = updates.rewardedAdRequired === true || updates.rewardedAdRequired === 'true';
  }
  if (updates.strictTaskTimer !== undefined) {
    updates.strictTaskTimer = updates.strictTaskTimer === true || updates.strictTaskTimer === 'true';
  }
  if (updates.miningWaterfallEnabled !== undefined) {
    updates.miningWaterfallEnabled = updates.miningWaterfallEnabled === true || updates.miningWaterfallEnabled === 'true';
  }
  const validNetworks = ['RichAds', 'Monetag', 'OnClickA'];
  if (updates.miningPrimaryNetwork && validNetworks.includes(updates.miningPrimaryNetwork)) {
    updates.miningPrimaryNetwork = updates.miningPrimaryNetwork;
  }
  if (updates.miningSecondaryNetwork && validNetworks.includes(updates.miningSecondaryNetwork)) {
    updates.miningSecondaryNetwork = updates.miningSecondaryNetwork;
  }
  if (updates.miningRatePerHour !== undefined) {
    const rate = Number(updates.miningRatePerHour);
    if (!isNaN(rate) && rate > 0) {
      updates.miningRatePerHour = Math.round(Math.min(rate, 1000) * 10000) / 10000;
    } else {
      delete updates.miningRatePerHour;
    }
  }
  // Reward tables edited from the admin panel: validate shape and amounts (admin may raise or lower them freely)
  const cleanAmount = (v: any, fallback: number) => {
    const n = Number(v);
    return !isNaN(n) && n >= 0 ? Math.round(Math.min(n, 100000) * 10000) / 10000 : fallback;
  };
  const cleanColor = (v: any, fallback: string) => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : fallback);
  if (updates.spinWheelPrizes !== undefined) {
    if (Array.isArray(updates.spinWheelPrizes) && updates.spinWheelPrizes.length >= 2) {
      updates.spinWheelPrizes = updates.spinWheelPrizes.slice(0, 8).map((p: any, i: number) => {
        const base = defaultSpinWheelPrizes[i % defaultSpinWheelPrizes.length];
        const asset = p && p.asset === 'USDT' ? 'USDT' : 'E4F';
        const amount = cleanAmount(p && p.amount, base.amount);
        return { id: i, label: `${amount.toFixed(2)} ${asset}`, asset, amount, color: cleanColor(p && p.color, base.color) };
      });
    } else {
      delete updates.spinWheelPrizes;
    }
  }
  if (updates.giftBoxesConfig !== undefined) {
    if (Array.isArray(updates.giftBoxesConfig) && updates.giftBoxesConfig.length >= 1) {
      updates.giftBoxesConfig = updates.giftBoxesConfig.slice(0, 5).map((b: any, i: number) => {
        const base = defaultGiftBoxesConfig[i % defaultGiftBoxesConfig.length];
        return {
          id: i + 1,
          boxNumber: i + 1,
          name: (typeof (b && b.name) === 'string' && b.name.trim() ? b.name.trim() : base.name).slice(0, 40),
          rewardAsset: b && b.rewardAsset === 'USDT' ? 'USDT' : 'E4F',
          rewardAmount: cleanAmount(b && b.rewardAmount, base.rewardAmount),
          color: cleanColor(b && b.color, base.color),
        };
      });
    } else {
      delete updates.giftBoxesConfig;
    }
  }
  if (updates.miningAdDurationSeconds !== undefined) {
    const d = parseInt(updates.miningAdDurationSeconds);
    if (!isNaN(d) && d >= 5) {
      updates.miningAdDurationSeconds = d;
      updates.adMiningDurationSeconds = d;
    }
  }
  if (updates.spinAdDurationSeconds !== undefined) {
    const d = parseInt(updates.spinAdDurationSeconds);
    if (!isNaN(d) && d >= 5) {
      updates.spinAdDurationSeconds = d;
    }
  }
  if (updates.giftBoxAdDurationSeconds !== undefined) {
    const d = parseInt(updates.giftBoxAdDurationSeconds);
    if (!isNaN(d) && d >= 5) {
      updates.giftBoxAdDurationSeconds = d;
    }
  }
  if (updates.adMiningDurationSeconds !== undefined) {
    const d = parseInt(updates.adMiningDurationSeconds);
    if (!isNaN(d) && d >= 5) {
      updates.adMiningDurationSeconds = d;
      if (updates.miningAdDurationSeconds === undefined) {
        updates.miningAdDurationSeconds = d;
      }
    }
  }
  for (const [k, fallback] of Object.entries(REAL_DEFAULT_IDS)) {
    if ((updates as any)[k] !== undefined) {
      const val = (updates as any)[k];
      if (!val || typeof val !== 'string' || /^(spin|box|mining)_[0-9a-z_]+$/i.test(val.trim())) {
        (updates as any)[k] = fallback;
      }
    }
  }
  if (updates.spin_03_onclicka === '6153717') updates.spin_03_onclicka = '6153717';
  if (updates.box_03_onclicka === '6153772') updates.box_03_onclicka = '6153772';
  if (updates.mining_03_onclicka === '6153774') updates.mining_03_onclicka = '6153774';
  updates.monetagDirectLink = '';

  Object.assign(systemSettings, updates);
  // Admin can switch the MINING ad gate ON/OFF. Spin and Gift Box ads are always required.
  systemSettings.rewardedAdRequired = systemSettings.rewardedAdRequired !== false;
  systemSettings.strictTaskTimer = systemSettings.strictTaskTimer !== false;
  systemSettings.rewardSpinAdRequired = true;
  systemSettings.giftBoxAdRequired = true;
  normalizeAdSlotSettings();

  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(systemSettings, null, 2), 'utf-8');
  } catch (err) {
    try {
      fs.writeFileSync(path.join('/tmp', 'system-settings.json'), JSON.stringify(systemSettings, null, 2), 'utf-8');
    } catch {}
  }

  let persistError = '';
  if (supabase) {
    try {
      let { error: upErr } = await supabase.from('system_settings').upsert({
        id: 'global_settings',
        settings: systemSettings,
        updated_at: new Date().toISOString(),
      });
      if (upErr) {
        // Older table without the updated_at column: retry with the two required columns only.
        const retry = await supabase.from('system_settings').upsert({ id: 'global_settings', settings: systemSettings });
        upErr = retry.error;
      }
      if (upErr) persistError = upErr.message || 'database write failed';
      else settingsLoadedAt = Date.now();
    } catch (dbErr: any) {
      persistError = dbErr?.message || 'database write failed';
      console.warn('[Supabase] Warning syncing system settings to database:', dbErr);
    }
  }

  auditLogs.unshift({
    id: `audit_${Date.now()}`,
    adminId: 'ADMIN_SUPER',
    action: 'UPDATE_SYSTEM_SETTINGS',
    target: 'SYSTEM',
    details: JSON.stringify(updates),
    timestamp: Date.now(),
  });

  if (persistError) {
    return res.status(500).json({
      success: false,
      error: 'Settings were NOT saved to the database (' + persistError + '). Run the latest SQL file in Supabase, then try again.',
      settings: systemSettings,
    });
  }
  res.json({ success: true, persisted: true, settings: systemSettings });
});

app.get('/api/admin/users', requireAdminAuth, async (_req: Request, res: Response) => {
  if (supabase) {
    try {
      const { data: dbProfiles, error: pErr } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (!pErr && Array.isArray(dbProfiles) && dbProfiles.length > 0) {
        for (const p of dbProfiles) {
          const uId = p.id || p.user_id;
          if (uId && !users.has(uId)) {
            users.set(uId, {
              id: uId,
              uid: p.uid || `8${Math.abs((p.telegram_id || 0) % 8999999 + 1000000)}`,
              telegramId: p.telegram_id,
              firstName: p.first_name || p.username || 'E4F User',
              lastName: p.last_name || '',
              username: p.username || '',
              photoUrl: p.photo_url || '',
              referralCode: p.referral_code,
              referredBy: p.referred_by,
              createdAt: p.created_at ? new Date(p.created_at).getTime() : Date.now(),
              status: p.status || 'ACTIVE',
              claimedWelcomeBonus: Boolean(p.claimed_welcome_bonus),
              isDemoUser: false,
              isVerified: Boolean(p.is_verified),
              depositBalance: Number(p.deposit_balance) || 0,
              depositAddress: p.deposit_address || '',
            });
          }
        }
      }

      const { data: dbUsers, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(dbUsers)) {
        for (const u of dbUsers) {
          if (!users.has(u.id)) {
            users.set(u.id, {
              id: u.id,
              uid: u.uid || `8${Math.abs((u.telegram_id || 0) % 8999999 + 1000000)}`,
              telegramId: u.telegram_id,
              firstName: u.first_name || 'E4F User',
              lastName: u.last_name || '',
              username: u.username || '',
              photoUrl: u.photo_url || '',
              referralCode: u.referral_code,
              referredBy: u.referred_by,
              createdAt: u.created_at ? new Date(u.created_at).getTime() : Date.now(),
              status: u.status || 'ACTIVE',
              claimedWelcomeBonus: u.claimed_welcome_bonus,
              isDemoUser: false,
              isVerified: u.is_verified,
              depositBalance: Number(u.deposit_balance) || 0,
              depositAddress: u.deposit_address || '',
            });
          }
        }
      }
    } catch (err: any) {
      console.warn('[Supabase Admin Users Fetch Warning]:', err?.message);
    }
  }

  const allUsersList = Array.from(users.values());
  const userList = allUsersList.map(u => {
    const memoryRefCount = referralHistory.filter(r => r.referrerId === u.id).length;
    const directUserRefCount = allUsersList.filter(
      other => other.id !== u.id && (
        other.referredBy === u.id ||
        (u.referralCode && other.referredBy === u.referralCode) ||
        (u.telegramId && other.referredBy === String(u.telegramId))
      )
    ).length;

    return {
      ...u,
      balances: balances.get(u.id) || { usdt: 0, e4f: 0, btc: 0, eth: 0, sol: 0, bnb: 0 },
      referralsCount: Math.max(memoryRefCount, directUserRefCount),
    };
  });

  res.json({ users: userList });
});

app.post('/api/admin/users/:userId/status', requireAdminAuth, async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { status } = req.body;
  if (!['ACTIVE', 'RESTRICTED', 'SUSPENDED'].includes(status)) return res.status(400).json({ success: false, error: 'Invalid status' });
  let user: any = users.get(userId) || (await getUserFromSupabase(userId));
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });
  if (supabase) {
    try { await supabase.from('users').update({ status }).eq('id', userId); } catch {}
  }
  suspendCache.delete(userId);

  user.status = status;
  auditLogs.unshift({
    id: `audit_${Date.now()}`,
    adminId: 'ADMIN_SUPER',
    action: 'UPDATE_USER_STATUS',
    target: userId,
    details: `Status set to ${status}`,
    timestamp: Date.now(),
  });

  res.json({ success: true, user });
});

// Admin Withdrawal Management (Manual Verification, Approval & Rejection) - ALL TIME LIFETIME, NO FILTER!
app.get('/api/admin/withdrawals', requireAdminAuth, async (_req: Request, res: Response) => {
  let dbWithdrawals: any[] = [];
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('withdrawals')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && Array.isArray(data)) {
        dbWithdrawals = data;
      }
    } catch (err) {
      console.warn('[Supabase] Admin withdrawals fetch error:', err);
    }
  }

  // Merge Supabase withdrawals with in-memory transactions: 100% ALL TIME LIFETIME, NO FILTER!
  const txWithdrawals = transactions.filter(t => t.source === 'WITHDRAWAL');
  const allMap = new Map<string, any>();

  // In-memory transactions first
  for (const tx of txWithdrawals) {
    const user = users.get(tx.userId);
    const userBal = balances.get(tx.userId);
    const totalDeposited = transactions
      .filter(t => t.userId === tx.userId && t.source === 'DEPOSIT' && t.status === 'COMPLETED')
      .reduce((sum, t) => sum + (t.asset === 'USDT' ? t.amount : 0), 0);
    const depositHistory = transactions
      .filter(t => t.userId === tx.userId && t.source === 'DEPOSIT')
      .slice(0, 5);

    allMap.set(tx.id, {
      ...tx,
      userUid: user?.uid || tx.userId,
      userName: user ? `${user.firstName} ${user.lastName || ''}`.trim() : 'E4F User',
      userSpotUsdt: userBal?.usdt ?? 0,
      userDepositBalance: user?.depositBalance ?? 0,
      userTotalDeposited: totalDeposited,
      depositHistory,
    });
  }

  // Supabase withdrawals (lifetime proof for admin panel)
  for (const dbW of dbWithdrawals) {
    if (!allMap.has(dbW.id)) {
      const user = users.get(dbW.user_id);
      const userBal = balances.get(dbW.user_id);
      allMap.set(dbW.id, {
        id: dbW.id,
        userId: dbW.user_id,
        userUid: user?.uid || dbW.user_id,
        userName: user ? `${user.firstName} ${user.lastName || ''}`.trim() : 'E4F User',
        asset: dbW.currency || 'USDT',
        amount: Number(dbW.amount),
        direction: 'OUT',
        source: 'WITHDRAWAL',
        status: dbW.status === 'success' ? 'COMPLETED' : (dbW.status === 'rejected' ? 'REJECTED' : 'PENDING'),
        timestamp: new Date(dbW.created_at).getTime(),
        address: dbW.wallet_address || '',
        network: 'BEP20 (BSC)',
        fee: 0.5,
        userSpotUsdt: userBal?.usdt ?? 0,
        userDepositBalance: user?.depositBalance ?? 0,
        userTotalDeposited: 0,
        depositHistory: [],
        note: `Withdrawal to ${dbW.wallet_address ? dbW.wallet_address.substring(0, 8) + '...' : ''}`,
      });
    }
  }

  const withdrawalList = Array.from(allMap.values()).sort((a, b) => b.timestamp - a.timestamp);
  res.json({ withdrawals: withdrawalList });
});

app.post('/api/admin/withdrawals/:id/review', requireAdminAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { decision, note } = req.body; // 'APPROVE' or 'REJECT'

  let tx = transactions.find(t => t.id === id && t.source === 'WITHDRAWAL');
  if (!tx && supabase) {
    try {
      const { data } = await supabase.from('withdrawals').select('*').eq('id', id).maybeSingle();
      if (data) {
        tx = {
          id: data.id,
          userId: data.user_id || `usr_${data.telegram_id}`,
          asset: (data.currency || 'USDT') as any,
          amount: Number(data.amount),
          direction: 'OUT',
          source: 'WITHDRAWAL',
          status: data.status === 'success' ? 'COMPLETED' : (data.status === 'rejected' ? 'REJECTED' : 'PENDING'),
          timestamp: new Date(data.created_at).getTime(),
          address: data.wallet_address || '',
          network: data.network || 'BEP20',
          fee: Number(data.fee) || 0,
        };
        transactions.unshift(tx);
      }
    } catch {}
  }

  if (!tx) {
    return res.status(404).json({ success: false, error: 'Withdrawal transaction not found' });
  }

  if (tx.status !== 'PENDING') {
    return res.status(400).json({ success: false, error: `Withdrawal has already been marked as ${tx.status}` });
  }

  const user = users.get(tx.userId);
  const userBalance = balances.get(tx.userId);

  if (decision === 'APPROVE') {
    tx.status = 'COMPLETED';
    tx.note = note || `Approved by Admin: Paid to ${tx.address ? tx.address.substring(0, 8) + '...' : ''} (${tx.network || 'BEP20'})`;

    // Sync status with Supabase table 'withdrawals'
    if (supabase) {
      supabase.from('withdrawals').update({ status: 'success' }).eq('id', tx.id).then(() => {}, () => {});
    }

    auditLogs.unshift({
      id: `audit_${Date.now()}`,
      adminId: 'ADMIN_SUPER',
      action: 'APPROVE_WITHDRAWAL',
      target: tx.id,
      details: `Approved withdrawal of ${tx.amount} ${tx.asset} to address ${tx.address} (${tx.network}) for user ${user?.uid || tx.userId}`,
      timestamp: Date.now(),
    });
  } else if (decision === 'REJECT') {
    tx.status = 'REJECTED';
    tx.note = note || 'Rejected by Administrator during manual security verification';

    // Sync status with Supabase table 'withdrawals'
    if (supabase) {
      supabase.from('withdrawals').update({ status: 'rejected' }).eq('id', tx.id).then(() => {}, () => {});
    }

    // Refund deducted amount + fee back to spot balance if USDT
    if (userBalance && tx.asset === 'USDT') {
      const fee = tx.fee !== undefined ? tx.fee : 1.0;
      userBalance.usdt = Number((userBalance.usdt + (tx.amount + fee)).toFixed(6));

      // Persist refunded balance to Supabase
      setSupabaseBalance(tx.userId, userBalance).catch(() => {});

      transactions.unshift({
        id: `tx_${Date.now()}_refund`,
        userId: tx.userId,
        asset: 'USDT',
        amount: tx.amount + fee,
        direction: 'IN',
        source: 'WITHDRAWAL',
        status: 'COMPLETED',
        timestamp: Date.now(),
        note: `Withdrawal Refund: Request ${tx.id.substring(0, 10)} was rejected (+${tx.amount + fee} USDT)`,
      });
    }

    auditLogs.unshift({
      id: `audit_${Date.now()}`,
      adminId: 'ADMIN_SUPER',
      action: 'REJECT_WITHDRAWAL',
      target: tx.id,
      details: `Rejected withdrawal of ${tx.amount} ${tx.asset} for user ${user?.uid || tx.userId}. Balance refunded.`,
      timestamp: Date.now(),
    });
  } else {
    return res.status(400).json({ success: false, error: 'Invalid decision. Must be APPROVE or REJECT' });
  }

  // Persist withdrawal approval/refund and updated user balances immediately
  persistDatabaseSync();

  res.json({
    success: true,
    transaction: tx,
    userBalances: userBalance,
    message: decision === 'APPROVE' ? 'Withdrawal approved successfully' : 'Withdrawal rejected and balance refunded',
  });
});

app.delete('/api/admin/users/:userId', requireAdminAuth, (req: Request, res: Response) => {
  const { userId } = req.params;
  const user = users.get(userId);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });

  user.status = 'SUSPENDED';
  auditLogs.unshift({
    id: `audit_${Date.now()}`,
    adminId: 'ADMIN_SUPER',
    action: 'DELETE_USER',
    target: userId,
    details: `User UID ${user.uid} suspended and marked deleted by admin`,
    timestamp: Date.now(),
  });

  res.json({ success: true, message: 'User deactivated' });
});

// Admin Daily Check-in Controls (for testing and manual support)
app.post('/api/admin/users/:userId/reset-daily-checkin', requireAdminAuth, async (req: Request, res: Response) => {
  const { userId } = req.params;
  const resetState = { currentStreak: 0, currentDay: 0, lastDate: '', streakCount: 0, claimedDays: [] };
  userDailyCheckIns.set(userId, resetState);

  if (supabase) {
    try {
      await supabase.from('e4f_daily_checkins').upsert({
        user_id: userId,
        current_day: 0,
        last_claim_date: null,
        streak_count: 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    } catch (err: any) {
      console.warn('[Supabase Reset Checkin Error]:', err?.message);
    }
  }

  persistDatabaseSync();
  scheduleSaveDatabase();
  res.json({ success: true, message: 'Daily check-in reset to Day 0 (Ready for Day 1)' });
});

app.post('/api/admin/users/:userId/advance-daily-checkin', requireAdminAuth, async (req: Request, res: Response) => {
  const { userId } = req.params;
  const now = new Date();
  const yesterdayStr = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1)).toISOString().split('T')[0];

  let checkIn = userDailyCheckIns.get(userId);
  if (!checkIn) {
    checkIn = { currentStreak: 1, currentDay: 1, lastDate: yesterdayStr, streakCount: 1, claimedDays: [1] };
    userDailyCheckIns.set(userId, checkIn);
  } else {
    checkIn.lastDate = yesterdayStr;
  }

  if (supabase) {
    try {
      await supabase.from('e4f_daily_checkins').upsert({
        user_id: userId,
        current_day: checkIn.currentDay || checkIn.currentStreak || 1,
        last_claim_date: yesterdayStr,
        streak_count: checkIn.streakCount || 1,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    } catch (err: any) {
      console.warn('[Supabase Advance Checkin Error]:', err?.message);
    }
  }

  persistDatabaseSync();
  scheduleSaveDatabase();
  res.json({
    success: true,
    message: 'Check-in date set to yesterday (00:00 UTC compliant). User can claim next day immediately.',
    checkIn,
    nextDayToClaim: ((checkIn.currentDay || checkIn.currentStreak || 1) % 7) + 1,
  });
});

// Notice Board / Announcements Management
app.get('/api/admin/announcements', requireAdminAuth, (_req: Request, res: Response) => {
  res.json({ announcements });
});

app.post('/api/admin/announcements', requireAdminAuth, (req: Request, res: Response) => {
  const { title, description, ctaText, ctaUrl, priority, type, validUntil, imageUrl } = req.body;
  const newAnn = {
    id: `ann_${Date.now()}`,
    title,
    description,
    ctaText: ctaText || 'View Details',
    ctaUrl: ctaUrl || '',
    imageUrl: imageUrl || '',
    priority: priority || 'HIGH',
    type: type || 'ANNOUNCEMENT',
    isActive: true,
    publishedAt: Date.now(),
    validUntil: validUntil || Date.now() + 86400000 * 30,
  };
  announcements.unshift(newAnn);

  auditLogs.unshift({
    id: `audit_${Date.now()}`,
    adminId: 'ADMIN_SUPER',
    action: 'CREATE_ANNOUNCEMENT',
    target: newAnn.id,
    details: `Notice created: ${title}`,
    timestamp: Date.now(),
  });

  res.json({ success: true, announcement: newAnn });
});

app.put('/api/admin/announcements/:id', requireAdminAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  const ann = announcements.find(a => a.id === id);
  if (!ann) return res.status(404).json({ success: false, error: 'Announcement not found' });

  Object.assign(ann, req.body);
  res.json({ success: true, announcement: ann });
});

app.delete('/api/admin/announcements/:id', requireAdminAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  const idx = announcements.findIndex(a => a.id === id);
  if (idx !== -1) {
    announcements.splice(idx, 1);
  }
  res.json({ success: true });
});

// Dynamic Tasks Management
app.get('/api/admin/tasks', requireAdminAuth, (_req: Request, res: Response) => {
  res.json({ tasks: dynamicTasks });
});

function cleanTaskFields(src: any, base?: Partial<DynamicTask>): Partial<DynamicTask> {
  const out: any = {};
  if (src.title !== undefined) out.title = String(src.title || '').trim().slice(0, 120);
  if (src.description !== undefined) out.description = String(src.description || '').trim().slice(0, 500);
  if (src.platform !== undefined) out.platform = String(src.platform || 'TELEGRAM').trim().toUpperCase().slice(0, 30);
  if (src.url !== undefined) {
    const u = String(src.url || '').trim().slice(0, 500);
    out.url = /^https?:\/\//i.test(u) ? u : (base?.url || 'https://t.me/E4F_Exchange_Official');
  }
  if (src.rewardAsset !== undefined) out.rewardAsset = src.rewardAsset === 'USDT' ? 'USDT' : 'E4F';
  if (src.rewardAmount !== undefined) {
    const n = Number(src.rewardAmount);
    out.rewardAmount = isFinite(n) && n > 0 ? Math.round(Math.min(n, 100000) * 10000) / 10000 : (base?.rewardAmount || 1);
  }
  if (src.verificationMethod !== undefined) {
    out.verificationMethod = ['AUTO', 'MANUAL', 'TIMER'].includes(src.verificationMethod) ? src.verificationMethod : 'MANUAL';
  }
  const method = out.verificationMethod || base?.verificationMethod;
  if (src.durationSeconds !== undefined || method === 'TIMER') {
    const d = parseInt(String(src.durationSeconds ?? base?.durationSeconds ?? 30));
    out.durationSeconds = method === 'TIMER' || (isFinite(d) && d > 0) ? Math.max(5, Math.min(3600, isFinite(d) ? d : 30)) : undefined;
  }
  return out;
}

app.post('/api/admin/tasks', requireAdminAuth, (req: Request, res: Response) => {
  const fields: any = cleanTaskFields(req.body || {});
  if (!fields.title) return res.status(400).json({ success: false, error: 'Task title is required' });
  const newTask: DynamicTask = {
    id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    title: fields.title,
    description: fields.description || '',
    platform: fields.platform || 'TELEGRAM',
    url: fields.url || 'https://t.me/E4F_Exchange_Official',
    rewardAsset: fields.rewardAsset || 'E4F',
    rewardAmount: fields.rewardAmount || 1.0,
    status: 'AVAILABLE',
    verificationMethod: fields.verificationMethod || 'AUTO',
    durationSeconds: fields.durationSeconds,
  };
  dynamicTasks.push(newTask);

  auditLogs.unshift({
    id: `audit_${Date.now()}`,
    adminId: 'ADMIN_SUPER',
    action: 'CREATE_TASK',
    target: newTask.id,
    details: `Task created: ${newTask.title}`,
    timestamp: Date.now(),
  });

  res.json({ success: true, task: newTask });
});

app.put('/api/admin/tasks/:id', requireAdminAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  const task = dynamicTasks.find(t => t.id === id);
  if (!task) return res.status(404).json({ success: false, error: 'Task not found' });

  const fields: any = cleanTaskFields(req.body || {}, task);
  if (fields.title === '') delete fields.title;
  Object.assign(task, fields);
  res.json({ success: true, task });
});

app.delete('/api/admin/tasks/:id', requireAdminAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  const idx = dynamicTasks.findIndex(t => t.id === id);
  if (idx !== -1) {
    dynamicTasks.splice(idx, 1);
  }
  res.json({ success: true });
});

// Task Submissions Review Queue
app.get('/api/admin/task-submissions', requireAdminAuth, (_req: Request, res: Response) => {
  res.json({ submissions: taskSubmissionsQueue });
});

app.post('/api/admin/task-submissions/review', requireAdminAuth, async (req: Request, res: Response) => {
  const { submissionId, decision, adminNote } = req.body; // decision: 'APPROVE' | 'REJECT'
  const sub = taskSubmissionsQueue.find(s => s.id === submissionId);
  if (!sub) return res.status(404).json({ success: false, error: 'Submission not found' });

  if (sub.status !== 'SUBMITTED') {
    return res.status(400).json({ success: false, error: `Submission has already been ${sub.status.toLowerCase()}` });
  }

  const user = users.get(sub.userId);
  const userBalance = decision === 'APPROVE' ? await getSupabaseBalance(sub.userId) : null;
  let userSubs = userTaskSubmissions.get(sub.userId);
  if (!userSubs) {
    userSubs = [];
    userTaskSubmissions.set(sub.userId, userSubs);
  }

  const existingSub = userSubs.find(s => s.taskId === sub.taskId);

  if (decision === 'APPROVE') {
    try {
      if (!(await claimTaskOnce(sub.userId, sub.taskId))) {
        sub.status = 'APPROVED';
        return res.status(400).json({ success: false, error: 'This task was already rewarded to the user.' });
      }
    } catch (e) { return res.status(503).json({ success: false, error: 'Temporary storage error. Please try again.' }); }
    sub.status = 'APPROVED';
    sub.adminNote = adminNote || 'Approved by Administrator';

    if (existingSub) {
      existingSub.status = 'APPROVED';
    } else {
      userSubs.push({ taskId: sub.taskId, status: 'APPROVED', proof: sub.proof, timestamp: Date.now() });
    }

    if (userBalance) {
      if (sub.rewardAsset === 'USDT') {
        userBalance.usdt = Number((userBalance.usdt + sub.rewardAmount).toFixed(6));
      } else {
        userBalance.e4f = Number((userBalance.e4f + sub.rewardAmount).toFixed(6));
      }

      const taskSubTx: TxRecord = {
        id: `tx_${Date.now()}_tasksub`,
        userId: sub.userId,
        asset: sub.rewardAsset,
        amount: sub.rewardAmount,
        direction: 'IN',
        source: 'TASK_REWARD',
        status: 'COMPLETED',
        timestamp: Date.now(),
        note: `Proof Approved: ${sub.taskTitle}`,
      };
      recordTransaction(taskSubTx);
      setSupabaseBalance(sub.userId, userBalance).catch(() => {});
    }

    auditLogs.unshift({
      id: `audit_${Date.now()}`,
      adminId: 'ADMIN_SUPER',
      action: 'APPROVE_TASK_PROOF',
      target: sub.id,
      details: `Awarded ${sub.rewardAmount} ${sub.rewardAsset} to user ${user?.uid || sub.userId}`,
      timestamp: Date.now(),
    });
  } else {
    sub.status = 'REJECTED';
    sub.adminNote = adminNote || 'Rejected by Administrator: Insufficient or invalid proof';

    if (existingSub) {
      existingSub.status = 'REJECTED';
    } else {
      userSubs.push({ taskId: sub.taskId, status: 'REJECTED', proof: sub.proof, timestamp: Date.now() });
    }

    auditLogs.unshift({
      id: `audit_${Date.now()}`,
      adminId: 'ADMIN_SUPER',
      action: 'REJECT_TASK_PROOF',
      target: sub.id,
      details: `Rejected submission for task ${sub.taskTitle}. Note: ${sub.adminNote}`,
      timestamp: Date.now(),
    });
  }

  res.json({ success: true, submission: sub });
});

// Data Retention Policy: 90-day progressive purge for history records
app.post('/api/admin/cleanup-retention', requireAdminAuth, async (_req: Request, res: Response) => {
  const stats: any = apply90DayRetentionPolicy();
  let supabasePurgedWithdrawals = 0;

  if (supabase) {
    try {
      const { data, error } = await supabase.rpc('cleanup_old_withdrawals');
      if (!error && typeof data === 'number') {
        supabasePurgedWithdrawals = data;
        stats.purgedOldWithdrawals = supabasePurgedWithdrawals;
      } else if (error) {
        console.warn('[Supabase] Warning executing cleanup_old_withdrawals RPC:', error.message);
      }
    } catch (err: any) {
      console.warn('[Supabase] Exception running cleanup_old_withdrawals:', err);
    }
  }

  auditLogs.unshift({
    id: `audit_${Date.now()}`,
    adminId: 'ADMIN_SUPER',
    action: 'PURGE_EXPIRED_RECORDS_90_DAYS',
    target: 'DATABASE',
    details: `Cleaned up records older than 90 days (${stats.purgedTransactions} transactions, ${stats.purgedOrders} trade orders, ${stats.purgedReferrals} referrals, ${stats.purgedLogs} logs, ${stats.purgedSubmissions} task submissions, ${supabasePurgedWithdrawals} completed/rejected withdrawals). Pending/Processing withdrawals and history under 90 days are strictly preserved.`,
    timestamp: Date.now(),
  });

  persistDatabaseSync();

  res.json({
    success: true,
    message: `90-Day Retention Policy Executed: Records older than 90 days sequentially purged. Pending and processing withdrawals are strictly preserved.`,
    stats,
  });
});

app.get('/api/admin/audit-logs', requireAdminAuth, (_req: Request, res: Response) => {
  res.json({ logs: auditLogs });
});

// Admin Deposits Management (Manual Verification, Approval & Rejection)
app.get('/api/admin/deposits', requireAdminAuth, async (_req: Request, res: Response) => {
  let dbDeposits: any[] = [];
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('deposits')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && Array.isArray(data)) {
        dbDeposits = data;
      }
    } catch (err) {
      console.warn('[Supabase] Warning fetching deposits for admin:', err);
    }
  }

  // Merge with any in-memory deposit transactions
  const allMap = new Map<string, any>();
  for (const dep of dbDeposits) {
    allMap.set(dep.id, {
      id: dep.id,
      user_id: dep.user_id,
      asset: dep.asset || 'USDT',
      network: dep.network || 'BEP20',
      amount: Number(dep.amount) || 0,
      txid: dep.txid,
      sender_address: dep.sender_address,
      status: dep.status || 'PENDING',
      created_at: dep.created_at,
    });
  }

  for (const t of transactions) {
    if (t.source === 'DEPOSIT' && !allMap.has(t.id)) {
      allMap.set(t.id, {
        id: t.id,
        user_id: t.userId,
        asset: t.asset || 'USDT',
        network: t.network || 'BEP20',
        amount: t.amount,
        txid: t.referenceId || t.txHash || '',
        sender_address: t.address || '',
        status: t.status || 'PENDING',
        created_at: new Date(t.timestamp).toISOString(),
      });
    }
  }

  const depositList = Array.from(allMap.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  res.json({ success: true, deposits: depositList });
});

app.post('/api/admin/deposits/:id/review', requireAdminAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { decision, note } = req.body; // 'APPROVE' | 'REJECT'

  if (decision !== 'APPROVE' && decision !== 'REJECT') {
    return res.status(400).json({ success: false, error: 'Decision must be APPROVE or REJECT' });
  }

  // 1. Try atomic Supabase verification if Supabase is connected
  if (supabase) {
    try {
      if (decision === 'APPROVE') {
        const { data, error } = await supabase.rpc('verify_atomic_deposit', {
          p_deposit_id: id,
          p_admin_id: 'ADMIN_SUPER',
        });
        if (error) {
          console.warn('[Supabase] Error running verify_atomic_deposit:', error);
        } else if (data && data.success) {
          // Sync local in-memory state
          const tx = transactions.find(t => t.id === id);
          if (tx) tx.status = 'COMPLETED';
          return res.json({ success: true, message: 'Deposit verified and balance credited via Supabase', data });
        }
      } else {
        await supabase.from('deposits').update({ status: 'REJECTED' }).eq('id', id);
        await supabase.from('transactions').update({ status: 'REJECTED' }).eq('id', id);
        const tx = transactions.find(t => t.id === id);
        if (tx) tx.status = 'REJECTED';
        return res.json({ success: true, message: 'Deposit rejected in Supabase' });
      }
    } catch (err: any) {
      console.warn('[Supabase] Exception reviewing deposit:', err);
    }
  }

  // 2. In-memory fallback
  const tx = transactions.find(t => t.id === id && t.source === 'DEPOSIT');
  if (!tx) {
    return res.status(404).json({ success: false, error: 'Deposit record not found' });
  }

  if (tx.status !== 'PENDING') {
    return res.status(400).json({ success: false, error: `Deposit has already been marked as ${tx.status}` });
  }

  const user = users.get(tx.userId);
  let userBalance = balances.get(tx.userId);
  if (!userBalance) {
    userBalance = { usdt: 0, e4f: 0, bnb: 0, btc: 0, eth: 0, sol: 0, ton: 0, xrp: 0, doge: 0, ada: 0, trx: 0, ltc: 0 };
    balances.set(tx.userId, userBalance);
  }

  if (decision === 'APPROVE') {
    tx.status = 'COMPLETED';
    tx.note = note || `Verified by Admin. Blockchain TX confirmed.`;

    if (tx.asset === 'USDT') {
      userBalance.usdt = Number(((userBalance.usdt || 0) + tx.amount).toFixed(6));
      if (user) {
        user.depositBalance = Number(((user.depositBalance || 0) + tx.amount).toFixed(6));
      }
    } else {
      const assetKey = tx.asset.toLowerCase() as keyof BalanceRecord;
      if (assetKey in userBalance) {
        (userBalance as any)[assetKey] = Number((((userBalance as any)[assetKey] || 0) + tx.amount).toFixed(6));
      }
    }
    setSupabaseBalance(tx.userId, userBalance);

    auditLogs.unshift({
      id: `audit_${Date.now()}`,
      adminId: 'ADMIN_SUPER',
      action: 'APPROVE_DEPOSIT',
      target: tx.id,
      details: `Approved external deposit of ${tx.amount} ${tx.asset} for user ${user?.uid || tx.userId} (TXID: ${tx.referenceId || ''})`,
      timestamp: Date.now(),
    });
  } else {
    tx.status = 'REJECTED';
    tx.note = note || 'Rejected by Administrator during manual blockchain verification';

    auditLogs.unshift({
      id: `audit_${Date.now()}`,
      adminId: 'ADMIN_SUPER',
      action: 'REJECT_DEPOSIT',
      target: tx.id,
      details: `Rejected deposit ${tx.id} for user ${user?.uid || tx.userId}. Note: ${tx.note}`,
      timestamp: Date.now(),
    });
  }

  persistDatabaseSync();

  res.json({
    success: true,
    message: decision === 'APPROVE' ? 'Deposit approved and balance credited' : 'Deposit marked as rejected',
    transaction: tx,
    balances: userBalance,
  });
});


// ====================================================
// Vite Integration (Dev vs Prod) & Serverless Guard
// ====================================================
const isServerless = Boolean(
  process.env.VERCEL ||
  process.env.VERCEL_ENV ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.LAMBDA_TASK_ROOT
);

async function start() {
  if (isServerless) return;

  if (process.env.NODE_ENV !== 'production') {
    try {
      const dynamicImport = new Function('m', 'return import(m)');
      const viteModule = await dynamicImport('vite');
      const vite = await viteModule.createServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (e) {
      console.warn('Vite dev middleware could not be loaded:', e);
    }
  } else {
    const distPath = fs.existsSync(path.join(process.cwd(), 'dist', 'index.html'))
      ? path.join(process.cwd(), 'dist')
      : (typeof __dirname !== 'undefined' && fs.existsSync(path.join(__dirname, 'index.html')))
        ? __dirname
        : path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`E4F Web3 Exchange Server running on port ${PORT}`);
  });
}

if (!isServerless) {
  start();
}

export default app;
export { app };
