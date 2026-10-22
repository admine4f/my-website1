export type ScreenTab = 'home' | 'mining' | 'market' | 'trade' | 'wallet';

export type Language = 'en';

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

export interface UserAccount {
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
  isDemoUser?: boolean;
  isVerified?: boolean;
  depositBalance?: number;
  depositAddress?: string;
}

export interface WalletBalances {
  usdt: number;        // Spot available USDT
  e4f: number;         // E4F pre-listing balance
  btc: number;         // Bitcoin
  eth: number;         // Ethereum
  sol: number;         // Solana
  bnb: number;         // BNB
  depositBalance?: number; // Separate Deposit Balance
}

export type TransactionSource =
  | 'WELCOME_BONUS_USDT'
  | 'WELCOME_BONUS_E4F'
  | 'MINING_REWARD'
  | 'TASK_REWARD'
  | 'REFERRAL_REWARD'
  | 'SPIN_REWARD'
  | 'GIFT_BOX_REWARD'
  | 'DAILY_CHECKIN'
  | 'DEPOSIT'
  | 'WITHDRAWAL'
  | 'SPOT_TRADE_BUY'
  | 'SPOT_TRADE_SELL';

export type TransactionStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REJECTED' | 'CANCELLED';

export interface ReferralMiningBoostTier {
  minReferrals: number;
  boostPercent: number;
}

export interface TransactionRecord {
  id: string;
  userId: string;
  asset: 'USDT' | 'E4F' | 'BTC' | 'ETH' | 'SOL' | 'BNB';
  amount: number;
  direction: 'IN' | 'OUT';
  source: TransactionSource;
  status: TransactionStatus;
  timestamp: number;
  referenceId?: string;
  note?: string;
  address?: string;
  network?: string;
  userDepositTotal?: number;
}

export interface WithdrawalRecord {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'success' | 'rejected' | string;
  wallet_address?: string;
  created_at: string;
}

export interface MiningSession {
  id: string;
  userId: string;
  startTime: number;
  endTime: number;
  durationSeconds: number; // 28800 (8 hours)
  miningRatePerHour: number; // 0.25 E4F
  estimatedReward: number; // 2.00 E4F
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CLAIMED' | 'CANCELLED';
  adVerified: boolean;
  adSessionId?: string;
  claimedAt?: number;
}

export interface ActiveAdSessionInfo {
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
}

export interface MiningStats {
  todayMiningE4F: number;
  totalMiningE4F: number;
  totalSessionsCompleted: number;
  activeSession: MiningSession | null;
  activeAdSession?: ActiveAdSessionInfo | null;
  serverTime: number;
  seasonEndDate: number; // 2028-02-28
  seasonDaysRemaining: number;
  adRequired?: boolean;
  adProvider?: 'ADSTERRA' | 'MONETAG' | 'UNITY' | 'SIMULATOR';
  adDurationSeconds?: number;
  adsterraDirectLink?: string;
  monetagDirectLink?: string;
  monetagZoneId?: string;
  monetagTelegramSdkEnabled?: boolean;
  plannedTargetPriceRange?: string;
  referralCount?: number;
  miningBoostPercent?: number;
  boostedMiningRatePerHour?: number;
  miningRatePerHour?: number;
  miningPrimaryNetwork?: string;
  miningSecondaryNetwork?: string;
  miningWaterfallEnabled?: boolean;
  miningAdDurationSeconds?: number;
  spinAdDurationSeconds?: number;
  giftBoxAdDurationSeconds?: number;
}

export interface SpinWheelPrizeConfig {
  id: number;
  label: string;
  asset: 'E4F' | 'USDT';
  amount: number;
  color: string;
}

export interface GiftBoxConfig {
  id: number;
  boxNumber: number;
  name: string;
  rewardAsset: 'E4F' | 'USDT';
  rewardAmount: number;
  color: string;
}

export interface MarketAsset {
  symbol: string; // e.g. 'BTC/USDT' or 'E4F/USDT'
  baseAsset: string; // 'BTC', 'E4F'
  quoteAsset: string; // 'USDT'
  name: string;
  isListed: boolean;
  price: number | null; // null for E4F
  priceChangePercent24h: number | null;
  high24h: number | null;
  low24h: number | null;
  volume24h: number | null;
  icon: string;
}

export interface CandlestickData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OrderBookEntry {
  price: number;
  amount: number;
  total: number;
}

export interface OrderBook {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  lastPrice: number;
  spread: number;
}

export interface SpotOrder {
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
}

export interface SocialTask {
  id: string;
  title: string;
  description: string;
  platform: 'TELEGRAM' | 'TWITTER' | 'YOUTUBE' | 'WEBSITE' | 'COMMUNITY';
  url: string;
  rewardAsset: 'E4F' | 'USDT';
  rewardAmount: number;
  status: 'AVAILABLE' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  verificationMethod: 'AUTO' | 'MANUAL' | 'TIMER';
  durationSeconds?: number;
  submittedProof?: string;
  isCompleted?: boolean;
  category?: string;
  actionUrl?: string;
}

export interface TaskSubmissionRecord {
  id: string;
  userId: string;
  userUid?: string;
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

export type TaskItem = SocialTask;

export interface GiftBox {
  id: number;
  boxNumber: number;
  name: string;
  rewardAsset: 'E4F' | 'USDT';
  rewardAmount: number;
  color: string;
  isOpened: boolean;
  openedAt?: number;
}

export interface SpinRewardItem {
  id: number;
  label: string;
  asset: 'E4F' | 'USDT';
  amount: number;
  probability: number;
  color: string;
}

export interface DailyCheckInState {
  currentStreak: number;
  lastCheckInDate: string; // YYYY-MM-DD
  todayClaimed: boolean;
  rewards: Array<{ day: number; asset: 'E4F' | 'USDT'; amount: number }>;
  claimedDays?: number[];
  nextDayToClaim?: number;
}

export interface Announcement {
  id: string;
  title: string;
  description: string;
  ctaText?: string;
  ctaUrl?: string;
  imageUrl?: string;
  priority: number;
  isActive: boolean;
}

export interface SupportTicket {
  id: string;
  userId: string;
  subject: string;
  message: string;
  status: 'OPEN' | 'PENDING' | 'RESOLVED' | 'CLOSED';
  createdAt: number;
  adminReply?: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'MINING' | 'REWARD' | 'TASK' | 'REFERRAL' | 'WALLET' | 'SECURITY' | 'ANNOUNCEMENT';
  read: boolean;
  timestamp: number;
}

export interface ReferralStats {
  referralCode: string;
  referralLink: string;
  totalInvited: number;
  qualified: number; // passed 30 days active mining
  active: number;
  pending: number;
  totalEarnedUSDT: number;
  referralRewardAmount: number; // 5 USDT per qualified invite
}

export interface NetworkWithdrawSetting {
  enabled: boolean;
  minAmount: number;
  maxAmount: number;
  fee: number;
}

export interface AdminSystemSettings {
  miningRatePerHour: number;
  miningDurationHours: number;
  rewardedAdRequired: boolean;
  adProvider: 'ADSTERRA' | 'MONETAG' | 'SIMULATOR';
  adMiningDurationSeconds?: number;
  miningAdDurationSeconds?: number;
  spinAdDurationSeconds?: number;
  giftBoxAdDurationSeconds?: number;
  adsterraDirectLink?: string;
  monetagDirectLink?: string;
  monetagZoneId?: string;
  monetagTelegramSdkEnabled?: boolean;
  spinWheelPrizes?: SpinWheelPrizeConfig[];
  giftBoxesConfig?: GiftBoxConfig[];
  dailyCheckInRewards?: Array<{ day: number; asset: 'E4F' | 'USDT'; amount: number }>;
  depositsEnabled?: boolean;
  withdrawalsEnabled?: boolean;
  minWithdrawalLimit?: number;
  maxWithdrawalLimit?: number;
  withdrawalFee?: number;
  networkWithdrawSettings?: Record<string, NetworkWithdrawSetting>;
  depositMinUSDT?: number;
  depositFirstBonusUSDT?: number;
  bscDepositAddress?: string;
  rewardSpinMaxDaily?: number;
  rewardSpinAdRequired?: boolean;
  giftBoxMaxDaily?: number;
  giftBoxAdRequired?: boolean;
  welcomeBonusUSDT: number;
  welcomeBonusE4F: number;
  referralBonusUSDT: number;
  referralMiningBoostTiers?: ReferralMiningBoostTier[];
  e4fListingStatus: 'PENDING_LISTING' | 'LISTED';
  e4fPlannedListingDate: string; // '2028-02-28'
  e4fPlannedTargetPriceRange: string; // '3–5 USDT'
}

export interface AuditLogEntry {
  id: string;
  adminId: string;
  action: string;
  target: string;
  details: string;
  timestamp: number;
}
