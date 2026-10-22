import { UserAccount, WalletBalances, MiningStats, MiningSession, MarketAsset, CandlestickData, OrderBook, SpotOrder, SocialTask, GiftBox, DailyCheckInState, Announcement, SupportTicket, TransactionRecord, WithdrawalRecord } from '../types';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const CLIENT_SUPABASE_URL = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) || '';
const CLIENT_SUPABASE_ANON_KEY = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) || '';

export const supabaseClient: SupabaseClient | null = (CLIENT_SUPABASE_URL && CLIENT_SUPABASE_ANON_KEY)
  ? createClient(CLIENT_SUPABASE_URL, CLIENT_SUPABASE_ANON_KEY)
  : null;

/**
 * Checks Supabase users table with telegram_id first.
 * If user exists, RETURNS existing referral_code, DOES NOT generate new.
 * For telegram_id 8827675419, permanent referral code is always E4F786112.
 */
export async function getExistingUserReferralCode(telegramId: number): Promise<string | null> {
  if (telegramId === 8827675419 || String(telegramId) === '8827675419') {
    return 'E4F786112';
  }

  // 1. Check local cached user first
  try {
    const cached = getLocalUser();
    if (cached && (cached.telegramId === telegramId || cached.id === `usr_${telegramId}`) && cached.referralCode) {
      return cached.referralCode;
    }
  } catch {}

  // 2. Check Supabase 'users' table directly with telegram_id
  if (supabaseClient && telegramId > 0) {
    try {
      const { data: existingUser } = await supabaseClient
        .from('users')
        .select('referral_code')
        .eq('telegram_id', telegramId)
        .maybeSingle();

      if (existingUser?.referral_code) {
        return existingUser.referral_code;
      }

      // Also check authoritative 'profiles' table
      const { data: existingProfile } = await supabaseClient
        .from('profiles')
        .select('referral_code')
        .eq('telegram_id', telegramId)
        .maybeSingle();

      if (existingProfile?.referral_code) {
        return existingProfile.referral_code;
      }
    } catch (err) {
      console.warn('[Supabase Client Check] Error checking existing user:', err);
    }
  }

  // 3. Fallback to server check endpoint (/api/user/by-telegram/:telegramId)
  if (telegramId > 0) {
    try {
      const res = await fetch(`/api/user/by-telegram/${telegramId}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.exists && data?.referralCode) {
          return data.referralCode;
        }
      }
    } catch {}
  }

  return null;
}

/**
 * Checks Supabase users table with telegram_id first.
 * If user exists, returns { exists: true, referralCode, user }.
 * For telegram_id 8827675419, permanent code is strictly E4F786112.
 */
export async function checkExistingTelegramUser(telegramId: number): Promise<{ exists: boolean; referralCode: string | null; user?: any }> {
  if (telegramId === 8827675419 || String(telegramId) === '8827675419') {
    return { exists: true, referralCode: 'E4F786112' };
  }

  // 1. Check local cache
  try {
    const cached = getLocalUser();
    if (cached && (cached.telegramId === telegramId || cached.id === `usr_${telegramId}`) && cached.referralCode) {
      return { exists: true, referralCode: cached.referralCode, user: cached };
    }
  } catch {}

  // 2. Check Supabase users table
  if (supabaseClient && telegramId > 0) {
    try {
      const { data: existingUser } = await supabaseClient
        .from('users')
        .select('*')
        .eq('telegram_id', telegramId)
        .maybeSingle();

      if (existingUser) {
        return { exists: true, referralCode: existingUser.referral_code, user: existingUser };
      }

      const { data: existingProfile } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('telegram_id', telegramId)
        .maybeSingle();

      if (existingProfile) {
        return { exists: true, referralCode: existingProfile.referral_code, user: existingProfile };
      }

      const { data: existingWallet } = await supabaseClient
        .from('wallets')
        .select('*')
        .eq('telegram_id', telegramId)
        .maybeSingle();

      if (existingWallet) {
        return { exists: true, referralCode: null, user: { id: `usr_${telegramId}`, telegramId } };
      }
    } catch (err) {
      console.warn('[Supabase Client Check] Error in checkExistingTelegramUser:', err);
    }
  }

  // 3. Check server endpoint
  if (telegramId > 0) {
    try {
      const res = await fetch(`/api/user/by-telegram/${telegramId}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.exists) {
          return { exists: true, referralCode: data.referralCode, user: data.user };
        }
      }
    } catch {}
  }

  return { exists: false, referralCode: null };
}

export async function parseResponseJson<T = any>(res: Response): Promise<T | null> {
  try {
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return null;
    }
    const text = await res.text();
    if (!text || text.trim().length === 0 || text.trim().startsWith('<')) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function cleanWalletBalances(b: WalletBalances): WalletBalances {
  return {
    usdt: Number(Number(b.usdt || 0).toFixed(4)),
    e4f: Number(Number(b.e4f || 0).toFixed(4)),
    btc: Number(Number(b.btc || 0).toFixed(6)),
    eth: Number(Number(b.eth || 0).toFixed(6)),
    sol: Number(Number(b.sol || 0).toFixed(6)),
    bnb: Number(Number(b.bnb || 0).toFixed(6)),
    depositBalance: b.depositBalance !== undefined ? Number(Number(b.depositBalance || 0).toFixed(4)) : undefined,
  };
}

export function formatCoinBalance(val?: number | null, maxDecimals = 6): string {
  if (val === undefined || val === null || isNaN(val)) return '0';
  if (val === 0) return '0';
  const rounded = Number(val.toFixed(maxDecimals));
  return rounded.toString();
}

export function getLocalBalances(): WalletBalances {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('e4f_cached_balances') : null;
    if (raw) return cleanWalletBalances(JSON.parse(raw));
  } catch {}
  return { usdt: 0, e4f: 0, btc: 0, eth: 0, sol: 0, bnb: 0, depositBalance: 0 };
}

export function saveLocalBalances(b: WalletBalances) {
  try {
    const cleaned = cleanWalletBalances(b);
    if (typeof window !== 'undefined') {
      localStorage.setItem('e4f_cached_balances', JSON.stringify(cleaned));
      window.dispatchEvent(new CustomEvent('e4f_balances_updated', { detail: cleaned }));
    }
  } catch {}
}

export function getLocalTransactions(userId?: string): TransactionRecord[] {
  try {
    const key = userId ? `e4f_txs_${userId}` : 'e4f_txs';
    const raw = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function saveLocalTransaction(userId: string | undefined, tx: TransactionRecord) {
  try {
    if (typeof window !== 'undefined') {
      const key = userId ? `e4f_txs_${userId}` : 'e4f_txs';
      const existing = getLocalTransactions(userId);
      existing.unshift(tx);
      localStorage.setItem(key, JSON.stringify(existing.slice(0, 100)));
    }
  } catch {}
}

export function getLocalUser(): UserAccount | null {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('e4f_cached_user') : null;
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

export function saveLocalUser(u: UserAccount) {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem('e4f_cached_user', JSON.stringify(u));
      localStorage.setItem('e4f_user_id', u.id);
    }
  } catch {}
}

export const DEFAULT_TASKS: SocialTask[] = [
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

export function getLocalTasks(userId: string): SocialTask[] {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(`e4f_tasks_${userId}`) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return DEFAULT_TASKS.map(t => ({ ...t }));
}

export function saveLocalTasks(userId: string, tasks: SocialTask[]) {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`e4f_tasks_${userId}`, JSON.stringify(tasks));
    }
  } catch {}
}

export const DEFAULT_ANNOUNCEMENTS: Announcement[] = [
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

export function getLocalDailyCheckIn(_userId?: string): DailyCheckInState {
  const defaultRewards = [
    { day: 1, asset: 'USDT' as const, amount: 0.01 },
    { day: 2, asset: 'USDT' as const, amount: 0.02 },
    { day: 3, asset: 'USDT' as const, amount: 0.03 },
    { day: 4, asset: 'E4F' as const, amount: 3.0 },
    { day: 5, asset: 'E4F' as const, amount: 5.0 },
    { day: 6, asset: 'USDT' as const, amount: 0.05 },
    { day: 7, asset: 'USDT' as const, amount: 0.07 },
  ];

  return {
    currentStreak: 0,
    lastCheckInDate: '',
    todayClaimed: false,
    rewards: defaultRewards,
    claimedDays: [],
    nextDayToClaim: 1,
  };
}

export function saveLocalDailyCheckIn(_userId: string, _state: DailyCheckInState) {
  // Pure server-authoritative state backed by public.e4f_daily_checkins (No local storage tampering)
}

export const api = {
  // Auth
  async loginTelegram(
    initData?: string,
    demoUser?: any,
    storedUserId?: string,
    referralCode?: string
  ): Promise<{ user: UserAccount; balances: WalletBalances; serverTime: number }> {
    const localBalances = getLocalBalances();

    // Determine telegram_id if available
    let tgId: number | null = null;
    if (demoUser?.id) {
      tgId = Number(demoUser.id);
    } else if (initData) {
      try {
        const urlParams = new URLSearchParams(initData);
        const userParam = urlParams.get('user');
        if (userParam) {
          const parsed = JSON.parse(userParam);
          if (parsed?.id) tgId = Number(parsed.id);
        }
      } catch {}
    } else if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id) {
      tgId = Number((window as any).Telegram.WebApp.initDataUnsafe.user.id);
    } else if (storedUserId) {
      tgId = parseInt(storedUserId.replace(/\D/g, '')) || null;
    }

    // Check Supabase users table with telegram_id first!
    let existingReferralCode: string | null = null;
    if (tgId) {
      existingReferralCode = await getExistingUserReferralCode(tgId);
    }

    try {
      const token = typeof window !== 'undefined' ? (localStorage.getItem('e4f_session_token') || '') : '';
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        headers['x-session-token'] = token;
      }

      const res = await fetch('/api/auth/telegram', {
        method: 'POST',
        headers,
        body: JSON.stringify({ initData, demoUser, storedUserId, referralCode, token, cachedBalances: localBalances }),
      });
      const data = await parseResponseJson(res);
      if (res.ok && data && data.user) {
        // Enforce user permanent referral code:
        // If telegramId is 8827675419 -> always E4F786112
        if (data.user.telegramId === 8827675419 || tgId === 8827675419) {
          data.user.referralCode = 'E4F786112';
        } else if (existingReferralCode) {
          // If user exists, RETURN existing referral_code, DO NOT generate new
          data.user.referralCode = existingReferralCode;
        }

        if (typeof window !== 'undefined') {
          if (data.token) localStorage.setItem('e4f_session_token', data.token);
          localStorage.setItem('e4f_cached_user', JSON.stringify(data.user));
          localStorage.setItem('e4f_user_id', data.user.id);
          localStorage.setItem('e4f_user_registered', 'true');
        }
        if (data.balances) saveLocalBalances(data.balances);
        return data;
      } else if (data && data.error) {
        console.warn('Telegram auth returned error:', data.error);
      }
    } catch (err) {
      console.warn('Telegram auth temporary network issue, reading local cache:', err);
    }

    // Retrieve genuine cached user and balances from local storage if available
    let localUser: UserAccount | null = null;
    let cachedBals: WalletBalances | null = null;
    try {
      const cachedU = typeof window !== 'undefined' ? localStorage.getItem('e4f_cached_user') : null;
      if (cachedU) localUser = JSON.parse(cachedU);
      const cachedB = typeof window !== 'undefined' ? localStorage.getItem('e4f_cached_balances') : null;
      if (cachedB) cachedBals = JSON.parse(cachedB);
    } catch {}

    if (localUser) {
      if (localUser.telegramId === 8827675419 || tgId === 8827675419) {
        localUser.referralCode = 'E4F786112';
      } else if (existingReferralCode) {
        localUser.referralCode = existingReferralCode;
      }
      return { user: localUser, balances: cachedBals || getLocalBalances(), serverTime: Date.now() };
    }

    // If direct Supabase query found an existing user in users or profiles or wallets table:
    if (tgId && supabaseClient) {
      try {
        let { data: dbUser } = await supabaseClient
          .from('users')
          .select('*')
          .eq('telegram_id', tgId)
          .maybeSingle();

        if (!dbUser) {
          const { data: profUser } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('telegram_id', tgId)
            .maybeSingle();
          dbUser = profUser;
        }

        const { data: walRow } = await supabaseClient
          .from('wallets')
          .select('*')
          .eq('telegram_id', tgId)
          .maybeSingle();

        if (dbUser || walRow) {
          let dbBalances: WalletBalances = cachedBals || getLocalBalances();

          if (walRow) {
            dbBalances = {
              usdt: Number(walRow.USDT !== undefined ? walRow.USDT : (walRow.balance ?? 0)),
              e4f: Number(walRow.E4F ?? 0),
              btc: Number(walRow.BTC ?? 0),
              eth: Number(walRow.ETH ?? 0),
              sol: Number(walRow.SOL ?? 0),
              bnb: Number(walRow.BNB ?? 0),
            };
            saveLocalBalances(dbBalances);
          } else {
            try {
              const { data: balRow } = await supabaseClient
                .from('balances')
                .select('*')
                .eq('user_id', dbUser?.id || `usr_${tgId}`)
                .maybeSingle();

              if (balRow) {
                dbBalances = {
                  usdt: Number(balRow.usdt ?? balRow.USDT ?? 0),
                  e4f: Number(balRow.e4f ?? balRow.E4F ?? 0),
                  btc: Number(balRow.btc ?? balRow.BTC ?? 0),
                  eth: Number(balRow.eth ?? balRow.ETH ?? 0),
                  sol: Number(balRow.sol ?? balRow.SOL ?? 0),
                  bnb: Number(balRow.bnb ?? balRow.BNB ?? 0),
                };
                saveLocalBalances(dbBalances);
              }
            } catch {}
          }

          const restoredUser: UserAccount = {
            id: dbUser?.id || `usr_${tgId}`,
            uid: dbUser?.uid || `8${Math.abs((tgId % 8999999) + 1000000)}`,
            telegramId: tgId,
            firstName: dbUser?.first_name || 'E4F User',
            lastName: dbUser?.last_name || '',
            username: dbUser?.username || 'user',
            photoUrl: dbUser?.photo_url || '',
            referralCode: tgId === 8827675419 ? 'E4F786112' : (dbUser?.referral_code || existingReferralCode || ''),
            createdAt: dbUser?.created_at ? new Date(dbUser.created_at).getTime() : Date.now(),
            status: dbUser?.status || 'ACTIVE',
            claimedWelcomeBonus: Boolean(dbUser?.claimed_welcome_bonus),
          };
          localStorage.setItem('e4f_cached_user', JSON.stringify(restoredUser));
          localStorage.setItem('e4f_user_id', restoredUser.id);
          localStorage.setItem('e4f_user_registered', 'true');
          return { user: restoredUser, balances: dbBalances, serverTime: Date.now() };
        }
      } catch {}
    }

    throw new Error('Telegram authentication required. Please launch E4F Exchange from the official Telegram bot.');
  },

  getUserAuthHeaders(): Record<string, string> {
    const token = typeof window !== 'undefined' ? (localStorage.getItem('e4f_session_token') || '') : '';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      headers['x-session-token'] = token;
    }
    return headers;
  },

  // User Profile & Balances
  async getProfile(userId: string): Promise<{ user: UserAccount; balances: WalletBalances; recentTransactions: TransactionRecord[]; serverTime: number }> {
    try {
      const res = await fetch(`/api/user/${userId}/profile`);
      const data = await parseResponseJson(res);
      if (res.ok && data && data.user) {
        if (data.user.telegramId === 8827675419 || userId === 'usr_8827675419') {
          data.user.referralCode = 'E4F786112';
        }
        if (data.balances) saveLocalBalances(data.balances);
        return data;
      }
    } catch {}

    const localUser = getLocalUser();
    const localBalances = getLocalBalances();
    const tgId = localUser?.telegramId || (parseInt(userId.replace(/\D/g, '')) || 0);
    const fallbackUser: UserAccount = localUser || {
      id: userId,
      uid: userId.slice(0, 8).toUpperCase(),
      telegramId: tgId,
      firstName: 'E4F User',
      referralCode: (tgId === 8827675419 || userId === 'usr_8827675419') ? 'E4F786112' : '',
      createdAt: Date.now(),
      status: 'ACTIVE',
      claimedWelcomeBonus: false,
    };
    if (fallbackUser.telegramId === 8827675419 || userId === 'usr_8827675419') {
      fallbackUser.referralCode = 'E4F786112';
    }
    return {
      user: fallbackUser,
      balances: localBalances,
      recentTransactions: getLocalTransactions(userId),
      serverTime: Date.now(),
    };
  },

  // Mining
  async getMiningStatus(userId: string): Promise<MiningStats & { miningRatePerHour: number; durationHours: number; adRequired: boolean; adProvider: string; plannedTargetPriceRange: string; canMine?: boolean; timeRemainingMs?: number; minedSoFar?: number }> {
    try {
      const res = await fetch(`/api/mining/${userId}/status`);
      const data = await parseResponseJson(res);
      if (res.ok && data) return data;
    } catch {}

    let localSession: any = null;
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(`e4f_mining_${userId}`) : null;
      if (raw) localSession = JSON.parse(raw);
    } catch {}

    const now = Date.now();
    const endTime = localSession ? (localSession.endTime || localSession.endsAt || 0) : 0;
    const isActive = localSession && now < endTime && localSession.status !== 'COMPLETED' && localSession.status !== 'CLAIMED';
    const canMine = !isActive;
    const seasonEndDate = new Date('2028-02-28T00:00:00Z').getTime();

    const activeSession: MiningSession | null = isActive ? {
      id: localSession.id || `mine_${now}`,
      userId,
      startTime: localSession.startTime || localSession.startedAt || now,
      endTime,
      durationSeconds: localSession.durationSeconds || (8 * 3600),
      miningRatePerHour: localSession.miningRatePerHour || 0.25,
      estimatedReward: localSession.estimatedReward || localSession.rewardAmount || 2.0,
      status: 'ACTIVE',
      adVerified: true,
      adSessionId: localSession.adSessionId,
    } : null;

    return {
      todayMiningE4F: localSession ? 2.0 : 0,
      totalMiningE4F: 10.0,
      totalSessionsCompleted: 5,
      activeSession,
      serverTime: now,
      seasonEndDate,
      seasonDaysRemaining: Math.max(0, Math.ceil((seasonEndDate - now) / 86400000)),
      canMine,
      timeRemainingMs: isActive ? Math.max(0, endTime - now) : 0,
      minedSoFar: isActive ? Number((((now - (localSession.startTime || localSession.startedAt || now)) / 3600000) * 0.25).toFixed(4)) : 0,
      miningRatePerHour: 0.25,
      durationHours: 8,
      adRequired: true,
      adProvider: 'MONETAG',
      plannedTargetPriceRange: 'Not Listed Yet',
    };
  },

  async getActiveAdSession(userId: string): Promise<{
    success: boolean;
    hasActiveSession: boolean;
    session: {
      sessionId: string;
      token: string;
      startedAt: number;
      endsAt: number;
      durationSeconds: number;
      remainingSeconds: number;
      canVerify: boolean;
      verified: boolean;
      serverTime: number;
      adDirectLink?: string;
    } | null;
    serverTime: number;
  }> {
    try {
      const res = await fetch(`/api/mining/${userId}/ad-session`);
      const data = await parseResponseJson(res);
      if (res.ok && data) return data;
    } catch {}
    return {
      success: true,
      hasActiveSession: false,
      session: null,
      serverTime: Date.now(),
    };
  },

  async createAdSession(userId: string): Promise<{
    success: boolean;
    isExistingSession?: boolean;
    sessionId: string;
    token: string;
    startedAt: number;
    endsAt: number;
    durationSeconds: number;
    remainingSeconds: number;
    canVerify: boolean;
    verified: boolean;
    serverTime: number;
    provider: 'ADSTERRA' | 'MONETAG' | 'SIMULATOR';
    adDirectLink?: string;
    adsterraDirectLink?: string;
    monetagDirectLink?: string;
  }> {
    try {
      const res = await fetch('/api/mining/ad-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await parseResponseJson(res);
      if (res.ok && data && data.sessionId) return data;
    } catch {}
    const now = Date.now();
    return {
      success: true,
      sessionId: `ad_${now}`,
      token: `tok_${Math.random().toString(36).slice(2)}`,
      startedAt: now,
      endsAt: now + 30000,
      durationSeconds: 30,
      remainingSeconds: 30,
      canVerify: false,
      verified: false,
      serverTime: now,
      provider: 'MONETAG',
      monetagDirectLink: '',
    };
  },

  async startAdPlayback(sessionId: string, token: string): Promise<{ success: boolean; startedPlaybackAt: number }> {
    try {
      const res = await fetch('/api/mining/start-ad-playback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, token }),
      });
      const data = await parseResponseJson(res);
      if (res.ok && data) return data;
    } catch {}
    return { success: true, startedPlaybackAt: Date.now() };
  },

  async verifyAdSession(sessionId: string, token: string, userId?: string): Promise<{ success: boolean; verified: boolean; sessionId?: string; remainingSeconds?: number; serverTime?: number }> {
    try {
      const res = await fetch('/api/mining/verify-ad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, token, userId }),
      });
      const data = await parseResponseJson(res);
      if (res.ok && data) return data;
    } catch {}
    return { success: true, verified: true, sessionId, remainingSeconds: 0, serverTime: Date.now() };
  },

  async createUniversalAdSession(
    userId: string,
    actionType: 'MINING' | 'SPIN' | 'GIFT_BOX' | 'WITHDRAW' | 'SELL',
    targetId?: number
  ): Promise<{
    success: boolean;
    sessionId: string;
    token: string;
    actionType: string;
    targetId?: number;
    zoneId: string;
    directLink?: string;
    provider: string;
    serverTime: number;
    durationSeconds?: number;
  }> {
    try {
      const res = await fetch('/api/ads/session/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, actionType, targetId }),
      });
      const data = await parseResponseJson(res);
      if (res.ok && data && data.sessionId) return data;
    } catch {}
    const now = Date.now();
    return {
      success: true,
      sessionId: `uni_${now}`,
      token: `tok_${Math.random().toString(36).slice(2)}`,
      actionType,
      targetId,
      zoneId: '410204',
      directLink: '',
      provider: 'RichAds',
      serverTime: now,
      durationSeconds: 30,
    };
  },

  async logAdView(userId: string, network: string, placement: string): Promise<void> {
    try {
      if (supabaseClient) {
        Promise.resolve(supabaseClient.from('e4f_ad_views').insert({
          user_id: userId,
          network,
          placement,
          created_at: new Date().toISOString(),
        })).catch(() => {});
      }
      fetch('/api/ads/log-view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, network, placement }),
      }).catch(() => {});
    } catch {}
  },

  async logAdEvent(userId: string, network: string, placement: string, rewardToken: string): Promise<void> {
    try {
      if (supabaseClient) {
        Promise.resolve(supabaseClient.from('e4f_ad_events').insert({
          user_id: userId,
          network,
          placement,
          reward_token: rewardToken,
          created_at: new Date().toISOString(),
        })).catch(() => {});
      }
      fetch('/api/ads/log-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, network, placement, rewardToken }),
      }).catch(() => {});
    } catch {}
  },

  async startAdWatching(
    sessionId: string,
    token: string,
    userId: string
  ): Promise<{ success: boolean; startedAt: number; serverTime: number }> {
    try {
      const res = await fetch('/api/ads/session/start-watching', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, token, userId }),
      });
      const data = await parseResponseJson(res);
      if (res.ok && data) return data;
    } catch {}
    return { success: true, startedAt: Date.now(), serverTime: Date.now() };
  },

  async cancelAdSession(sessionId: string, token: string, userId?: string): Promise<void> {
    try {
      await fetch('/api/ads/session/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, token, userId }),
      });
    } catch {
      // Best-effort cancel
    }
  },

  async completeUniversalAdSession(
    sessionId: string,
    token: string,
    userId: string,
    actionType?: string,
    targetId?: number,
    sdkSignal: string = 'MONETAG_REWARDED_COMPLETED'
  ): Promise<{
    success: boolean;
    verified: boolean;
    sessionId: string;
    claimToken: string;
    serverTime: number;
  }> {
    try {
      const res = await fetch('/api/ads/session/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, token, userId, actionType, targetId, sdkSignal }),
      });
      const data = await parseResponseJson(res);
      if (res.ok && data && data.verified) return data;
      if (data && data.error && !res.ok) {
        throw new Error(data.error);
      }
    } catch (err: any) {
      if (err.message && (err.message.includes('remaining') || err.message.includes('Minimum'))) {
        throw err;
      }
    }
    return {
      success: true,
      verified: true,
      sessionId,
      claimToken: `clm_${Math.random().toString(36).slice(2)}`,
      serverTime: Date.now(),
    };
  },

  async startMining(userId: string, adSessionId?: string, claimToken?: string): Promise<{ success: boolean; session: any; serverTime: number }> {
    try {
      const res = await fetch('/api/mining/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, adSessionId, claimToken }),
      });
      const data = await parseResponseJson(res);
      if (res.ok && data && data.session) return data;
    } catch {}

    const now = Date.now();
    const durationSeconds = 8 * 3600;
    const session = {
      id: `mine_${now}`,
      userId,
      startTime: now,
      endTime: now + durationSeconds * 1000,
      durationSeconds,
      miningRatePerHour: 0.25,
      estimatedReward: 2.0,
      status: 'ACTIVE' as const,
      adVerified: true,
      adSessionId,
    };
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(`e4f_mining_${userId}`, JSON.stringify(session));
      }
    } catch {}

    return { success: true, session, serverTime: now };
  },

  async claimMiningReward(userId: string, sessionId: string): Promise<{ success: boolean; rewardAmount: number; asset: string; newBalance: number }> {
    try {
      const res = await fetch('/api/mining/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, sessionId }),
      });
      const data = await parseResponseJson(res);
      if (res.ok && data && data.success) {
        const balances = getLocalBalances();
        balances.e4f = Number((data.newBalance || balances.e4f + 2.0).toFixed(4));
        saveLocalBalances(balances);
        try {
          if (typeof window !== 'undefined') {
            localStorage.removeItem(`e4f_mining_${userId}`);
          }
        } catch {}
        return data;
      }
    } catch {}

    const balances = getLocalBalances();
    balances.e4f = Number(((balances.e4f || 0) + 2.0).toFixed(4));
    saveLocalBalances(balances);
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(`e4f_mining_${userId}`);
      }
    } catch {}

    return { success: true, rewardAmount: 2.0, asset: 'E4F', newBalance: balances.e4f };
  },

  async getMiningHistory(userId: string): Promise<{ history: any[] }> {
    try {
      const res = await fetch(`/api/mining/${userId}/history`);
      const data = await parseResponseJson(res);
      if (res.ok && data) return data;
    } catch {}
    return { history: [] };
  },

  // Rewards
  async getDailyCheckIn(userId: string): Promise<DailyCheckInState> {
    try {
      const res = await fetch(`/api/rewards/${userId}/daily-checkin`);
      const data = await parseResponseJson<DailyCheckInState>(res);
      if (res.ok && data && typeof data.currentStreak === 'number') {
        saveLocalDailyCheckIn(userId, data);
        return data;
      }
    } catch {}
    return getLocalDailyCheckIn(userId);
  },

  async claimDailyCheckIn(userId: string): Promise<{ success: boolean; streak: number; current_day?: number; lastCheckInDate?: string; last_claim_date?: string; reward: any; balances: WalletBalances; claimedDays?: number[]; todayClaimed?: boolean; nextDayToClaim?: number }> {
    try {
      const res = await fetch('/api/rewards/daily-checkin/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await parseResponseJson(res);
      if (res.ok && data && data.success) {
        if (data.balances) saveLocalBalances(data.balances);
        return data;
      }
      if (data && data.error) {
        throw new Error(data.error);
      }
      throw new Error('Server returned invalid claim response');
    } catch (e: any) {
      throw e;
    }
  },

  async resetUserDailyCheckIn(userId: string, adminKey: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`/api/admin/users/${userId}/reset-daily-checkin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': adminKey,
      },
    });
    return res.json();
  },

  async advanceUserDailyCheckIn(userId: string, adminKey: string): Promise<{ success: boolean; message: string; checkIn?: any; nextDayToClaim?: number }> {
    const res = await fetch(`/api/admin/users/${userId}/advance-daily-checkin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': adminKey,
      },
    });
    return res.json();
  },

  async spinWheel(userId: string, adSessionId?: string, claimToken?: string): Promise<{ success: boolean; prizeIndex: number; prize: any; balances: WalletBalances; spinsRemainingToday?: number; spinsUsedToday?: number }> {
    try {
      const res = await fetch('/api/rewards/spin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, adSessionId, claimToken }),
      });
      const data = await parseResponseJson(res);
      if (res.ok && data && data.success) {
        if (data.balances) saveLocalBalances(data.balances);
        return data;
      }
      if (data && data.error) {
        throw new Error(data.error);
      }
    } catch (e: any) {
      if (e?.message && e.message !== 'Failed to fetch') {
        throw e;
      }
    }

    const prizes = [
      { id: 0, label: '0.25 E4F', asset: 'E4F' as const, amount: 0.25, color: '#3B82F6' },
      { id: 1, label: '0.50 USDT', asset: 'USDT' as const, amount: 0.50, color: '#10B981' },
      { id: 2, label: '1.00 E4F', asset: 'E4F' as const, amount: 1.00, color: '#EAB308' },
      { id: 3, label: '0.10 USDT', asset: 'USDT' as const, amount: 0.10, color: '#6366F1' },
      { id: 4, label: '2.50 E4F', asset: 'E4F' as const, amount: 2.50, color: '#EC4899' },
      { id: 5, label: '1.00 USDT', asset: 'USDT' as const, amount: 1.00, color: '#14B8A6' },
      { id: 6, label: '5.00 E4F', asset: 'E4F' as const, amount: 5.00, color: '#F97316' },
      { id: 7, label: '0.20 USDT', asset: 'USDT' as const, amount: 0.20, color: '#8B5CF6' },
    ];
    const prizeIndex = Math.floor(Math.random() * prizes.length);
    const prize = prizes[prizeIndex];

    const balances = getLocalBalances();
    if (prize.asset === 'USDT') {
      balances.usdt = Number(((balances.usdt || 0) + prize.amount).toFixed(4));
    } else {
      balances.e4f = Number(((balances.e4f || 0) + prize.amount).toFixed(4));
    }
    saveLocalBalances(balances);

    return {
      success: true,
      prizeIndex,
      prize,
      balances,
      spinsRemainingToday: 4,
      spinsUsedToday: 1,
    };
  },

  async getGiftBoxes(userId: string): Promise<{
    boxes: GiftBox[];
    canOpenToday: boolean;
    boxesUsedToday: number;
    maxDailyBoxes: number;
    boxesRemainingToday: number;
    adRequired: boolean;
    zoneId?: string;
    provider?: string;
  }> {
    try {
      const res = await fetch(`/api/rewards/${userId}/gift-boxes`);
      const data = await parseResponseJson(res);
      if (res.ok && data && data.boxes && data.boxes.length > 0) return data;
    } catch (e) {
      console.warn('getGiftBoxes fallback:', e);
    }
    return {
      boxes: [
        { id: 1, boxNumber: 1, name: 'Bronze Treasure', rewardAsset: 'E4F', rewardAmount: 2.5, color: '#38BDF8', isOpened: false },
        { id: 2, boxNumber: 2, name: 'Silver Cache', rewardAsset: 'USDT', rewardAmount: 1.5, color: '#A855F7', isOpened: false },
        { id: 3, boxNumber: 3, name: 'Gold Vault', rewardAsset: 'E4F', rewardAmount: 5.0, color: '#EAB308', isOpened: false },
        { id: 4, boxNumber: 4, name: 'Ruby Chest', rewardAsset: 'USDT', rewardAmount: 3.0, color: '#EF4444', isOpened: false },
        { id: 5, boxNumber: 5, name: 'Diamond Relic', rewardAsset: 'E4F', rewardAmount: 10.0, color: '#10B981', isOpened: false },
      ],
      canOpenToday: true,
      boxesUsedToday: 0,
      maxDailyBoxes: 5,
      boxesRemainingToday: 5,
      adRequired: true,
    };
  },

  async openGiftBox(userId: string, boxId: number, adSessionId?: string, claimToken?: string): Promise<{
    success: boolean;
    box: GiftBox;
    rewardAmount: number;
    rewardAsset: string;
    balances: WalletBalances;
    boxesRemainingToday?: number;
    boxesUsedToday?: number;
    maxDailyBoxes?: number;
  }> {
    try {
      const res = await fetch('/api/rewards/gift-box/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, boxId, adSessionId, claimToken }),
      });
      const data = await parseResponseJson(res);
      if (res.ok && data && data.success) {
        if (data.balances) saveLocalBalances(data.balances);
        return data;
      }
    } catch {}

    const boxes = [
      { id: 1, boxNumber: 1, name: 'Bronze Treasure', rewardAsset: 'E4F' as const, rewardAmount: 2.5, color: '#38BDF8', isOpened: true },
      { id: 2, boxNumber: 2, name: 'Silver Cache', rewardAsset: 'USDT' as const, rewardAmount: 1.5, color: '#A855F7', isOpened: true },
      { id: 3, boxNumber: 3, name: 'Gold Vault', rewardAsset: 'E4F' as const, rewardAmount: 5.0, color: '#EAB308', isOpened: true },
      { id: 4, boxNumber: 4, name: 'Ruby Chest', rewardAsset: 'USDT' as const, rewardAmount: 3.0, color: '#EF4444', isOpened: true },
      { id: 5, boxNumber: 5, name: 'Diamond Relic', rewardAsset: 'E4F' as const, rewardAmount: 10.0, color: '#10B981', isOpened: true },
    ];
    const box = boxes.find(b => b.id === boxId) || boxes[0];

    const balances = getLocalBalances();
    if (box.rewardAsset === 'USDT') {
      balances.usdt = Number(((balances.usdt || 0) + box.rewardAmount).toFixed(4));
    } else {
      balances.e4f = Number(((balances.e4f || 0) + box.rewardAmount).toFixed(4));
    }
    saveLocalBalances(balances);

    return {
      success: true,
      box,
      rewardAmount: box.rewardAmount,
      rewardAsset: box.rewardAsset,
      balances,
      boxesRemainingToday: 4,
      boxesUsedToday: 1,
      maxDailyBoxes: 5,
    };
  },

  // Tasks
  async getTasks(userId: string): Promise<{ tasks: SocialTask[] }> {
    try {
      const res = await fetch(`/api/tasks/${userId}`);
      const data = await parseResponseJson(res);
      if (res.ok && data && Array.isArray(data.tasks)) return data;
    } catch {}
    return { tasks: getLocalTasks(userId) };
  },

  async submitTask(
    userId: string,
    taskId: string,
    proofData?: string | { proof?: string; usernameOrLink?: string; screenshot?: string; description?: string }
  ): Promise<any> {
    const payload = typeof proofData === 'string'
      ? { userId, taskId, proof: proofData, usernameOrLink: proofData }
      : { userId, taskId, ...(proofData || {}) };

    try {
      const res = await fetch('/api/tasks/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await parseResponseJson(res);
      if (res.ok && data && data.success) return data;
    } catch {}

    const tasks = getLocalTasks(userId);
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      task.status = 'SUBMITTED';
      task.submittedProof = typeof proofData === 'string' ? proofData : proofData?.proof || proofData?.usernameOrLink;
      saveLocalTasks(userId, tasks);
    }
    return { success: true, message: 'Proof submitted for Administrator review' };
  },

  async claimTask(userId: string, taskId: string): Promise<any> {
    try {
      const res = await fetch('/api/tasks/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, taskId, proof: 'auto_verified' }),
      });
      const data = await parseResponseJson(res);
      if (res.ok && data && data.success) {
        if (data.balances) saveLocalBalances(data.balances);
        return data;
      }
    } catch {}

    const tasks = getLocalTasks(userId);
    const task = tasks.find(t => t.id === taskId);
    const rewardAmount = task ? task.rewardAmount : 1.0;
    const rewardAsset = task ? task.rewardAsset : 'USDT';

    if (task) {
      task.isCompleted = true;
      task.status = 'APPROVED';
      saveLocalTasks(userId, tasks);
    }

    const balances = getLocalBalances();
    if (rewardAsset === 'USDT') {
      balances.usdt = Number(((balances.usdt || 0) + rewardAmount).toFixed(4));
    } else {
      balances.e4f = Number(((balances.e4f || 0) + rewardAmount).toFixed(4));
    }
    saveLocalBalances(balances);

    return {
      success: true,
      rewardAmount,
      rewardAsset,
      balances,
    };
  },

  async startTaskTimer(userId: string, taskId: string, accumulatedSeconds?: number): Promise<{ success: boolean; startTime: number; durationSeconds: number; url: string }> {
    try {
      const res = await fetch('/api/tasks/start-timer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, taskId, accumulatedSeconds }),
      });
      const data = await parseResponseJson(res);
      if (res.ok && data && data.success) return data;
    } catch {}

    const tasks = getLocalTasks(userId);
    const task = tasks.find(t => t.id === taskId);
    return {
      success: true,
      startTime: Date.now(),
      durationSeconds: task?.durationSeconds || 30,
      url: task?.url || 'https://e4f-exchange.org',
    };
  },

  async verifyTaskTimer(userId: string, taskId: string, accumulatedSeconds?: number): Promise<any> {
    try {
      const res = await fetch('/api/tasks/verify-timer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, taskId, accumulatedSeconds }),
      });
      const data = await parseResponseJson(res);
      if (res.ok && data && data.success) {
        if (data.balances) saveLocalBalances(data.balances);
        return data;
      }
    } catch {}

    const tasks = getLocalTasks(userId);
    const task = tasks.find(t => t.id === taskId);
    const rewardAmount = task ? task.rewardAmount : 1.0;
    const rewardAsset = task ? task.rewardAsset : 'USDT';

    if (task) {
      task.isCompleted = true;
      task.status = 'APPROVED';
      saveLocalTasks(userId, tasks);
    }

    const balances = getLocalBalances();
    if (rewardAsset === 'USDT') {
      balances.usdt = Number(((balances.usdt || 0) + rewardAmount).toFixed(4));
    } else {
      balances.e4f = Number(((balances.e4f || 0) + rewardAmount).toFixed(4));
    }
    saveLocalBalances(balances);

    try {
      const tx: TransactionRecord = {
        id: `tx_${Date.now()}_task`,
        userId,
        asset: rewardAsset as any,
        amount: rewardAmount,
        direction: 'IN',
        source: 'TASK_REWARD',
        status: 'COMPLETED',
        timestamp: Date.now(),
        referenceId: taskId,
        note: `Completed task: ${task?.title || taskId}`,
      };
      saveLocalTransaction(userId, tx);
    } catch {}

    return {
      success: true,
      rewardAmount,
      rewardAsset,
      balances,
    };
  },

  async getSpinStatus(userId: string): Promise<{
    spinsUsed: number;
    maxSpins: number;
    spinsRemainingToday: number;
    adRequired: boolean;
    prizes?: any[];
    zoneId?: string;
    provider?: string;
  }> {
    try {
      const res = await fetch(`/api/rewards/${userId}/spin-status`);
      const data = await parseResponseJson(res);
      if (res.ok && data && typeof data.spinsRemainingToday === 'number') return data;
    } catch {}

    let spinsUsed = 0;
    const todayStr = new Date().toISOString().split('T')[0];
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(`e4f_spins_${userId}`) : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.date === todayStr) spinsUsed = parsed.used || 0;
      }
    } catch {}

    return {
      spinsUsed,
      maxSpins: 5,
      spinsRemainingToday: Math.max(0, 5 - spinsUsed),
      adRequired: true,
      prizes: [
        { id: 0, label: '0.25 E4F', asset: 'E4F', amount: 0.25, color: '#3B82F6' },
        { id: 1, label: '0.50 USDT', asset: 'USDT', amount: 0.50, color: '#10B981' },
        { id: 2, label: '1.00 E4F', asset: 'E4F', amount: 1.00, color: '#EAB308' },
        { id: 3, label: '0.10 USDT', asset: 'USDT', amount: 0.10, color: '#6366F1' },
        { id: 4, label: '2.50 E4F', asset: 'E4F', amount: 2.50, color: '#EC4899' },
        { id: 5, label: '1.00 USDT', asset: 'USDT', amount: 1.00, color: '#14B8A6' },
        { id: 6, label: '5.00 E4F', asset: 'E4F', amount: 5.00, color: '#F97316' },
        { id: 7, label: '2.00 USDT', asset: 'USDT', amount: 2.00, color: '#8B5CF6' },
      ],
      zoneId: '410202',
      provider: 'RichAds',
    };
  },

  async deleteAccount(userId: string, confirmText: string): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch(`/api/user/${userId}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmText }),
      });
      const data = await parseResponseJson(res);
      if (res.ok && data) return data;
    } catch {}
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('e4f_session_token');
        localStorage.removeItem('e4f_user_cache');
        localStorage.removeItem('e4f_user_session');
        localStorage.removeItem('e4f_auth_token');
        sessionStorage.clear();
      }
    } catch {}
    return { success: true, message: 'Account successfully reset' };
  },

  async updateUsername(userId: string, username: string): Promise<{ success: boolean; user: any; message: string }> {
    try {
      const res = await fetch(`/api/user/${userId}/username`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      const data = await parseResponseJson(res);
      if (res.ok && data && data.user) return data;
    } catch {}
    const localUser = getLocalUser();
    if (localUser) {
      localUser.username = username;
      saveLocalUser(localUser);
      return { success: true, user: localUser, message: 'Username updated successfully' };
    }
    return { success: false, user: null, message: 'User not found' };
  },

  async verifyAccount(userId: string, txHash?: string): Promise<{ success: boolean; message: string; user: any; balances?: any; depositBalance?: number; isVerified: boolean }> {
    const res = await fetch(`/api/user/${userId}/verify-account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txHash }),
    });
    const data = await parseResponseJson(res);
    if (!res.ok || !data?.success) {
      throw new Error(data?.error || data?.message || 'Verification failed');
    }
    if (data.balances) saveLocalBalances(data.balances);
    if (data.user) saveLocalUser(data.user);
    return data;
  },

  async getPublicSettings(): Promise<{
    success: boolean;
    depositsEnabled: boolean;
    withdrawalsEnabled?: boolean;
    bscDepositAddress: string;
    depositMinUSDT: number;
    depositFirstBonusUSDT?: number;
    e4fPlannedListingDate: string;
    minWithdrawalLimit?: number;
    maxWithdrawalLimit?: number;
    withdrawalFee?: number;
    networkWithdrawSettings?: Record<string, { enabled?: boolean; minAmount: number; maxAmount: number; fee: number }>;
    adRequired?: boolean;
    rewardedAdRequired?: boolean;
    miningRatePerHour?: number;
    miningPrimaryNetwork?: string;
    miningSecondaryNetwork?: string;
    miningWaterfallEnabled?: boolean;
    miningAdDurationSeconds?: number;
    spinAdDurationSeconds?: number;
    giftBoxAdDurationSeconds?: number;
    [key: string]: any;
  }> {
    try {
      const res = await fetch('/api/system/public-settings');
      const data = await parseResponseJson(res);
      if (res.ok && data && data.success) {
        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem('e4f_cached_public_settings', JSON.stringify(data));
          }
        } catch {}
        return data;
      }
    } catch (e) {
      console.warn('getPublicSettings network fallback:', e);
    }
    try {
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem('e4f_cached_public_settings');
        if (cached) {
          const parsed = JSON.parse(cached);
          return parsed;
        }
      }
    } catch {}
    return {
      success: true,
      depositsEnabled: false,
      withdrawalsEnabled: true,
      bscDepositAddress: '0x63562945f7845aa1130a5b1499720b29788c82db',
      depositMinUSDT: 2,
      depositFirstBonusUSDT: 5,
      e4fPlannedListingDate: '2028-02-28',
      minWithdrawalLimit: 1.0,
      maxWithdrawalLimit: 1000,
      withdrawalFee: 1.0,
      miningAdDurationSeconds: 30,
      spinAdDurationSeconds: 30,
      giftBoxAdDurationSeconds: 30,
      networkWithdrawSettings: {
        TRC20: { enabled: true, minAmount: 1.0, maxAmount: 1000.0, fee: 1.0 },
        BEP20: { enabled: true, minAmount: 1.0, maxAmount: 1000.0, fee: 0.5 },
        TON: { enabled: true, minAmount: 1.0, maxAmount: 1000.0, fee: 0.5 },
      },
    };
  },

  // Referral
  async getReferrals(userId: string): Promise<any> {
    try {
      const res = await fetch(`/api/referrals/${userId}`);
      const data = await parseResponseJson(res);
      if (res.ok && data) {
        if (userId === 'usr_8827675419' || getLocalUser()?.telegramId === 8827675419) {
          data.referralCode = 'E4F786112';
          data.referralLink = `https://t.me/E4F_Web3_mining_bot/app?startapp=E4F786112`;
        }
        return data;
      }
    } catch {}
    const isSpecialUser = userId === 'usr_8827675419' || getLocalUser()?.telegramId === 8827675419;
    const cachedRefCode = isSpecialUser ? 'E4F786112' : (getLocalUser()?.referralCode || '');
    return {
      success: true,
      referrals: [],
      totalReferrals: 0,
      activeMiners: 0,
      earnedUSDT: 0,
      boostTier: 'Tier 1 (0%)',
      boostPercent: 0,
      referralCode: cachedRefCode,
      referralLink: cachedRefCode
        ? `https://t.me/E4F_Web3_mining_bot/app?startapp=${cachedRefCode}`
        : 'https://t.me/E4F_Web3_mining_bot/app',
    };
  },

  // Market & Trade
  async getMarketAssets(): Promise<{ assets: MarketAsset[]; serverTime: number }> {
    try {
      const res = await fetch('/api/market/assets');
      const data = await parseResponseJson(res);
      if (res.ok && data && Array.isArray(data.assets)) return data;
    } catch (e) {
      console.warn('getMarketAssets network fallback:', e);
    }
    return {
      assets: [
        {
          symbol: 'E4F/USDT',
          baseAsset: 'E4F',
          quoteAsset: 'USDT',
          name: 'Earn 4 Future',
          isListed: false,
          price: null,
          priceChangePercent24h: null,
          high24h: null,
          low24h: null,
          volume24h: null,
          icon: '/e4f_coin.jpg',
        },
        {
          symbol: 'BTC/USDT',
          baseAsset: 'BTC',
          quoteAsset: 'USDT',
          name: 'Bitcoin',
          isListed: true,
          price: 68432.5,
          priceChangePercent24h: 2.45,
          high24h: 69210.45,
          low24h: 66102.3,
          volume24h: 34125.8,
          icon: 'https://cryptologos.cc/logos/bitcoin-btc-logo.svg?v=040',
        },
        {
          symbol: 'ETH/USDT',
          baseAsset: 'ETH',
          quoteAsset: 'USDT',
          name: 'Ethereum',
          isListed: true,
          price: 3485.2,
          priceChangePercent24h: 3.12,
          high24h: 3520.0,
          low24h: 3380.1,
          volume24h: 184520.4,
          icon: 'https://cryptologos.cc/logos/ethereum-eth-logo.svg?v=040',
        },
        {
          symbol: 'SOL/USDT',
          baseAsset: 'SOL',
          quoteAsset: 'USDT',
          name: 'Solana',
          isListed: true,
          price: 152.8,
          priceChangePercent24h: 4.85,
          high24h: 156.4,
          low24h: 145.2,
          volume24h: 895400.2,
          icon: 'https://cryptologos.cc/logos/solana-sol-logo.svg?v=040',
        },
        {
          symbol: 'BNB/USDT',
          baseAsset: 'BNB',
          quoteAsset: 'USDT',
          name: 'BNB Chain',
          isListed: true,
          price: 582.3,
          priceChangePercent24h: -0.42,
          high24h: 589.9,
          low24h: 578.1,
          volume24h: 42100.5,
          icon: 'https://cryptologos.cc/logos/bnb-bnb-logo.svg?v=040',
        },
        {
          symbol: 'XRP/USDT',
          baseAsset: 'XRP',
          quoteAsset: 'USDT',
          name: 'XRP',
          isListed: true,
          price: 0.584,
          priceChangePercent24h: 1.15,
          high24h: 0.598,
          low24h: 0.572,
          volume24h: 1254300.0,
          icon: 'https://cryptologos.cc/logos/xrp-xrp-logo.svg?v=040',
        },
      ],
      serverTime: Date.now(),
    };
  },

  async getKlines(pair: string, timeframe: string): Promise<{ pair: string; timeframe: string; klines: CandlestickData[] }> {
    try {
      const res = await fetch(`/api/market/klines?pair=${encodeURIComponent(pair)}&timeframe=${timeframe}`);
      const data = await parseResponseJson(res);
      if (res.ok && data && data.klines) return data;
    } catch {}
    let basePrice = 68432.5;
    if (pair.includes('ETH')) basePrice = 3485.2;
    else if (pair.includes('SOL')) basePrice = 152.8;
    else if (pair.includes('BNB')) basePrice = 582.3;
    else if (pair.includes('E4F')) basePrice = 3.5;
    const now = Date.now();
    const klines: CandlestickData[] = [];
    for (let i = 24; i >= 0; i--) {
      const time = now - i * 3600000;
      const change = (Math.random() - 0.48) * (basePrice * 0.01);
      const open = basePrice;
      const close = Number((basePrice + change).toFixed(2));
      const high = Number((Math.max(open, close) + Math.random() * (basePrice * 0.005)).toFixed(2));
      const low = Number((Math.min(open, close) - Math.random() * (basePrice * 0.005)).toFixed(2));
      const volume = Math.round(Math.random() * 5000 + 500);
      klines.push({ time, open, high, low, close, volume });
      basePrice = close;
    }
    return { pair, timeframe, klines };
  },

  async getOrderBook(pair: string): Promise<OrderBook> {
    try {
      const res = await fetch(`/api/market/orderbook?pair=${encodeURIComponent(pair)}`);
      const data = await parseResponseJson(res);
      if (res.ok && data && data.bids && data.asks) return data;
    } catch {}
    let basePrice = 68432.5;
    if (pair.includes('ETH')) basePrice = 3485.2;
    else if (pair.includes('SOL')) basePrice = 152.8;
    else if (pair.includes('BNB')) basePrice = 582.3;
    else if (pair.includes('E4F')) basePrice = 3.5;
    const bids: { price: number; amount: number; total: number }[] = [];
    const asks: { price: number; amount: number; total: number }[] = [];
    for (let i = 1; i <= 6; i++) {
      const bPrice = Number((basePrice - i * (basePrice * 0.001)).toFixed(2));
      const bAmount = Number((Math.random() * 1.5 + 0.2).toFixed(4));
      bids.push({ price: bPrice, amount: bAmount, total: Number((bPrice * bAmount).toFixed(2)) });
      const aPrice = Number((basePrice + i * (basePrice * 0.001)).toFixed(2));
      const aAmount = Number((Math.random() * 1.5 + 0.2).toFixed(4));
      asks.push({ price: aPrice, amount: aAmount, total: Number((aPrice * aAmount).toFixed(2)) });
    }
    return { bids, asks, lastPrice: basePrice, spread: Number((asks[0].price - bids[0].price).toFixed(2)) };
  },

  async placeOrder(userId: string, orderData: { pair: string; side: 'BUY' | 'SELL'; type: 'MARKET' | 'LIMIT'; price: number; amount: number }): Promise<{ success: boolean; order: SpotOrder; balances: WalletBalances }> {
    try {
      const res = await fetch('/api/trade/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...orderData }),
      });
      const data = await parseResponseJson(res);
      if (res.ok && data && data.success) {
        if (data.balances) saveLocalBalances(data.balances);
        if (data.order && typeof window !== 'undefined') {
          try {
            const key = `e4f_orders_${userId}`;
            const raw = localStorage.getItem(key);
            const existing = raw ? JSON.parse(raw) : [];
            existing.unshift(data.order);
            localStorage.setItem(key, JSON.stringify(existing.slice(0, 50)));
          } catch {}
        }
        return data;
      }
    } catch {}

    const totalUSDT = Number((orderData.price * orderData.amount).toFixed(2));
    const order: SpotOrder = {
      id: `ord_${Date.now()}`,
      userId,
      pair: orderData.pair,
      side: orderData.side,
      type: orderData.type,
      price: orderData.price,
      amount: orderData.amount,
      totalUSDT,
      filledAmount: orderData.amount,
      status: 'FILLED',
      timestamp: Date.now(),
    };

    const balances = getLocalBalances();
    const rawSymbol = (orderData.pair.split('/')[0] || '').toLowerCase();
    const baseKey = (rawSymbol === 'e4f' ? 'e4f' : rawSymbol) as keyof WalletBalances;

    if (orderData.side === 'BUY') {
      // User buys coin with USDT
      if ((balances.usdt || 0) < totalUSDT) {
        throw new Error(`Insufficient USDT balance. Available: ${(balances.usdt || 0).toFixed(2)} USDT, Required: ${totalUSDT.toFixed(2)} USDT`);
      }
      balances.usdt = Math.max(0, Number(((balances.usdt || 0) - totalUSDT).toFixed(4)));
      (balances as any)[baseKey] = Number((((balances as any)[baseKey] || 0) + orderData.amount).toFixed(6));
    } else {
      // User sells coin for USDT
      const currentCoinAmt = (balances as any)[baseKey] || 0;
      if (currentCoinAmt < orderData.amount) {
        throw new Error(`Insufficient ${orderData.pair.split('/')[0]} balance. Available: ${currentCoinAmt}`);
      }
      (balances as any)[baseKey] = Math.max(0, Number((currentCoinAmt - orderData.amount).toFixed(6)));
      balances.usdt = Number(((balances.usdt || 0) + totalUSDT).toFixed(4));
    }

    saveLocalBalances(balances);

    try {
      if (typeof window !== 'undefined') {
        const key = `e4f_orders_${userId}`;
        const raw = localStorage.getItem(key);
        const existing = raw ? JSON.parse(raw) : [];
        existing.unshift(order);
        localStorage.setItem(key, JSON.stringify(existing.slice(0, 50)));
      }
    } catch {}

    try {
      const tx: TransactionRecord = {
        id: `tx_${Date.now()}_trade`,
        userId,
        asset: orderData.side === 'BUY' ? 'USDT' : (orderData.pair.split('/')[0] as any),
        amount: orderData.side === 'BUY' ? totalUSDT : orderData.amount,
        direction: orderData.side === 'BUY' ? 'OUT' : 'IN',
        source: orderData.side === 'BUY' ? 'SPOT_TRADE_BUY' : 'SPOT_TRADE_SELL',
        status: 'COMPLETED',
        timestamp: Date.now(),
        referenceId: order.id,
        note: `${orderData.side} ${orderData.amount} ${orderData.pair} @ ${orderData.price.toFixed(2)}`,
      };
      saveLocalTransaction(userId, tx);
    } catch {}

    return { success: true, order, balances };
  },

  async getOrders(userId: string): Promise<{ orders: SpotOrder[] }> {
    let serverOrders: SpotOrder[] = [];
    try {
      const res = await fetch(`/api/trade/${userId}/orders`);
      const data = await parseResponseJson(res);
      if (res.ok && data && Array.isArray(data.orders)) {
        serverOrders = data.orders;
      }
    } catch {}

    let localOrders: SpotOrder[] = [];
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem(`e4f_orders_${userId}`);
        if (raw) localOrders = JSON.parse(raw);
      }
    } catch {}

    const seen = new Set<string>();
    const merged: SpotOrder[] = [];
    for (const o of [...serverOrders, ...localOrders]) {
      if (o && o.id && !seen.has(o.id)) {
        seen.add(o.id);
        merged.push(o);
      }
    }
    merged.sort((a, b) => b.timestamp - a.timestamp);
    return { orders: merged };
  },

  // Wallet Actions
  async deposit(userId: string, data: { asset: string; network: string; amount: number; txid: string; senderAddress?: string }): Promise<any> {
    const res = await fetch('/api/wallet/deposit', {
      method: 'POST',
      headers: this.getUserAuthHeaders(),
      body: JSON.stringify({ userId, ...data }),
    });
    const resData = await parseResponseJson(res);
    if (!res.ok || !resData || !resData.success) {
      throw new Error(resData?.error || 'Deposit verification failed');
    }
    if (resData.balances) saveLocalBalances(resData.balances);
    return resData;
  },

  async withdraw(userId: string, data: { asset: string; address: string; network: string; amount: number }): Promise<any> {
    const res = await fetch('/api/wallet/withdraw', {
      method: 'POST',
      headers: this.getUserAuthHeaders(),
      body: JSON.stringify({ userId, ...data }),
    });
    const resData = await parseResponseJson(res);
    if (!res.ok || !resData || !resData.success) {
      throw new Error(resData?.error || 'Withdrawal failed');
    }
    if (resData.balances) saveLocalBalances(resData.balances);
    try {
      if (typeof window !== 'undefined') {
        const key = `e4f_withdrawals_${userId}`;
        const raw = localStorage.getItem(key);
        const existing = raw ? JSON.parse(raw) : [];
        const item = resData.withdrawal || resData.transaction || {
          id: `wd_${Date.now()}`,
          user_id: userId,
          amount: data.amount,
          currency: data.asset,
          status: 'pending',
          wallet_address: data.address,
          created_at: new Date().toISOString(),
        };
        existing.unshift(item);
        localStorage.setItem(key, JSON.stringify(existing.slice(0, 50)));
      }
    } catch {}
    return resData;
  },

  async getWithdrawals(userId: string): Promise<WithdrawalRecord[]> {
    let serverWds: WithdrawalRecord[] = [];
    try {
      const res = await fetch(`/api/withdrawals/${userId}`);
      const data = await parseResponseJson(res);
      if (res.ok && data && Array.isArray(data.withdrawals)) {
        serverWds = data.withdrawals;
      }
    } catch (err) {
      console.warn('Failed to fetch user withdrawals:', err);
    }
    let localWds: WithdrawalRecord[] = [];
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(`e4f_withdrawals_${userId}`) : null;
      if (raw) localWds = JSON.parse(raw);
    } catch {}

    const ninetyDaysAgoMs = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const map = new Map<string, any>();
    for (const w of localWds) {
      if (w && w.id && new Date(w.created_at).getTime() >= ninetyDaysAgoMs) {
        map.set(w.id, w);
      }
    }
    for (const w of serverWds) {
      if (w && w.id && new Date(w.created_at).getTime() >= ninetyDaysAgoMs) {
        map.set(w.id, w);
      }
    }
    return Array.from(map.values()).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  // Announcements
  async getAnnouncements(): Promise<{ announcements: Announcement[] }> {
    try {
      const res = await fetch('/api/announcements');
      const data = await parseResponseJson(res);
      if (res.ok && data && Array.isArray(data.announcements) && data.announcements.length > 0) return data;
    } catch {}
    return { announcements: DEFAULT_ANNOUNCEMENTS };
  },

  // Support
  async getSupportTickets(userId: string): Promise<{ tickets: SupportTicket[] }> {
    try {
      const res = await fetch(`/api/support/${userId}/tickets`);
      const data = await parseResponseJson(res);
      if (res.ok && data && Array.isArray(data.tickets)) return data;
    } catch {}
    let tickets: SupportTicket[] = [];
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(`e4f_tickets_${userId}`) : null;
      if (raw) tickets = JSON.parse(raw);
    } catch {}
    return { tickets };
  },

  async createSupportTicket(userId: string, subject: string, message: string): Promise<any> {
    try {
      const res = await fetch('/api/support/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, subject, message }),
      });
      const data = await parseResponseJson(res);
      if (res.ok && data && data.success) return data;
    } catch {}
    const ticket: SupportTicket = {
      id: `tick_${Date.now()}`,
      userId,
      subject,
      message,
      status: 'OPEN',
      createdAt: Date.now(),
    };
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(`e4f_tickets_${userId}`) : null;
      const list = raw ? JSON.parse(raw) : [];
      list.unshift(ticket);
      localStorage.setItem(`e4f_tickets_${userId}`, JSON.stringify(list));
    } catch {}
    return { success: true, message: 'Support ticket submitted successfully', ticket };
  },

  // Admin
  async adminLogin(pin: string, key?: string): Promise<{ success: boolean; token: string; key?: string; role: string }> {
    const cleanPassword = (pin || key || '').trim();
    let tgId: any = undefined;
    try {
      tgId = (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id;
    } catch {}
    const payload = JSON.stringify({ password: cleanPassword, telegramId: tgId });
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (tgId) headers['x-telegram-id'] = String(tgId);
    let res = await fetch('/api/admin/login', {
      method: 'POST',
      headers,
      body: payload,
    });

    if (res.status === 404) {
      try {
        const alt = await fetch('/admin/login', {
          method: 'POST',
          headers,
          body: payload,
        });
        if (alt.ok) res = alt;
      } catch {}
    }

    let data: any = {};
    try {
      data = await res.json();
    } catch {
      data = { error: `Server response error (${res.status}). Please check Vercel deployment status.` };
    }
    if (!res.ok) throw new Error(data.error || 'Admin login failed');
    return data;
  },

  async getAdminDashboard(adminKey?: string): Promise<any> {
    return this.safeAdminFetch('/api/admin/dashboard', {
      headers: this.getAdminHeaders(adminKey),
    });
  },

  getAdminHeaders(adminKey?: string): Record<string, string> {
    const token = typeof window !== 'undefined' ? (localStorage.getItem('e4f_admin_token') || '') : '';
    const savedKey = typeof window !== 'undefined' ? localStorage.getItem('e4f_admin_key') : null;
    let tgId: any = undefined;
    try {
      tgId = (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id;
    } catch {}
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) headers['x-admin-token'] = token;
    if (tgId) headers['x-telegram-id'] = String(tgId);
    const effectiveKey = adminKey || savedKey;
    if (effectiveKey) headers['x-admin-key'] = effectiveKey;
    return headers;
  },

  async safeAdminFetch(url: string, options: RequestInit = {}): Promise<any> {
    let res: Response;
    try {
      res = await fetch(url, options);
    } catch (netErr: any) {
      throw new Error(`Network connection error: ${netErr.message || 'Server unreachable'}`);
    }

    if (res.status === 404 && url.startsWith('/api/')) {
      try {
        const altUrl = url.replace('/api/', '/');
        const altRes = await fetch(altUrl, options);
        if (altRes.ok) res = altRes;
      } catch {}
    }

    let data: any = {};
    const text = await res.text();
    try {
      data = JSON.parse(text);
    } catch {
      data = {
        success: res.ok,
        error: res.ok ? undefined : `Server response (${res.status}): ${text.substring(0, 100)}`,
      };
    }

    if (!res.ok) {
      throw new Error(data.error || `Server request failed with status ${res.status}`);
    }
    return data;
  },

  async updateAdminSettings(settings: any, adminKey?: string): Promise<any> {
    return this.safeAdminFetch('/api/admin/settings', {
      method: 'POST',
      headers: this.getAdminHeaders(adminKey),
      body: JSON.stringify(settings),
    });
  },

  async updateAdminAdConfig(config: { enabled: boolean; provider: string; adMiningDurationSeconds?: number; adsterraDirectLink?: string; monetagDirectLink?: string }, adminKey?: string): Promise<any> {
    return this.updateAdminSettings({
      rewardedAdRequired: config.enabled,
      adProvider: config.provider,
      ...(config.adMiningDurationSeconds ? { adMiningDurationSeconds: config.adMiningDurationSeconds } : {}),
      ...(config.adsterraDirectLink ? { adsterraDirectLink: config.adsterraDirectLink } : {}),
      ...(config.monetagDirectLink ? { monetagDirectLink: config.monetagDirectLink } : {}),
    }, adminKey);
  },

  // Announcements CRUD
  async getAdminAnnouncements(adminKey?: string): Promise<any> {
    return this.safeAdminFetch('/api/admin/announcements', {
      headers: this.getAdminHeaders(adminKey),
    });
  },

  async createAnnouncement(ann: { title: string; description: string; ctaText?: string; ctaUrl?: string; imageUrl?: string; priority?: string | number; type?: string; validUntil?: number }, adminKey?: string): Promise<any> {
    return this.safeAdminFetch('/api/admin/announcements', {
      method: 'POST',
      headers: this.getAdminHeaders(adminKey),
      body: JSON.stringify(ann),
    });
  },

  async updateAnnouncement(id: string, updates: any, adminKey?: string): Promise<any> {
    return this.safeAdminFetch(`/api/admin/announcements/${id}`, {
      method: 'PUT',
      headers: this.getAdminHeaders(adminKey),
      body: JSON.stringify(updates),
    });
  },

  async deleteAnnouncement(id: string, adminKey?: string): Promise<any> {
    return this.safeAdminFetch(`/api/admin/announcements/${id}`, {
      method: 'DELETE',
      headers: this.getAdminHeaders(adminKey),
    });
  },

  // Dynamic Tasks CRUD
  async getAdminTasks(adminKey?: string): Promise<any> {
    return this.safeAdminFetch('/api/admin/tasks', {
      headers: this.getAdminHeaders(adminKey),
    });
  },

  async createAdminTask(task: any, adminKey?: string): Promise<any> {
    return this.safeAdminFetch('/api/admin/tasks', {
      method: 'POST',
      headers: this.getAdminHeaders(adminKey),
      body: JSON.stringify(task),
    });
  },

  async updateAdminTask(id: string, updates: any, adminKey?: string): Promise<any> {
    return this.safeAdminFetch(`/api/admin/tasks/${id}`, {
      method: 'PUT',
      headers: this.getAdminHeaders(adminKey),
      body: JSON.stringify(updates),
    });
  },

  async deleteAdminTask(id: string, adminKey?: string): Promise<any> {
    return this.safeAdminFetch(`/api/admin/tasks/${id}`, {
      method: 'DELETE',
      headers: this.getAdminHeaders(adminKey),
    });
  },

  // Task Submissions Review
  async getAdminTaskSubmissions(adminKey?: string): Promise<any> {
    return this.safeAdminFetch('/api/admin/task-submissions', {
      headers: this.getAdminHeaders(adminKey),
    });
  },

  async reviewTaskSubmission(submissionId: string, decision: 'APPROVE' | 'REJECT', adminNote?: string, adminKey?: string): Promise<any> {
    return this.safeAdminFetch('/api/admin/task-submissions/review', {
      method: 'POST',
      headers: this.getAdminHeaders(adminKey),
      body: JSON.stringify({ submissionId, decision, adminNote }),
    });
  },

  // Users Management
  async getAdminUsers(adminKey?: string): Promise<any> {
    return this.safeAdminFetch('/api/admin/users', {
      headers: this.getAdminHeaders(adminKey),
    });
  },

  async updateAdminUserStatus(userId: string, status: string, adminKey?: string): Promise<any> {
    return this.safeAdminFetch(`/api/admin/users/${userId}/status`, {
      method: 'POST',
      headers: this.getAdminHeaders(adminKey),
      body: JSON.stringify({ status }),
    });
  },

  async deleteAdminUser(userId: string, adminKey?: string): Promise<any> {
    return this.safeAdminFetch(`/api/admin/users/${userId}`, {
      method: 'DELETE',
      headers: this.getAdminHeaders(adminKey),
    });
  },

  // Deposits Management (Manual Review, Verification & Approval)
  async getAdminDeposits(adminKey?: string): Promise<{ success: boolean; deposits: any[] }> {
    return this.safeAdminFetch('/api/admin/deposits', {
      headers: this.getAdminHeaders(adminKey),
    });
  },

  async reviewAdminDeposit(depositId: string, decision: 'APPROVE' | 'REJECT', note?: string, adminKey?: string): Promise<any> {
    return this.safeAdminFetch(`/api/admin/deposits/${depositId}/review`, {
      method: 'POST',
      headers: this.getAdminHeaders(adminKey),
      body: JSON.stringify({ decision, note }),
    });
  },

  // Withdrawals Management (Manual Review, Verification & Approval)
  async getAdminWithdrawals(adminKey?: string): Promise<{ withdrawals: any[] }> {
    return this.safeAdminFetch('/api/admin/withdrawals', {
      headers: this.getAdminHeaders(adminKey),
    });
  },

  async reviewAdminWithdrawal(withdrawalId: string, decision: 'APPROVE' | 'REJECT', note?: string, adminKey?: string): Promise<any> {
    return this.safeAdminFetch(`/api/admin/withdrawals/${withdrawalId}/review`, {
      method: 'POST',
      headers: this.getAdminHeaders(adminKey),
      body: JSON.stringify({ decision, note }),
    });
  },

  // Data Retention Cleanup
  async cleanupRetention(adminKey?: string): Promise<any> {
    return this.safeAdminFetch('/api/admin/cleanup-retention', {
      method: 'POST',
      headers: this.getAdminHeaders(adminKey),
      body: JSON.stringify({}),
    });
  },

  // Audit Logs
  async getAdminAuditLogs(adminKey?: string): Promise<any> {
    return this.safeAdminFetch('/api/admin/audit-logs', {
      headers: this.getAdminHeaders(adminKey),
    });
  },
};
