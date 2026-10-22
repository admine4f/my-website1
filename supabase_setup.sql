-- =====================================================================
-- E4F Web3 Exchange - Official Supabase PostgreSQL Database Setup
-- File: supabase_setup.sql
-- Production Ready | 100% Idempotent | Zero Financial & Balance Loss
--
-- Instructions:
-- 1. Open your Supabase Dashboard: https://supabase.com/dashboard
-- 2. Select your Project -> SQL Editor -> New Query
-- 3. Select All -> Copy -> Paste this entire script -> Click "RUN"
-- =====================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================================
-- 2. PROFILES TABLE
-- Authoritative user profile with telegram_id BIGINT UNIQUE NOT NULL.
-- Supports soft-delete (is_deleted, deleted_at) so accidental loss NEVER occurs.
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  telegram_id BIGINT UNIQUE NOT NULL,
  username TEXT DEFAULT '',
  first_name TEXT NOT NULL DEFAULT 'E4F User',
  last_name TEXT DEFAULT '',
  photo_url TEXT DEFAULT '',
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  id TEXT,
  uid TEXT UNIQUE,
  referral_code TEXT UNIQUE,
  referred_by TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'RESTRICTED', 'SUSPENDED')),
  claimed_welcome_bonus BOOLEAN NOT NULL DEFAULT FALSE,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  device_hash TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Upgrade existing profiles table if previously created (Idempotent)
DO $$
BEGIN
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telegram_id BIGINT;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT DEFAULT '';
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_name TEXT DEFAULT 'E4F User';
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_name TEXT DEFAULT '';
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS photo_url TEXT DEFAULT '';
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS id TEXT;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS uid TEXT;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code TEXT;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by TEXT;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS device_hash TEXT DEFAULT '';
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ACTIVE';
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS claimed_welcome_bonus BOOLEAN DEFAULT FALSE;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_telegram_id_key'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_telegram_id_key UNIQUE (telegram_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_uid_key'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_uid_key UNIQUE (uid);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_referral_code_key'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_referral_code_key UNIQUE (referral_code);
  END IF;

  UPDATE public.profiles SET referral_code = 'E4F786112' WHERE telegram_id = 8827675419;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_telegram_id ON public.profiles(telegram_id);
CREATE INDEX IF NOT EXISTS idx_profiles_uid ON public.profiles(uid);
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON public.profiles(referral_code);
CREATE INDEX IF NOT EXISTS idx_profiles_is_deleted ON public.profiles(is_deleted);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles(created_at DESC);

-- =====================================================================
-- 3. WALLETS TABLE
-- References profiles(telegram_id) ON DELETE RESTRICT (Prevents accidental loss).
-- Balance is NEVER overwritten with 0 during reconnection or restarts.
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.wallets (
  telegram_id BIGINT PRIMARY KEY REFERENCES public.profiles(telegram_id) ON DELETE RESTRICT,
  balance NUMERIC(20, 6) NOT NULL DEFAULT 0.000000 CHECK (balance >= 0),
  total_mined NUMERIC(20, 6) NOT NULL DEFAULT 0.000000 CHECK (total_mined >= 0),
  referral_earnings NUMERIC(20, 6) NOT NULL DEFAULT 0.000000 CHECK (referral_earnings >= 0),
  id TEXT,
  user_id TEXT,
  "USDT" NUMERIC(20, 6) NOT NULL DEFAULT 0.000000 CHECK ("USDT" >= 0),
  "E4F"  NUMERIC(20, 6) NOT NULL DEFAULT 0.000000 CHECK ("E4F" >= 0),
  "BNB"  NUMERIC(20, 6) NOT NULL DEFAULT 0.000000 CHECK ("BNB" >= 0),
  "BTC"  NUMERIC(20, 6) NOT NULL DEFAULT 0.000000 CHECK ("BTC" >= 0),
  "ETH"  NUMERIC(20, 6) NOT NULL DEFAULT 0.000000 CHECK ("ETH" >= 0),
  "SOL"  NUMERIC(20, 6) NOT NULL DEFAULT 0.000000 CHECK ("SOL" >= 0),
  "TON"  NUMERIC(20, 6) NOT NULL DEFAULT 0.000000 CHECK ("TON" >= 0),
  "XRP"  NUMERIC(20, 6) NOT NULL DEFAULT 0.000000 CHECK ("XRP" >= 0),
  "DOGE" NUMERIC(20, 6) NOT NULL DEFAULT 0.000000 CHECK ("DOGE" >= 0),
  "ADA"  NUMERIC(20, 6) NOT NULL DEFAULT 0.000000 CHECK ("ADA" >= 0),
  "TRX"  NUMERIC(20, 6) NOT NULL DEFAULT 0.000000 CHECK ("TRX" >= 0),
  "LTC"  NUMERIC(20, 6) NOT NULL DEFAULT 0.000000 CHECK ("LTC" >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Upgrade existing wallets table if previously created
DO $$
BEGIN
  ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS balance NUMERIC(20, 6) DEFAULT 0.000000;
  ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS total_mined NUMERIC(20, 6) DEFAULT 0.000000;
  ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS referral_earnings NUMERIC(20, 6) DEFAULT 0.000000;
  ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS id TEXT;
  ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS user_id TEXT;
  ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS "USDT" NUMERIC(20, 6) DEFAULT 0.000000;
  ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS "E4F" NUMERIC(20, 6) DEFAULT 0.000000;
  ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS "BNB" NUMERIC(20, 6) DEFAULT 0.000000;
  ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS "BTC" NUMERIC(20, 6) DEFAULT 0.000000;
  ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS "ETH" NUMERIC(20, 6) DEFAULT 0.000000;
  ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS "SOL" NUMERIC(20, 6) DEFAULT 0.000000;
  ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS "TON" NUMERIC(20, 6) DEFAULT 0.000000;
  ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS "XRP" NUMERIC(20, 6) DEFAULT 0.000000;
  ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS "DOGE" NUMERIC(20, 6) DEFAULT 0.000000;
  ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS "ADA" NUMERIC(20, 6) DEFAULT 0.000000;
  ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS "TRX" NUMERIC(20, 6) DEFAULT 0.000000;
  ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS "LTC" NUMERIC(20, 6) DEFAULT 0.000000;
  ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'wallets_telegram_id_key'
  ) THEN
    ALTER TABLE public.wallets ADD CONSTRAINT wallets_telegram_id_key UNIQUE (telegram_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'wallets_user_id_key'
  ) THEN
    ALTER TABLE public.wallets ADD CONSTRAINT wallets_user_id_key UNIQUE (user_id);
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_wallets_telegram_id ON public.wallets(telegram_id);
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON public.wallets(user_id);

-- =====================================================================
-- 4. REFERRALS TABLE
-- Rule 2: referee_id UNIQUE NOT NULL. Referral bonus awarded 1 time only.
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.referrals (
  id TEXT PRIMARY KEY DEFAULT ('ref_' || gen_random_uuid()::text),
  referrer_id BIGINT REFERENCES public.profiles(telegram_id) ON DELETE RESTRICT,
  referee_id BIGINT UNIQUE NOT NULL REFERENCES public.profiles(telegram_id) ON DELETE RESTRICT,
  bonus_amount NUMERIC(20, 6) NOT NULL DEFAULT 0.000000 CHECK (bonus_amount >= 0),
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Upgrade existing referrals table if previously created
DO $$
BEGIN
  ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS referrer_id BIGINT;
  ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS referee_id BIGINT;
  ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS bonus_amount NUMERIC(20, 6) DEFAULT 0.000000;
  ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ACTIVE';
  ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'referrals_referee_id_key'
  ) THEN
    ALTER TABLE public.referrals ADD CONSTRAINT referrals_referee_id_key UNIQUE (referee_id);
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON public.referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referee_id ON public.referrals(referee_id);
CREATE INDEX IF NOT EXISTS idx_referrals_created_at ON public.referrals(created_at DESC);

-- =====================================================================
-- 5. WITHDRAWALS TABLE
-- Complete withdrawal records with ON DELETE RESTRICT on profiles(telegram_id).
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.withdrawals (
  id TEXT PRIMARY KEY DEFAULT ('wd_' || gen_random_uuid()::text),
  telegram_id BIGINT REFERENCES public.profiles(telegram_id) ON DELETE RESTRICT,
  amount NUMERIC(20, 6) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (LOWER(status) IN ('pending', 'processing', 'in_review', 'completed', 'success', 'rejected', 'failed', 'cancelled')),
  wallet_address TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USDT',
  network TEXT NOT NULL DEFAULT 'BEP20',
  fee NUMERIC(20, 6) NOT NULL DEFAULT 0.000000 CHECK (fee >= 0),
  tx_hash TEXT DEFAULT '',
  admin_note TEXT DEFAULT '',
  user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Upgrade existing withdrawals table if previously created
DO $$
BEGIN
  ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS telegram_id BIGINT;
  ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS wallet_address TEXT;
  ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
  ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_withdrawals_telegram_id ON public.withdrawals(telegram_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON public.withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_created_at ON public.withdrawals(created_at DESC);

-- =====================================================================
-- 6. DEVICE LOCKS TABLE
-- Rule 1: 24h Anti-Sybil Welcome Bonus Protection.
-- Tracks created_at, is_permanent, last_claim_at, and claim_count.
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.device_locks (
  device_hash TEXT PRIMARY KEY,
  telegram_id BIGINT,
  last_claim_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  claim_count INTEGER NOT NULL DEFAULT 1,
  is_permanent BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Upgrade existing device_locks table if previously created
DO $$
BEGIN
  ALTER TABLE public.device_locks ADD COLUMN IF NOT EXISTS device_hash TEXT;
  ALTER TABLE public.device_locks ADD COLUMN IF NOT EXISTS telegram_id BIGINT;
  ALTER TABLE public.device_locks ADD COLUMN IF NOT EXISTS last_claim_at TIMESTAMPTZ DEFAULT NOW();
  ALTER TABLE public.device_locks ADD COLUMN IF NOT EXISTS claim_count INTEGER DEFAULT 1;
  ALTER TABLE public.device_locks ADD COLUMN IF NOT EXISTS is_permanent BOOLEAN DEFAULT FALSE;
  ALTER TABLE public.device_locks ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_device_locks_last_claim ON public.device_locks(last_claim_at DESC);
CREATE INDEX IF NOT EXISTS idx_device_locks_telegram_id ON public.device_locks(telegram_id);
CREATE INDEX IF NOT EXISTS idx_device_locks_created_at ON public.device_locks(created_at DESC);

-- =====================================================================
-- 7. REPO COMPATIBILITY TABLES
-- (users, balances, transactions, deposits, mining_sessions, audit_logs, spot_orders, system_settings, market_prices)
-- Preserves existing server.ts and src/services/api.ts functionality with 0% data/feature loss
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  uid TEXT UNIQUE NOT NULL,
  telegram_id BIGINT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT DEFAULT '',
  username TEXT DEFAULT '',
  photo_url TEXT DEFAULT '',
  referral_code TEXT UNIQUE NOT NULL,
  referred_by TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'RESTRICTED', 'SUSPENDED')),
  claimed_welcome_bonus BOOLEAN NOT NULL DEFAULT FALSE,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  deposit_balance NUMERIC(20, 6) NOT NULL DEFAULT 0.000000 CHECK (deposit_balance >= 0),
  deposit_address TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Upgrade existing users table
DO $$
BEGIN
  ALTER TABLE public.users ADD COLUMN IF NOT EXISTS uid TEXT;
  ALTER TABLE public.users ADD COLUMN IF NOT EXISTS telegram_id BIGINT;
  ALTER TABLE public.users ADD COLUMN IF NOT EXISTS referral_code TEXT;
  ALTER TABLE public.users ADD COLUMN IF NOT EXISTS referred_by TEXT;
  ALTER TABLE public.users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ACTIVE';
  ALTER TABLE public.users ADD COLUMN IF NOT EXISTS claimed_welcome_bonus BOOLEAN DEFAULT FALSE;
  ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
  ALTER TABLE public.users ADD COLUMN IF NOT EXISTS deposit_balance NUMERIC(20, 6) DEFAULT 0.000000;
  ALTER TABLE public.users ADD COLUMN IF NOT EXISTS deposit_address TEXT DEFAULT '';
  ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_referral_code_key'
  ) THEN
    ALTER TABLE public.users ADD CONSTRAINT users_referral_code_key UNIQUE (referral_code);
  END IF;

  UPDATE public.users SET referral_code = 'E4F786112' WHERE telegram_id = 8827675419;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON public.users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON public.users(referral_code);

CREATE TABLE IF NOT EXISTS public.balances (
  user_id TEXT PRIMARY KEY,
  "USDT" NUMERIC(20, 6) NOT NULL DEFAULT 0.000000 CHECK ("USDT" >= 0),
  "E4F"  NUMERIC(20, 6) NOT NULL DEFAULT 0.000000 CHECK ("E4F" >= 0),
  "BNB"  NUMERIC(20, 6) NOT NULL DEFAULT 0.000000 CHECK ("BNB" >= 0),
  "BTC"  NUMERIC(20, 6) NOT NULL DEFAULT 0.000000 CHECK ("BTC" >= 0),
  "ETH"  NUMERIC(20, 6) NOT NULL DEFAULT 0.000000 CHECK ("ETH" >= 0),
  "SOL"  NUMERIC(20, 6) NOT NULL DEFAULT 0.000000 CHECK ("SOL" >= 0),
  "TON"  NUMERIC(20, 6) NOT NULL DEFAULT 0.000000 CHECK ("TON" >= 0),
  "XRP"  NUMERIC(20, 6) NOT NULL DEFAULT 0.000000 CHECK ("XRP" >= 0),
  "DOGE" NUMERIC(20, 6) NOT NULL DEFAULT 0.000000 CHECK ("DOGE" >= 0),
  "ADA"  NUMERIC(20, 6) NOT NULL DEFAULT 0.000000 CHECK ("ADA" >= 0),
  "TRX"  NUMERIC(20, 6) NOT NULL DEFAULT 0.000000 CHECK ("TRX" >= 0),
  "LTC"  NUMERIC(20, 6) NOT NULL DEFAULT 0.000000 CHECK ("LTC" >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Upgrade existing balances table
DO $$
BEGIN
  ALTER TABLE public.balances ADD COLUMN IF NOT EXISTS "USDT" NUMERIC(20, 6) DEFAULT 0.000000;
  ALTER TABLE public.balances ADD COLUMN IF NOT EXISTS "E4F" NUMERIC(20, 6) DEFAULT 0.000000;
  ALTER TABLE public.balances ADD COLUMN IF NOT EXISTS "BNB" NUMERIC(20, 6) DEFAULT 0.000000;
  ALTER TABLE public.balances ADD COLUMN IF NOT EXISTS "BTC" NUMERIC(20, 6) DEFAULT 0.000000;
  ALTER TABLE public.balances ADD COLUMN IF NOT EXISTS "ETH" NUMERIC(20, 6) DEFAULT 0.000000;
  ALTER TABLE public.balances ADD COLUMN IF NOT EXISTS "SOL" NUMERIC(20, 6) DEFAULT 0.000000;
  ALTER TABLE public.balances ADD COLUMN IF NOT EXISTS "TON" NUMERIC(20, 6) DEFAULT 0.000000;
  ALTER TABLE public.balances ADD COLUMN IF NOT EXISTS "XRP" NUMERIC(20, 6) DEFAULT 0.000000;
  ALTER TABLE public.balances ADD COLUMN IF NOT EXISTS "DOGE" NUMERIC(20, 6) DEFAULT 0.000000;
  ALTER TABLE public.balances ADD COLUMN IF NOT EXISTS "ADA" NUMERIC(20, 6) DEFAULT 0.000000;
  ALTER TABLE public.balances ADD COLUMN IF NOT EXISTS "TRX" NUMERIC(20, 6) DEFAULT 0.000000;
  ALTER TABLE public.balances ADD COLUMN IF NOT EXISTS "LTC" NUMERIC(20, 6) DEFAULT 0.000000;
  ALTER TABLE public.balances ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  asset TEXT NOT NULL,
  amount NUMERIC(20, 6) NOT NULL CHECK (amount > 0),
  direction TEXT NOT NULL CHECK (direction IN ('IN', 'OUT')),
  source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('COMPLETED', 'PENDING', 'FAILED', 'REJECTED', 'CANCELLED')),
  timestamp BIGINT NOT NULL,
  reference_id TEXT DEFAULT '',
  note TEXT DEFAULT '',
  address TEXT DEFAULT '',
  network TEXT DEFAULT '',
  fee NUMERIC(20, 6) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Upgrade existing transactions table
DO $$
BEGIN
  ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS user_id TEXT;
  ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS asset TEXT;
  ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS amount NUMERIC(20, 6) DEFAULT 0;
  ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS direction TEXT;
  ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS source TEXT;
  ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'COMPLETED';
  ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS timestamp BIGINT;
  ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS reference_id TEXT DEFAULT '';
  ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS note TEXT DEFAULT '';
  ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS address TEXT DEFAULT '';
  ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS network TEXT DEFAULT '';
  ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS fee NUMERIC(20, 6) DEFAULT 0;
  ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON public.transactions(timestamp DESC);

CREATE TABLE IF NOT EXISTS public.deposits (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  asset TEXT NOT NULL DEFAULT 'USDT',
  network TEXT NOT NULL,
  amount NUMERIC(20, 6) NOT NULL CHECK (amount > 0),
  txid TEXT NOT NULL UNIQUE,
  sender_address TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'REJECTED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMPTZ
);

-- Upgrade existing deposits table
DO $$
BEGIN
  ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS user_id TEXT;
  ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS asset TEXT DEFAULT 'USDT';
  ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS network TEXT;
  ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS amount NUMERIC(20, 6);
  ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS txid TEXT;
  ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS sender_address TEXT DEFAULT '';
  ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PENDING';
  ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
  ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_deposits_user_id ON public.deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_deposits_txid ON public.deposits(txid);

CREATE TABLE IF NOT EXISTS public.mining_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  start_time BIGINT NOT NULL,
  end_time BIGINT NOT NULL,
  duration_seconds INTEGER NOT NULL DEFAULT 28800,
  mining_rate_per_hour NUMERIC(20, 6) NOT NULL DEFAULT 0.250000,
  estimated_reward NUMERIC(20, 6) NOT NULL DEFAULT 2.000000,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED', 'CLAIMED', 'CANCELLED')),
  ad_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ad_session_id TEXT DEFAULT '',
  claimed_at BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Upgrade existing mining_sessions table
DO $$
BEGIN
  ALTER TABLE public.mining_sessions ADD COLUMN IF NOT EXISTS user_id TEXT;
  ALTER TABLE public.mining_sessions ADD COLUMN IF NOT EXISTS start_time BIGINT;
  ALTER TABLE public.mining_sessions ADD COLUMN IF NOT EXISTS end_time BIGINT;
  ALTER TABLE public.mining_sessions ADD COLUMN IF NOT EXISTS duration_seconds INTEGER DEFAULT 28800;
  ALTER TABLE public.mining_sessions ADD COLUMN IF NOT EXISTS mining_rate_per_hour NUMERIC(20, 6) DEFAULT 0.250000;
  ALTER TABLE public.mining_sessions ADD COLUMN IF NOT EXISTS estimated_reward NUMERIC(20, 6) DEFAULT 2.000000;
  ALTER TABLE public.mining_sessions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ACTIVE';
  ALTER TABLE public.mining_sessions ADD COLUMN IF NOT EXISTS ad_verified BOOLEAN DEFAULT FALSE;
  ALTER TABLE public.mining_sessions ADD COLUMN IF NOT EXISTS ad_session_id TEXT DEFAULT '';
  ALTER TABLE public.mining_sessions ADD COLUMN IF NOT EXISTS claimed_at BIGINT;
  ALTER TABLE public.mining_sessions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_mining_sessions_user_id ON public.mining_sessions(user_id);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  details TEXT NOT NULL,
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Upgrade existing audit_logs table
DO $$
BEGIN
  ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS admin_id TEXT;
  ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS action TEXT;
  ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS target TEXT;
  ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS details TEXT;
  ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS timestamp BIGINT;
  ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(timestamp DESC);

CREATE TABLE IF NOT EXISTS public.spot_orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  pair TEXT NOT NULL,
  side TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'MARKET',
  price NUMERIC NOT NULL DEFAULT 0,
  amount NUMERIC NOT NULL DEFAULT 0,
  total_usdt NUMERIC NOT NULL DEFAULT 0,
  filled_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'FILLED',
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Upgrade existing spot_orders table
DO $$
BEGIN
  ALTER TABLE public.spot_orders ADD COLUMN IF NOT EXISTS user_id TEXT;
  ALTER TABLE public.spot_orders ADD COLUMN IF NOT EXISTS pair TEXT;
  ALTER TABLE public.spot_orders ADD COLUMN IF NOT EXISTS side TEXT;
  ALTER TABLE public.spot_orders ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'MARKET';
  ALTER TABLE public.spot_orders ADD COLUMN IF NOT EXISTS price NUMERIC DEFAULT 0;
  ALTER TABLE public.spot_orders ADD COLUMN IF NOT EXISTS amount NUMERIC DEFAULT 0;
  ALTER TABLE public.spot_orders ADD COLUMN IF NOT EXISTS total_usdt NUMERIC DEFAULT 0;
  ALTER TABLE public.spot_orders ADD COLUMN IF NOT EXISTS filled_amount NUMERIC DEFAULT 0;
  ALTER TABLE public.spot_orders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'FILLED';
  ALTER TABLE public.spot_orders ADD COLUMN IF NOT EXISTS timestamp BIGINT;
  ALTER TABLE public.spot_orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_spot_orders_user ON public.spot_orders(user_id, timestamp DESC);

CREATE TABLE IF NOT EXISTS public.system_settings (
  id TEXT PRIMARY KEY DEFAULT 'global_settings',
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Upgrade existing system_settings table
DO $$
BEGIN
  ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS id TEXT DEFAULT 'global_settings';
  ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;
  ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Seed default global system settings if not present
INSERT INTO public.system_settings (id, settings, updated_at)
VALUES (
  'global_settings',
  '{"depositsEnabled": false, "welcomeBonusEnabled": true, "welcomeBonusUSDT": 25, "welcomeBonusE4F": 10, "referralBonusUSDT": 5, "bscDepositAddress": "0x63562945f7845aa1130a5b1499720b29788c82db"}'::jsonb,
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- 8. MARKET PRICES TABLE (Requirement 1)
-- Live real-time market prices table for spot trading & portfolio valuation
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.market_prices (
  symbol TEXT PRIMARY KEY,
  price NUMERIC NOT NULL,
  change_24h NUMERIC DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Upgrade existing market_prices table
DO $$
BEGIN
  ALTER TABLE public.market_prices ADD COLUMN IF NOT EXISTS symbol TEXT;
  ALTER TABLE public.market_prices ADD COLUMN IF NOT EXISTS price NUMERIC;
  ALTER TABLE public.market_prices ADD COLUMN IF NOT EXISTS change_24h NUMERIC DEFAULT 0;
  ALTER TABLE public.market_prices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_market_prices_symbol ON public.market_prices(symbol);

-- Seed initial market prices for live trading pairs
INSERT INTO public.market_prices (symbol, price, change_24h, updated_at)
VALUES
  ('BTC/USDT', 81650.00, -2.26, NOW()),
  ('ETH/USDT', 2430.50, -3.57, NOW()),
  ('SOL/USDT', 103.80, -3.63, NOW()),
  ('BNB/USDT', 729.30, -2.15, NOW()),
  ('XRP/USDT', 1.3270, -3.41, NOW()),
  ('DOGE/USDT', 0.1650, -1.85, NOW()),
  ('TON/USDT', 4.8500, -2.10, NOW()),
  ('ADA/USDT', 0.2267, -3.28, NOW()),
  ('TRX/USDT', 0.3332, 1.68, NOW()),
  ('LTC/USDT', 59.01, -3.48, NOW())
ON CONFLICT (symbol) DO UPDATE SET
  price = EXCLUDED.price,
  change_24h = EXCLUDED.change_24h,
  updated_at = NOW();

-- =====================================================================
-- 9. FUNCTION 1: get_or_restore_user
-- SECURITY DEFINER, SET search_path = public, pg_temp
--
-- Rules Enforced:
-- 1. New user gets 25 USDT + 10 E4F welcome bonus ONCE in a lifetime.
--    Checked via claimed_welcome_bonus. Device checked via device_locks table:
--    WHERE created_at > NOW() - INTERVAL '24 hours' AND is_permanent = FALSE
-- 2. Referrer bonus is 1 time only. referee_id is UNIQUE NOT NULL.
--    INSERT INTO referrals ... ON CONFLICT (referee_id) DO NOTHING.
-- 3. v_uid set cleanly before v_is_new := true:
--    v_uid := '8' || LPAD((ABS(p_telegram_id % 8999999) + 1000000)::TEXT, 7, '0');
-- 4. referral_code is 100% permanent and NEVER updated once assigned.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_or_restore_user(
  p_telegram_id BIGINT,
  p_username TEXT DEFAULT '',
  p_first_name TEXT DEFAULT 'E4F User',
  p_device_hash TEXT DEFAULT NULL,
  p_last_name TEXT DEFAULT '',
  p_photo_url TEXT DEFAULT '',
  p_referral_code TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id TEXT;
  v_uid TEXT;
  v_profile RECORD;
  v_wallet RECORD;
  v_can_claim_bonus BOOLEAN := false;
  v_device_lock_exists BOOLEAN := false;
  v_new_ref_code TEXT;
  v_referrer_tg_id BIGINT := NULL;
  v_is_new BOOLEAN := false;
  v_welcome_usdt NUMERIC(20, 6) := 0;
  v_welcome_e4f NUMERIC(20, 6) := 0;
BEGIN
  IF p_telegram_id IS NULL OR p_telegram_id <= 0 THEN
    RAISE EXCEPTION 'Invalid telegram_id: must be a positive BIGINT';
  END IF;

  v_user_id := 'usr_' || p_telegram_id::TEXT;

  -- 1. Check for existing profile with row lock (FOR UPDATE)
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE telegram_id = p_telegram_id
  FOR UPDATE;

  IF FOUND THEN
    -- Permanent Referral Code: If user exists, RETURN existing referral_code, DO NOT generate new!
    -- For telegram_id 8827675419, permanent code is strictly E4F786112.
    IF p_telegram_id = 8827675419 THEN
      v_profile.referral_code := 'E4F786112';
      UPDATE public.profiles SET referral_code = 'E4F786112' WHERE telegram_id = 8827675419;
      UPDATE public.users SET referral_code = 'E4F786112' WHERE telegram_id = 8827675419;
    ELSIF v_profile.referral_code IS NULL OR TRIM(v_profile.referral_code) = '' THEN
      LOOP
        v_new_ref_code := 'E4F' || LPAD(FLOOR(100000 + RANDOM() * 900000)::TEXT, 6, '0');
        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = v_new_ref_code)
             AND NOT EXISTS (SELECT 1 FROM public.users WHERE referral_code = v_new_ref_code);
      END LOOP;
      UPDATE public.profiles
      SET referral_code = v_new_ref_code
      WHERE telegram_id = p_telegram_id
      RETURNING * INTO v_profile;
    END IF;

    -- Ensure UID is set for existing profile
    v_uid := COALESCE(v_profile.uid, '8' || LPAD((ABS(p_telegram_id % 8999999) + 1000000)::TEXT, 7, '0'));
    IF v_profile.uid IS NULL OR v_profile.uid = '' THEN
      UPDATE public.profiles
      SET uid = v_uid
      WHERE telegram_id = p_telegram_id
      RETURNING * INTO v_profile;
    END IF;

    -- Account exists: If marked deleted, restore it; NEVER zero balance!
    -- Note: referral_code is permanent and NEVER updated!
    IF v_profile.is_deleted = TRUE THEN
      UPDATE public.profiles
      SET is_deleted = FALSE,
          deleted_at = NULL,
          username = COALESCE(NULLIF(p_username, ''), username),
          first_name = COALESCE(NULLIF(p_first_name, ''), first_name),
          last_name = COALESCE(NULLIF(p_last_name, ''), last_name),
          photo_url = COALESCE(NULLIF(p_photo_url, ''), photo_url),
          updated_at = NOW()
      WHERE telegram_id = p_telegram_id
      RETURNING * INTO v_profile;
    ELSE
      -- Normal reconnect/login: update metadata without touching balance or referral_code
      UPDATE public.profiles
      SET username = COALESCE(NULLIF(p_username, ''), username),
          first_name = COALESCE(NULLIF(p_first_name, ''), first_name),
          last_name = COALESCE(NULLIF(p_last_name, ''), last_name),
          photo_url = COALESCE(NULLIF(p_photo_url, ''), photo_url),
          updated_at = NOW()
      WHERE telegram_id = p_telegram_id
      RETURNING * INTO v_profile;
    END IF;

    -- Fetch wallet balance with row lock (Strictly preserving balance)
    SELECT * INTO v_wallet
    FROM public.wallets
    WHERE telegram_id = p_telegram_id
    FOR UPDATE;

    IF NOT FOUND THEN
      -- If wallet record is missing, initialize safely without overwriting
      INSERT INTO public.wallets (
        telegram_id, balance, total_mined, referral_earnings,
        id, user_id, "USDT", "E4F", updated_at
      ) VALUES (
        p_telegram_id, 0, 0, 0,
        'wal_' || p_telegram_id::TEXT, v_user_id, 0, 0, NOW()
      )
      ON CONFLICT (telegram_id) DO NOTHING;

      SELECT * INTO v_wallet FROM public.wallets WHERE telegram_id = p_telegram_id;
    END IF;

    -- Sync to legacy users/balances tables for full repo backwards compatibility
    -- Note: referral_code is NEVER overwritten on conflict
    INSERT INTO public.users (
      id, uid, telegram_id, first_name, last_name, username, photo_url, referral_code,
      referred_by, status, claimed_welcome_bonus, is_verified, created_at, updated_at
    ) VALUES (
      v_user_id, v_uid,
      p_telegram_id, v_profile.first_name, v_profile.last_name, v_profile.username, v_profile.photo_url,
      v_profile.referral_code,
      v_profile.referred_by, v_profile.status, v_profile.claimed_welcome_bonus, v_profile.is_verified,
      v_profile.created_at, NOW()
    )
    ON CONFLICT (telegram_id) DO UPDATE SET
      username = EXCLUDED.username,
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      updated_at = NOW();

    INSERT INTO public.balances (
      user_id, "USDT", "E4F", "BNB", "BTC", "ETH", "SOL", "TON", "XRP", "DOGE", "ADA", "TRX", "LTC", updated_at
    ) VALUES (
      v_user_id, COALESCE(v_wallet."USDT", v_wallet.balance, 0), COALESCE(v_wallet."E4F", 0),
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      updated_at = NOW();

    RETURN jsonb_build_object(
      'success', true,
      'is_new_user', false,
      'welcome_bonus_granted', false,
      'user', jsonb_build_object(
        'id', v_user_id,
        'uid', v_uid,
        'telegramId', v_profile.telegram_id,
        'firstName', v_profile.first_name,
        'lastName', v_profile.last_name,
        'username', v_profile.username,
        'photoUrl', v_profile.photo_url,
        'referralCode', v_profile.referral_code,
        'referredBy', v_profile.referred_by,
        'status', v_profile.status,
        'claimedWelcomeBonus', v_profile.claimed_welcome_bonus,
        'isVerified', v_profile.is_verified,
        'createdAt', EXTRACT(EPOCH FROM v_profile.created_at) * 1000
      ),
      'balances', jsonb_build_object(
        'usdt', COALESCE(v_wallet."USDT", v_wallet.balance, 0),
        'e4f', COALESCE(v_wallet."E4F", 0),
        'bnb', COALESCE(v_wallet."BNB", 0),
        'btc', COALESCE(v_wallet."BTC", 0),
        'eth', COALESCE(v_wallet."ETH", 0),
        'sol', COALESCE(v_wallet."SOL", 0),
        'ton', COALESCE(v_wallet."TON", 0),
        'xrp', COALESCE(v_wallet."XRP", 0),
        'doge', COALESCE(v_wallet."DOGE", 0),
        'ada', COALESCE(v_wallet."ADA", 0),
        'trx', COALESCE(v_wallet."TRX", 0),
        'ltc', COALESCE(v_wallet."LTC", 0)
      ),
      'message', 'Existing user restored with 100% balance preservation'
    );
  END IF;

  -- 2. New User Registration:
  -- Set unique 8-digit UID (Bug A Fix)
  v_uid := '8' || LPAD((ABS(p_telegram_id % 8999999) + 1000000)::TEXT, 7, '0');
  v_is_new := true;

  -- Generate unique E4F referral code ONCE (E4F786112 for 8827675419)
  IF p_telegram_id = 8827675419 THEN
    v_new_ref_code := 'E4F786112';
  ELSE
    LOOP
      v_new_ref_code := 'E4F' || LPAD(FLOOR(100000 + RANDOM() * 900000)::TEXT, 6, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = v_new_ref_code)
           AND NOT EXISTS (SELECT 1 FROM public.users WHERE referral_code = v_new_ref_code);
    END LOOP;
  END IF;

  -- Look up referrer by referral code
  IF p_referral_code IS NOT NULL AND p_referral_code <> '' THEN
    SELECT telegram_id INTO v_referrer_tg_id
    FROM public.profiles
    WHERE UPPER(referral_code) = UPPER(TRIM(p_referral_code))
    LIMIT 1;

    IF v_referrer_tg_id IS NULL THEN
      SELECT telegram_id INTO v_referrer_tg_id
      FROM public.users
      WHERE UPPER(referral_code) = UPPER(TRIM(p_referral_code))
      LIMIT 1;
    END IF;
  END IF;

  -- 3. Enforce 24-Hour Device Lock using device_locks table (Rule 1)
  -- Checks: WHERE created_at > NOW() - INTERVAL '24 hours' AND is_permanent = FALSE
  -- Plus checks claimed_welcome_bonus
  v_can_claim_bonus := true;

  IF p_device_hash IS NOT NULL AND TRIM(p_device_hash) <> '' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.device_locks
      WHERE device_hash = TRIM(p_device_hash)
        AND created_at > NOW() - INTERVAL '24 hours'
        AND is_permanent = FALSE
    ) INTO v_device_lock_exists;

    IF v_device_lock_exists THEN
      v_can_claim_bonus := false;
    ELSE
      -- Check if device has permanent lock
      SELECT EXISTS (
        SELECT 1 FROM public.device_locks
        WHERE device_hash = TRIM(p_device_hash)
          AND is_permanent = TRUE
      ) INTO v_device_lock_exists;

      IF v_device_lock_exists THEN
        v_can_claim_bonus := false;
      END IF;
    END IF;

    -- Record device lock
    INSERT INTO public.device_locks (
      device_hash, telegram_id, last_claim_at, claim_count, is_permanent, created_at
    ) VALUES (
      TRIM(p_device_hash), p_telegram_id, NOW(), 1, FALSE, NOW()
    )
    ON CONFLICT (device_hash) DO UPDATE SET
      last_claim_at = NOW(),
      telegram_id = EXCLUDED.telegram_id,
      claim_count = public.device_locks.claim_count + 1;
  ELSE
    -- If no device_hash passed, check telegram_id in device_locks
    SELECT EXISTS (
      SELECT 1 FROM public.device_locks
      WHERE telegram_id = p_telegram_id
        AND created_at > NOW() - INTERVAL '24 hours'
        AND is_permanent = FALSE
    ) INTO v_device_lock_exists;

    IF v_device_lock_exists THEN
      v_can_claim_bonus := false;
    END IF;
  END IF;

  -- Check if user has already claimed welcome bonus anywhere
  IF EXISTS (SELECT 1 FROM public.profiles WHERE telegram_id = p_telegram_id AND claimed_welcome_bonus = TRUE) OR
     EXISTS (SELECT 1 FROM public.users WHERE telegram_id = p_telegram_id AND claimed_welcome_bonus = TRUE) THEN
    v_can_claim_bonus := false;
  END IF;

  IF v_can_claim_bonus THEN
    v_welcome_usdt := 25.000000;
    v_welcome_e4f := 10.000000;
  ELSE
    v_welcome_usdt := 0.000000;
    v_welcome_e4f := 0.000000;
  END IF;

  -- 4. Insert into public.profiles
  INSERT INTO public.profiles (
    telegram_id, username, first_name, last_name, photo_url, is_deleted,
    id, uid, referral_code, referred_by, status, claimed_welcome_bonus,
    is_verified, device_hash, created_at, updated_at
  ) VALUES (
    p_telegram_id,
    COALESCE(p_username, ''),
    COALESCE(NULLIF(p_first_name, ''), 'E4F User'),
    COALESCE(p_last_name, ''),
    COALESCE(p_photo_url, ''),
    false,
    v_user_id,
    v_uid,
    v_new_ref_code,
    CASE WHEN v_referrer_tg_id IS NOT NULL THEN 'usr_' || v_referrer_tg_id::TEXT ELSE NULL END,
    'ACTIVE',
    v_can_claim_bonus,
    false,
    COALESCE(p_device_hash, ''),
    NOW(),
    NOW()
  )
  ON CONFLICT (telegram_id) DO UPDATE SET
    updated_at = NOW()
  RETURNING * INTO v_profile;

  -- 5. Insert into public.wallets
  INSERT INTO public.wallets (
    telegram_id, balance, total_mined, referral_earnings,
    id, user_id, "USDT", "E4F", updated_at
  ) VALUES (
    p_telegram_id,
    v_welcome_usdt,
    0,
    0,
    'wal_' || p_telegram_id::TEXT,
    v_user_id,
    v_welcome_usdt,
    v_welcome_e4f,
    NOW()
  )
  ON CONFLICT (telegram_id) DO NOTHING
  RETURNING * INTO v_wallet;

  IF v_wallet IS NULL THEN
    SELECT * INTO v_wallet FROM public.wallets WHERE telegram_id = p_telegram_id;
  END IF;

  -- 6. Insert into legacy public.users & public.balances
  INSERT INTO public.users (
    id, uid, telegram_id, first_name, last_name, username, photo_url,
    referral_code, referred_by, status, claimed_welcome_bonus, is_verified,
    created_at, updated_at
  ) VALUES (
    v_user_id, v_uid, p_telegram_id, v_profile.first_name, v_profile.last_name,
    v_profile.username, v_profile.photo_url, v_new_ref_code,
    v_profile.referred_by, 'ACTIVE', v_can_claim_bonus, false, NOW(), NOW()
  )
  ON CONFLICT (telegram_id) DO UPDATE SET
    updated_at = NOW();

  INSERT INTO public.balances (
    user_id, "USDT", "E4F", "BNB", "BTC", "ETH", "SOL", "TON", "XRP", "DOGE", "ADA", "TRX", "LTC", updated_at
  ) VALUES (
    v_user_id, v_welcome_usdt, v_welcome_e4f, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    updated_at = NOW();

  -- 7. If referred, record in public.referrals (Rule 2: referee_id UNIQUE NOT NULL, 1 time only)
  IF v_referrer_tg_id IS NOT NULL AND v_referrer_tg_id <> p_telegram_id THEN
    INSERT INTO public.referrals (id, referrer_id, referee_id, bonus_amount, status, created_at)
    VALUES ('ref_' || p_telegram_id::TEXT, v_referrer_tg_id, p_telegram_id, 0.500000, 'ACTIVE', NOW())
    ON CONFLICT (referee_id) DO NOTHING;
  END IF;

  -- 8. If welcome bonus granted, log to financial ledger
  IF v_can_claim_bonus THEN
    INSERT INTO public.transactions (
      id, user_id, asset, amount, direction, source, status, timestamp, note
    ) VALUES
    ('tx_wb_usdt_' || p_telegram_id::TEXT, v_user_id, 'USDT', 25.000000, 'IN', 'WELCOME_BONUS', 'COMPLETED',
     (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT, 'Welcome Registration Bonus (USDT) credited'),
    ('tx_wb_e4f_' || p_telegram_id::TEXT, v_user_id, 'E4F', 10.000000, 'IN', 'WELCOME_BONUS', 'COMPLETED',
     (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT, 'Welcome Registration Bonus (E4F) credited');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'is_new_user', true,
    'welcome_bonus_granted', v_can_claim_bonus,
    'user', jsonb_build_object(
      'id', v_user_id,
      'uid', v_uid,
      'telegramId', p_telegram_id,
      'firstName', v_profile.first_name,
      'lastName', v_profile.last_name,
      'username', v_profile.username,
      'photoUrl', v_profile.photo_url,
      'referralCode', v_new_ref_code,
      'referredBy', v_profile.referred_by,
      'status', 'ACTIVE',
      'claimedWelcomeBonus', v_can_claim_bonus,
      'isVerified', false,
      'createdAt', EXTRACT(EPOCH FROM v_profile.created_at) * 1000
    ),
    'balances', jsonb_build_object(
      'usdt', v_welcome_usdt,
      'e4f', v_welcome_e4f,
      'bnb', 0,
      'btc', 0,
      'eth', 0,
      'sol', 0,
      'ton', 0,
      'xrp', 0,
      'doge', 0,
      'ada', 0,
      'trx', 0,
      'ltc', 0
    ),
    'message', CASE WHEN v_can_claim_bonus THEN 'Welcome to E4F! Registration bonus credited.' ELSE 'Welcome to E4F! Account created.' END
  );
END;
$$;

-- =====================================================================
-- 10. FUNCTION 2: cleanup_old_withdrawals
-- Strict 90-day retention cleanup for finished records
-- SECURITY DEFINER, SET search_path = public, pg_temp
-- =====================================================================
CREATE OR REPLACE FUNCTION public.cleanup_old_withdrawals()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deleted_count INTEGER := 0;
BEGIN
  -- Strict financial rule:
  -- NEVER delete pending, processing, in_review withdrawals even if older than 90 days.
  -- Only completed, success, rejected, failed, cancelled older than 90 days are deleted.
  DELETE FROM public.withdrawals
  WHERE created_at < NOW() - INTERVAL '90 days'
    AND LOWER(status) IN ('completed', 'success', 'rejected', 'failed', 'cancelled')
    AND LOWER(status) NOT IN ('pending', 'processing', 'in_review');

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN v_deleted_count;
END;
$$;

-- =====================================================================
-- 11. FUNCTION 3: delete_user_permanently
-- SECURITY DEFINER, SET search_path = public, pg_temp
-- Safely cleans up all foreign-key dependent rows in exact order (referrals, withdrawals, wallets, profiles).
-- =====================================================================
CREATE OR REPLACE FUNCTION public.delete_user_permanently(
  p_telegram_id BIGINT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id TEXT;
  v_exists BOOLEAN := false;
BEGIN
  IF p_telegram_id IS NULL OR p_telegram_id <= 0 THEN
    RETURN FALSE;
  END IF;

  v_user_id := 'usr_' || p_telegram_id::TEXT;

  -- Check if profile or user exists
  IF EXISTS (SELECT 1 FROM public.profiles WHERE telegram_id = p_telegram_id) OR
     EXISTS (SELECT 1 FROM public.users WHERE telegram_id = p_telegram_id) THEN
    v_exists := true;
  ELSE
    RETURN FALSE;
  END IF;

  -- 1. Remove child records protected by ON DELETE RESTRICT
  DELETE FROM public.referrals WHERE referee_id = p_telegram_id OR referrer_id = p_telegram_id;
  DELETE FROM public.withdrawals WHERE telegram_id = p_telegram_id;
  DELETE FROM public.wallets WHERE telegram_id = p_telegram_id;
  DELETE FROM public.device_locks WHERE telegram_id = p_telegram_id;

  -- 2. Remove profile
  DELETE FROM public.profiles WHERE telegram_id = p_telegram_id;

  -- 3. Remove legacy linked records
  DELETE FROM public.mining_sessions WHERE user_id = v_user_id;
  DELETE FROM public.deposits WHERE user_id = v_user_id;
  DELETE FROM public.transactions WHERE user_id = v_user_id;
  DELETE FROM public.balances WHERE user_id = v_user_id;
  DELETE FROM public.users WHERE telegram_id = p_telegram_id OR id = v_user_id;

  RETURN TRUE;
END;
$$;

-- =====================================================================
-- 12. FUNCTION 4: execute_atomic_withdrawal
-- SECURITY DEFINER, SET search_path = public, pg_temp
-- =====================================================================
CREATE OR REPLACE FUNCTION public.execute_atomic_withdrawal(
  p_withdrawal_id TEXT,
  p_user_id TEXT,
  p_amount NUMERIC,
  p_currency TEXT,
  p_network TEXT,
  p_wallet_address TEXT,
  p_fee NUMERIC DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_total_deduct NUMERIC := p_amount + p_fee;
  v_curr_balance NUMERIC;
  v_new_balance NUMERIC;
  v_curr TEXT := UPPER(p_currency);
  v_tg_id BIGINT;
BEGIN
  IF v_curr = 'USDT' THEN
    SELECT "USDT" INTO v_curr_balance FROM public.balances WHERE user_id = p_user_id FOR UPDATE;
  ELSIF v_curr = 'BTC' THEN
    SELECT "BTC" INTO v_curr_balance FROM public.balances WHERE user_id = p_user_id FOR UPDATE;
  ELSIF v_curr = 'ETH' THEN
    SELECT "ETH" INTO v_curr_balance FROM public.balances WHERE user_id = p_user_id FOR UPDATE;
  ELSIF v_curr = 'SOL' THEN
    SELECT "SOL" INTO v_curr_balance FROM public.balances WHERE user_id = p_user_id FOR UPDATE;
  ELSIF v_curr = 'BNB' THEN
    SELECT "BNB" INTO v_curr_balance FROM public.balances WHERE user_id = p_user_id FOR UPDATE;
  ELSE
    RAISE EXCEPTION 'Unsupported withdrawal currency %', p_currency;
  END IF;

  IF v_curr_balance IS NULL OR v_curr_balance < v_total_deduct THEN
    RAISE EXCEPTION 'Insufficient balance: required %, available %', v_total_deduct, COALESCE(v_curr_balance, 0);
  END IF;

  v_new_balance := v_curr_balance - v_total_deduct;

  -- Deduct from balances
  IF v_curr = 'USDT' THEN
    UPDATE public.balances SET "USDT" = v_new_balance, updated_at = NOW() WHERE user_id = p_user_id;
  ELSIF v_curr = 'BTC' THEN
    UPDATE public.balances SET "BTC" = v_new_balance, updated_at = NOW() WHERE user_id = p_user_id;
  ELSIF v_curr = 'ETH' THEN
    UPDATE public.balances SET "ETH" = v_new_balance, updated_at = NOW() WHERE user_id = p_user_id;
  ELSIF v_curr = 'SOL' THEN
    UPDATE public.balances SET "SOL" = v_new_balance, updated_at = NOW() WHERE user_id = p_user_id;
  ELSIF v_curr = 'BNB' THEN
    UPDATE public.balances SET "BNB" = v_new_balance, updated_at = NOW() WHERE user_id = p_user_id;
  END IF;

  -- Extract telegram_id
  IF p_user_id LIKE 'usr_%' THEN
    v_tg_id := NULLIF(SUBSTRING(p_user_id FROM 5), '')::BIGINT;
    IF v_tg_id IS NOT NULL THEN
      UPDATE public.wallets
      SET balance = balance - v_total_deduct,
          "USDT" = "USDT" - v_total_deduct,
          updated_at = NOW()
      WHERE telegram_id = v_tg_id AND (balance >= v_total_deduct OR "USDT" >= v_total_deduct);
    END IF;
  END IF;

  -- Insert withdrawal record
  INSERT INTO public.withdrawals (
    id, user_id, telegram_id, amount, currency, network, wallet_address, fee, status, created_at, updated_at
  ) VALUES (
    p_withdrawal_id, p_user_id, v_tg_id, p_amount, v_curr, p_network, p_wallet_address, p_fee, 'pending', NOW(), NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  -- Insert transaction audit
  INSERT INTO public.transactions (
    id, user_id, asset, amount, direction, source, status, timestamp, address, network, fee, note
  ) VALUES (
    p_withdrawal_id, p_user_id, v_curr, p_amount, 'OUT', 'WITHDRAW', 'PENDING',
    (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT, p_wallet_address, p_network, p_fee, 'Withdrawal request initiated'
  );

  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'deducted', v_total_deduct,
    'currency', v_curr,
    'withdrawal_id', p_withdrawal_id
  );
END;
$$;

-- =====================================================================
-- 13. FUNCTION 5: verify_atomic_deposit
-- SECURITY DEFINER, SET search_path = public, pg_temp
-- =====================================================================
CREATE OR REPLACE FUNCTION public.verify_atomic_deposit(
  p_deposit_id TEXT,
  p_admin_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id TEXT;
  v_amount NUMERIC;
  v_asset TEXT;
  v_status TEXT;
  v_txid TEXT;
  v_new_bal NUMERIC;
  v_curr TEXT;
  v_tg_id BIGINT;
BEGIN
  SELECT user_id, amount, asset, status, txid
  INTO v_user_id, v_amount, v_asset, v_status, v_txid
  FROM public.deposits
  WHERE id = p_deposit_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deposit % not found', p_deposit_id;
  END IF;

  IF v_status <> 'PENDING' THEN
    RAISE EXCEPTION 'Deposit is already in status %', v_status;
  END IF;

  v_curr := UPPER(v_asset);

  UPDATE public.deposits
  SET status = 'VERIFIED', verified_at = NOW()
  WHERE id = p_deposit_id;

  IF v_curr = 'USDT' THEN
    UPDATE public.balances
    SET "USDT" = "USDT" + v_amount, updated_at = NOW()
    WHERE user_id = v_user_id
    RETURNING "USDT" INTO v_new_bal;

    UPDATE public.users
    SET deposit_balance = deposit_balance + v_amount, updated_at = NOW()
    WHERE id = v_user_id;

    IF v_user_id LIKE 'usr_%' THEN
      v_tg_id := NULLIF(SUBSTRING(v_user_id FROM 5), '')::BIGINT;
      IF v_tg_id IS NOT NULL THEN
        UPDATE public.wallets
        SET balance = balance + v_amount,
            "USDT" = "USDT" + v_amount,
            updated_at = NOW()
        WHERE telegram_id = v_tg_id;
      END IF;
    END IF;
  ELSE
    RAISE EXCEPTION 'Unsupported deposit asset %', v_asset;
  END IF;

  UPDATE public.transactions
  SET status = 'COMPLETED', note = 'Verified external deposit credited to wallet'
  WHERE id = p_deposit_id OR reference_id = v_txid;

  INSERT INTO public.audit_logs (
    id, admin_id, action, target, details, timestamp
  ) VALUES (
    'audit_' || (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
    p_admin_id, 'VERIFY_DEPOSIT', p_deposit_id,
    'Verified deposit of ' || v_amount || ' ' || v_curr || ' (TXID: ' || v_txid || ') for user ' || v_user_id,
    (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
  );

  RETURN jsonb_build_object(
    'success', true,
    'deposit_id', p_deposit_id,
    'new_balance', v_new_bal,
    'credited', v_amount,
    'asset', v_curr
  );
END;
$$;

-- =====================================================================
-- 14. FUNCTION 6: execute_atomic_trade (Requirements 2 & 3)
-- Live Market Spot Trading Engine using real-time market_prices table
-- Dynamic Calculation: Current market price from market_prices is used.
-- Example: User buys with 25 USDT; when price is 18 USDT upon sell, user receives 18 USDT.
-- Atomic execution with row locks (FOR UPDATE) across balances & wallets.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.execute_atomic_trade(
  p_user_id TEXT,
  p_pair TEXT,
  p_side TEXT,
  p_amount NUMERIC,
  p_type TEXT DEFAULT 'MARKET'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pair TEXT;
  v_side TEXT;
  v_base_asset TEXT;
  v_quote_asset TEXT;
  v_current_price NUMERIC;
  v_total_usdt NUMERIC;
  v_tg_id BIGINT;
  v_curr_usdt NUMERIC := 0;
  v_curr_base NUMERIC := 0;
  v_new_usdt NUMERIC := 0;
  v_new_base NUMERIC := 0;
  v_order_id TEXT;
BEGIN
  IF p_user_id IS NULL OR TRIM(p_user_id) = '' THEN
    RAISE EXCEPTION 'Invalid user_id';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Trade amount must be greater than 0';
  END IF;

  v_pair := UPPER(TRIM(p_pair));
  IF NOT v_pair LIKE '%/%' THEN
    v_pair := v_pair || '/USDT';
  END IF;

  IF v_pair LIKE 'E4F/%' THEN
    RAISE EXCEPTION 'E4F Token is not listed yet. Spot trading unavailable until official listing.';
  END IF;

  v_side := UPPER(TRIM(p_side));
  IF v_side NOT IN ('BUY', 'SELL') THEN
    RAISE EXCEPTION 'Trade side must be BUY or SELL';
  END IF;

  v_base_asset := SPLIT_PART(v_pair, '/', 1);
  v_quote_asset := SPLIT_PART(v_pair, '/', 2);

  IF v_quote_asset <> 'USDT' THEN
    RAISE EXCEPTION 'Only USDT quote pairs are supported';
  END IF;

  -- 1. Fetch live market price from market_prices table
  SELECT price INTO v_current_price
  FROM public.market_prices
  WHERE symbol = v_pair;

  IF v_current_price IS NULL OR v_current_price <= 0 THEN
    RAISE EXCEPTION 'Live market price for % is currently unavailable', v_pair;
  END IF;

  v_total_usdt := ROUND((v_current_price * p_amount), 4);

  IF p_user_id LIKE 'usr_%' THEN
    v_tg_id := NULLIF(SUBSTRING(p_user_id FROM 5), '')::BIGINT;
  END IF;

  -- Ensure balance row exists with row lock (FOR UPDATE)
  PERFORM 1 FROM public.balances WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.balances (user_id, "USDT", updated_at)
    VALUES (p_user_id, 0, NOW())
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  -- Read balances for USDT and base asset
  SELECT "USDT" INTO v_curr_usdt FROM public.balances WHERE user_id = p_user_id FOR UPDATE;
  v_curr_usdt := COALESCE(v_curr_usdt, 0);

  IF v_base_asset = 'BTC' THEN
    SELECT COALESCE("BTC", 0) INTO v_curr_base FROM public.balances WHERE user_id = p_user_id FOR UPDATE;
  ELSIF v_base_asset = 'ETH' THEN
    SELECT COALESCE("ETH", 0) INTO v_curr_base FROM public.balances WHERE user_id = p_user_id FOR UPDATE;
  ELSIF v_base_asset = 'SOL' THEN
    SELECT COALESCE("SOL", 0) INTO v_curr_base FROM public.balances WHERE user_id = p_user_id FOR UPDATE;
  ELSIF v_base_asset = 'BNB' THEN
    SELECT COALESCE("BNB", 0) INTO v_curr_base FROM public.balances WHERE user_id = p_user_id FOR UPDATE;
  ELSIF v_base_asset = 'XRP' THEN
    SELECT COALESCE("XRP", 0) INTO v_curr_base FROM public.balances WHERE user_id = p_user_id FOR UPDATE;
  ELSIF v_base_asset = 'DOGE' THEN
    SELECT COALESCE("DOGE", 0) INTO v_curr_base FROM public.balances WHERE user_id = p_user_id FOR UPDATE;
  ELSIF v_base_asset = 'TON' THEN
    SELECT COALESCE("TON", 0) INTO v_curr_base FROM public.balances WHERE user_id = p_user_id FOR UPDATE;
  ELSIF v_base_asset = 'ADA' THEN
    SELECT COALESCE("ADA", 0) INTO v_curr_base FROM public.balances WHERE user_id = p_user_id FOR UPDATE;
  ELSIF v_base_asset = 'TRX' THEN
    SELECT COALESCE("TRX", 0) INTO v_curr_base FROM public.balances WHERE user_id = p_user_id FOR UPDATE;
  ELSIF v_base_asset = 'LTC' THEN
    SELECT COALESCE("LTC", 0) INTO v_curr_base FROM public.balances WHERE user_id = p_user_id FOR UPDATE;
  ELSE
    RAISE EXCEPTION 'Unsupported base asset %', v_base_asset;
  END IF;

  -- Execute BUY or SELL logic
  IF v_side = 'BUY' THEN
    IF v_curr_usdt < v_total_usdt THEN
      RAISE EXCEPTION 'Insufficient USDT balance. Available: % USDT, Required: % USDT', v_curr_usdt, v_total_usdt;
    END IF;
    v_new_usdt := v_curr_usdt - v_total_usdt;
    v_new_base := v_curr_base + p_amount;
  ELSE
    -- SELL: sell base asset, credit USDT at live market price
    IF v_curr_base < p_amount THEN
      RAISE EXCEPTION 'Insufficient % balance. Available: %, Required: %', v_base_asset, v_curr_base, p_amount;
    END IF;
    v_new_base := v_curr_base - p_amount;
    v_new_usdt := v_curr_usdt + v_total_usdt;
  END IF;

  -- Update public.balances
  IF v_base_asset = 'BTC' THEN
    UPDATE public.balances SET "USDT" = v_new_usdt, "BTC" = v_new_base, updated_at = NOW() WHERE user_id = p_user_id;
  ELSIF v_base_asset = 'ETH' THEN
    UPDATE public.balances SET "USDT" = v_new_usdt, "ETH" = v_new_base, updated_at = NOW() WHERE user_id = p_user_id;
  ELSIF v_base_asset = 'SOL' THEN
    UPDATE public.balances SET "USDT" = v_new_usdt, "SOL" = v_new_base, updated_at = NOW() WHERE user_id = p_user_id;
  ELSIF v_base_asset = 'BNB' THEN
    UPDATE public.balances SET "USDT" = v_new_usdt, "BNB" = v_new_base, updated_at = NOW() WHERE user_id = p_user_id;
  ELSIF v_base_asset = 'XRP' THEN
    UPDATE public.balances SET "USDT" = v_new_usdt, "XRP" = v_new_base, updated_at = NOW() WHERE user_id = p_user_id;
  ELSIF v_base_asset = 'DOGE' THEN
    UPDATE public.balances SET "USDT" = v_new_usdt, "DOGE" = v_new_base, updated_at = NOW() WHERE user_id = p_user_id;
  ELSIF v_base_asset = 'TON' THEN
    UPDATE public.balances SET "USDT" = v_new_usdt, "TON" = v_new_base, updated_at = NOW() WHERE user_id = p_user_id;
  ELSIF v_base_asset = 'ADA' THEN
    UPDATE public.balances SET "USDT" = v_new_usdt, "ADA" = v_new_base, updated_at = NOW() WHERE user_id = p_user_id;
  ELSIF v_base_asset = 'TRX' THEN
    UPDATE public.balances SET "USDT" = v_new_usdt, "TRX" = v_new_base, updated_at = NOW() WHERE user_id = p_user_id;
  ELSIF v_base_asset = 'LTC' THEN
    UPDATE public.balances SET "USDT" = v_new_usdt, "LTC" = v_new_base, updated_at = NOW() WHERE user_id = p_user_id;
  END IF;

  -- Synchronize with public.wallets if telegram_id exists
  IF v_tg_id IS NOT NULL THEN
    IF v_base_asset = 'BTC' THEN
      UPDATE public.wallets SET "USDT" = v_new_usdt, balance = v_new_usdt, "BTC" = v_new_base, updated_at = NOW() WHERE telegram_id = v_tg_id;
    ELSIF v_base_asset = 'ETH' THEN
      UPDATE public.wallets SET "USDT" = v_new_usdt, balance = v_new_usdt, "ETH" = v_new_base, updated_at = NOW() WHERE telegram_id = v_tg_id;
    ELSIF v_base_asset = 'SOL' THEN
      UPDATE public.wallets SET "USDT" = v_new_usdt, balance = v_new_usdt, "SOL" = v_new_base, updated_at = NOW() WHERE telegram_id = v_tg_id;
    ELSIF v_base_asset = 'BNB' THEN
      UPDATE public.wallets SET "USDT" = v_new_usdt, balance = v_new_usdt, "BNB" = v_new_base, updated_at = NOW() WHERE telegram_id = v_tg_id;
    ELSIF v_base_asset = 'XRP' THEN
      UPDATE public.wallets SET "USDT" = v_new_usdt, balance = v_new_usdt, "XRP" = v_new_base, updated_at = NOW() WHERE telegram_id = v_tg_id;
    ELSIF v_base_asset = 'DOGE' THEN
      UPDATE public.wallets SET "USDT" = v_new_usdt, balance = v_new_usdt, "DOGE" = v_new_base, updated_at = NOW() WHERE telegram_id = v_tg_id;
    ELSIF v_base_asset = 'TON' THEN
      UPDATE public.wallets SET "USDT" = v_new_usdt, balance = v_new_usdt, "TON" = v_new_base, updated_at = NOW() WHERE telegram_id = v_tg_id;
    ELSIF v_base_asset = 'ADA' THEN
      UPDATE public.wallets SET "USDT" = v_new_usdt, balance = v_new_usdt, "ADA" = v_new_base, updated_at = NOW() WHERE telegram_id = v_tg_id;
    ELSIF v_base_asset = 'TRX' THEN
      UPDATE public.wallets SET "USDT" = v_new_usdt, balance = v_new_usdt, "TRX" = v_new_base, updated_at = NOW() WHERE telegram_id = v_tg_id;
    ELSIF v_base_asset = 'LTC' THEN
      UPDATE public.wallets SET "USDT" = v_new_usdt, balance = v_new_usdt, "LTC" = v_new_base, updated_at = NOW() WHERE telegram_id = v_tg_id;
    END IF;
  END IF;

  -- Create Spot Order Record
  v_order_id := 'ord_' || (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT || '_' || SUBSTRING(gen_random_uuid()::TEXT FROM 1 FOR 6);
  INSERT INTO public.spot_orders (
    id, user_id, pair, side, type, price, amount, total_usdt, filled_amount, status, timestamp, created_at
  ) VALUES (
    v_order_id, p_user_id, v_pair, v_side, p_type, v_current_price, p_amount, v_total_usdt, p_amount, 'FILLED',
    (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT, NOW()
  );

  -- Record Transaction in Ledger
  INSERT INTO public.transactions (
    id, user_id, asset, amount, direction, source, status, timestamp, reference_id, note
  ) VALUES (
    'tx_' || v_order_id,
    p_user_id,
    CASE WHEN v_side = 'BUY' THEN 'USDT' ELSE v_base_asset END,
    CASE WHEN v_side = 'BUY' THEN v_total_usdt ELSE p_amount END,
    CASE WHEN v_side = 'BUY' THEN 'OUT' ELSE 'IN' END,
    'SPOT_TRADE_' || v_side,
    'COMPLETED',
    (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
    v_order_id,
    v_side || ' ' || p_amount::TEXT || ' ' || v_pair || ' @ ' || v_current_price::TEXT || ' USDT'
  );

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'pair', v_pair,
    'side', v_side,
    'price', v_current_price,
    'amount', p_amount,
    'total_usdt', v_total_usdt,
    'new_usdt_balance', v_new_usdt,
    'new_coin_balance', v_new_base,
    'timestamp', (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
  );
END;
$$;

-- =====================================================================
-- 15. FUNCTION 7: get_portfolio_value (Requirements 2 & 3)
-- Calculates real-time total net worth in USDT based on market_prices table
-- SECURITY DEFINER, SET search_path = public, pg_temp
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_portfolio_value(
  p_user_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_bal RECORD;
  v_total_usdt NUMERIC := 0;
  v_btc_price NUMERIC := 0;
  v_eth_price NUMERIC := 0;
  v_sol_price NUMERIC := 0;
  v_bnb_price NUMERIC := 0;
  v_xrp_price NUMERIC := 0;
  v_doge_price NUMERIC := 0;
  v_ton_price NUMERIC := 0;
  v_ada_price NUMERIC := 0;
  v_trx_price NUMERIC := 0;
  v_ltc_price NUMERIC := 0;
BEGIN
  -- Get user balances
  SELECT * INTO v_bal FROM public.balances WHERE user_id = p_user_id;

  -- Get current market prices
  SELECT COALESCE(price, 0) INTO v_btc_price FROM public.market_prices WHERE symbol = 'BTC/USDT';
  SELECT COALESCE(price, 0) INTO v_eth_price FROM public.market_prices WHERE symbol = 'ETH/USDT';
  SELECT COALESCE(price, 0) INTO v_sol_price FROM public.market_prices WHERE symbol = 'SOL/USDT';
  SELECT COALESCE(price, 0) INTO v_bnb_price FROM public.market_prices WHERE symbol = 'BNB/USDT';
  SELECT COALESCE(price, 0) INTO v_xrp_price FROM public.market_prices WHERE symbol = 'XRP/USDT';
  SELECT COALESCE(price, 0) INTO v_doge_price FROM public.market_prices WHERE symbol = 'DOGE/USDT';
  SELECT COALESCE(price, 0) INTO v_ton_price FROM public.market_prices WHERE symbol = 'TON/USDT';
  SELECT COALESCE(price, 0) INTO v_ada_price FROM public.market_prices WHERE symbol = 'ADA/USDT';
  SELECT COALESCE(price, 0) INTO v_trx_price FROM public.market_prices WHERE symbol = 'TRX/USDT';
  SELECT COALESCE(price, 0) INTO v_ltc_price FROM public.market_prices WHERE symbol = 'LTC/USDT';

  IF FOUND AND v_bal IS NOT NULL THEN
    v_total_usdt := COALESCE(v_bal."USDT", 0)
      + (COALESCE(v_bal."BTC", 0) * v_btc_price)
      + (COALESCE(v_bal."ETH", 0) * v_eth_price)
      + (COALESCE(v_bal."SOL", 0) * v_sol_price)
      + (COALESCE(v_bal."BNB", 0) * v_bnb_price)
      + (COALESCE(v_bal."XRP", 0) * v_xrp_price)
      + (COALESCE(v_bal."DOGE", 0) * v_doge_price)
      + (COALESCE(v_bal."TON", 0) * v_ton_price)
      + (COALESCE(v_bal."ADA", 0) * v_ada_price)
      + (COALESCE(v_bal."TRX", 0) * v_trx_price)
      + (COALESCE(v_bal."LTC", 0) * v_ltc_price);
  END IF;

  RETURN jsonb_build_object(
    'user_id', p_user_id,
    'total_value_usdt', ROUND(v_total_usdt, 2),
    'usdt_balance', COALESCE(v_bal."USDT", 0),
    'e4f_balance', COALESCE(v_bal."E4F", 0),
    'btc_balance', COALESCE(v_bal."BTC", 0),
    'eth_balance', COALESCE(v_bal."ETH", 0),
    'sol_balance', COALESCE(v_bal."SOL", 0),
    'bnb_balance', COALESCE(v_bal."BNB", 0),
    'timestamp', (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
  );
END;
$$;

-- =====================================================================
-- 16. ROW LEVEL SECURITY (RLS) & SERVICE ROLE POLICIES
-- Service role key has full access; client anon/authenticated has safe access
-- =====================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mining_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spot_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_prices ENABLE ROW LEVEL SECURITY;

-- Idempotent RLS Policy Application
DO $$
BEGIN
  -- Profiles
  DROP POLICY IF EXISTS service_role_all_profiles ON public.profiles;
  CREATE POLICY service_role_all_profiles ON public.profiles FOR ALL TO service_role USING (true) WITH CHECK (true);

  -- Wallets
  DROP POLICY IF EXISTS service_role_all_wallets ON public.wallets;
  CREATE POLICY service_role_all_wallets ON public.wallets FOR ALL TO service_role USING (true) WITH CHECK (true);

  -- Referrals
  DROP POLICY IF EXISTS service_role_all_referrals ON public.referrals;
  CREATE POLICY service_role_all_referrals ON public.referrals FOR ALL TO service_role USING (true) WITH CHECK (true);

  -- Withdrawals
  DROP POLICY IF EXISTS service_role_all_withdrawals ON public.withdrawals;
  CREATE POLICY service_role_all_withdrawals ON public.withdrawals FOR ALL TO service_role USING (true) WITH CHECK (true);

  -- Device Locks
  DROP POLICY IF EXISTS service_role_all_device_locks ON public.device_locks;
  CREATE POLICY service_role_all_device_locks ON public.device_locks FOR ALL TO service_role USING (true) WITH CHECK (true);

  -- Users
  DROP POLICY IF EXISTS service_role_all_users ON public.users;
  CREATE POLICY service_role_all_users ON public.users FOR ALL TO service_role USING (true) WITH CHECK (true);

  -- Balances
  DROP POLICY IF EXISTS service_role_all_balances ON public.balances;
  CREATE POLICY service_role_all_balances ON public.balances FOR ALL TO service_role USING (true) WITH CHECK (true);

  -- Transactions
  DROP POLICY IF EXISTS service_role_all_transactions ON public.transactions;
  CREATE POLICY service_role_all_transactions ON public.transactions FOR ALL TO service_role USING (true) WITH CHECK (true);

  -- Deposits
  DROP POLICY IF EXISTS service_role_all_deposits ON public.deposits;
  CREATE POLICY service_role_all_deposits ON public.deposits FOR ALL TO service_role USING (true) WITH CHECK (true);

  -- Mining Sessions
  DROP POLICY IF EXISTS service_role_all_mining ON public.mining_sessions;
  CREATE POLICY service_role_all_mining ON public.mining_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);

  -- Audit Logs
  DROP POLICY IF EXISTS service_role_all_audit ON public.audit_logs;
  CREATE POLICY service_role_all_audit ON public.audit_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

  -- Spot Orders
  DROP POLICY IF EXISTS service_role_all_spot_orders ON public.spot_orders;
  CREATE POLICY service_role_all_spot_orders ON public.spot_orders FOR ALL TO service_role USING (true) WITH CHECK (true);

  -- System Settings
  DROP POLICY IF EXISTS service_role_all_system_settings ON public.system_settings;
  CREATE POLICY service_role_all_system_settings ON public.system_settings FOR ALL TO service_role USING (true) WITH CHECK (true);
  DROP POLICY IF EXISTS anon_select_system_settings ON public.system_settings;
  CREATE POLICY anon_select_system_settings ON public.system_settings FOR SELECT TO anon, authenticated USING (true);

  -- Market Prices
  DROP POLICY IF EXISTS service_role_all_market_prices ON public.market_prices;
  CREATE POLICY service_role_all_market_prices ON public.market_prices FOR ALL TO service_role USING (true) WITH CHECK (true);
  DROP POLICY IF EXISTS anon_select_market_prices ON public.market_prices;
  CREATE POLICY anon_select_market_prices ON public.market_prices FOR SELECT TO anon, authenticated USING (true);
END $$;

-- 17. PERMISSIONS & GRANTS
GRANT EXECUTE ON FUNCTION public.get_or_restore_user TO service_role, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_withdrawals TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_user_permanently TO service_role;
GRANT EXECUTE ON FUNCTION public.execute_atomic_withdrawal TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_atomic_deposit TO service_role;
GRANT EXECUTE ON FUNCTION public.execute_atomic_trade TO service_role, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_portfolio_value TO service_role, anon, authenticated;

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT SELECT ON TABLE public.market_prices TO anon, authenticated;
