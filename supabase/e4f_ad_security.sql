-- =====================================================================
-- E4F WEB3 EXCHANGE - AD / REWARD SECURITY (run ONCE in Supabase > SQL Editor)
-- Safe to run again. It does NOT delete any user, balance or transaction.
-- =====================================================================

-- 1) Daily spin / gift-box slots (one row = one used slot, a duplicate is impossible)
CREATE TABLE IF NOT EXISTS public.e4f_daily_claims (
  user_id    TEXT        NOT NULL,
  day        DATE        NOT NULL,
  type       TEXT        NOT NULL CHECK (type IN ('SPIN','GIFT_BOX')),
  slot       INTEGER     NOT NULL CHECK (slot BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day, type, slot)
);

-- 2) One-time redemption of a finished ad (a reward token can never be used twice)
CREATE TABLE IF NOT EXISTS public.e4f_ad_redeemed (
  session_id  TEXT        PRIMARY KEY,
  user_id     TEXT        NOT NULL,
  action      TEXT        NOT NULL,
  slot        INTEGER     NOT NULL DEFAULT 0,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3) Optional Monetag server-to-server confirmations
CREATE TABLE IF NOT EXISTS public.e4f_ad_postbacks (
  ymid       TEXT        PRIMARY KEY,
  zone_id    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4) Logging tables used by the server (create if missing)
CREATE TABLE IF NOT EXISTS public.e4f_ad_views (
  id BIGSERIAL PRIMARY KEY, user_id TEXT, network TEXT, placement TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.e4f_ad_events (
  id BIGSERIAL PRIMARY KEY, user_id TEXT, network TEXT, placement TEXT, reward_token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5) Only ONE active mining session per user (blocks double start races)
DO $$
BEGIN
  IF to_regclass('public.mining_sessions') IS NOT NULL THEN
    -- close finished-but-unclaimed rows so they are not "active"
    UPDATE public.mining_sessions
       SET status = 'COMPLETED'
     WHERE status = 'ACTIVE'
       AND end_time <= (extract(epoch FROM now()) * 1000)::bigint;
    -- if somebody still has 2 live ACTIVE rows, keep only the newest
    UPDATE public.mining_sessions m
       SET status = 'COMPLETED'
     WHERE m.status = 'ACTIVE'
       AND EXISTS (SELECT 1 FROM public.mining_sessions n
                    WHERE n.user_id = m.user_id AND n.status = 'ACTIVE' AND n.start_time > m.start_time);
    CREATE UNIQUE INDEX IF NOT EXISTS uq_mining_one_active
      ON public.mining_sessions (user_id) WHERE status = 'ACTIVE';
  END IF;
END $$;

-- 6) LOCK DOWN: only the server (service_role) may touch these tables.
--    Removes every "USING (true)" open policy and every anon / authenticated grant.
DO $$
DECLARE
  t   TEXT;
  pol RECORD;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'e4f_daily_claims','e4f_ad_redeemed','e4f_ad_postbacks','e4f_ad_views','e4f_ad_events',
    'user_ad_logs','user_daily_ads','ad_settings','e4f_daily_checkins','e4f_daily_rewards_config'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
      END LOOP;
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', t);
      EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', t);
    END IF;
  END LOOP;
END $$;

-- 7) LOCK DOWN money functions: browsers (anon key) must never call them directly.
DO $$
DECLARE fn RECORD;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN ('get_or_restore_user','execute_atomic_trade','get_portfolio_value','add_e4f_balance',
                         'execute_atomic_withdrawal','verify_atomic_deposit','cleanup_old_withdrawals','delete_user_permanently')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn.sig);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- Admin content (notices + tasks) persisted for serverless hosting
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.e4f_content (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.e4f_content ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.e4f_content FROM anon, authenticated;
GRANT ALL ON public.e4f_content TO service_role;

-- One-time task rewards (a user can never be paid twice for the same task)
CREATE TABLE IF NOT EXISTS public.e4f_task_claims (
  user_id text NOT NULL,
  task_id text NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, task_id)
);
ALTER TABLE public.e4f_task_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.e4f_task_claims FROM anon, authenticated;
GRANT ALL ON public.e4f_task_claims TO service_role;

-- Admin settings table (safe if it already exists)
CREATE TABLE IF NOT EXISTS public.system_settings (
  id text PRIMARY KEY DEFAULT 'global_settings',
  settings jsonb NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.system_settings FROM anon, authenticated;
GRANT ALL ON public.system_settings TO service_role;
