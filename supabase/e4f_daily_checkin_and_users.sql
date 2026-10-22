-- =====================================================================
-- E4F TELEGRAM MINI APP - DAILY CHECK-IN & REWARDS CONFIGURATION
-- 100% Non-destructive | Run in Supabase SQL Editor
-- =====================================================================

-- 1. Create table for persistent user daily check-in states
CREATE TABLE IF NOT EXISTS public.e4f_daily_checkins (
  user_id text PRIMARY KEY,
  current_day int DEFAULT 1,
  last_claim_date date DEFAULT NULL,
  streak_count int DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

-- 2. Create table for configurable 7-day daily rewards
CREATE TABLE IF NOT EXISTS public.e4f_daily_rewards_config (
  day_number int PRIMARY KEY,
  reward_amount numeric NOT NULL,
  reward_type text NOT NULL DEFAULT 'USDT',
  is_active boolean DEFAULT true
);

-- 3. Insert default 7-day reward schedule (Day 1-7)
INSERT INTO public.e4f_daily_rewards_config (day_number, reward_amount, reward_type) VALUES
(1, 0.01, 'USDT'),
(2, 0.02, 'USDT'),
(3, 0.03, 'USDT'),
(4, 3, 'E4F'),
(5, 5, 'E4F'),
(6, 0.05, 'USDT'),
(7, 0.07, 'USDT')
ON CONFLICT (day_number) DO UPDATE
SET reward_amount = EXCLUDED.reward_amount,
    reward_type = EXCLUDED.reward_type
WHERE public.e4f_daily_rewards_config.reward_amount IS NULL;

-- 4. Enable Row Level Security (RLS) safely
ALTER TABLE public.e4f_daily_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.e4f_daily_rewards_config ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS Policies safely
DO $$
BEGIN
  -- Daily Rewards Config: Read for all
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'e4f_daily_rewards_config' AND policyname = 'Allow select on e4f_daily_rewards_config'
  ) THEN
    CREATE POLICY "Allow select on e4f_daily_rewards_config" ON public.e4f_daily_rewards_config FOR SELECT USING (true);
  END IF;

  -- Daily Rewards Config: Insert/Update for admin and service_role
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'e4f_daily_rewards_config' AND policyname = 'Allow write on e4f_daily_rewards_config'
  ) THEN
    CREATE POLICY "Allow write on e4f_daily_rewards_config" ON public.e4f_daily_rewards_config FOR ALL USING (true) WITH CHECK (true);
  END IF;

  -- Daily Check-in: Select
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'e4f_daily_checkins' AND policyname = 'Allow select on e4f_daily_checkins'
  ) THEN
    CREATE POLICY "Allow select on e4f_daily_checkins" ON public.e4f_daily_checkins FOR SELECT USING (true);
  END IF;

  -- Daily Check-in: Insert / Update
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'e4f_daily_checkins' AND policyname = 'Allow write on e4f_daily_checkins'
  ) THEN
    CREATE POLICY "Allow write on e4f_daily_checkins" ON public.e4f_daily_checkins FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 6. Grant Permissions
GRANT ALL ON TABLE public.e4f_daily_checkins TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.e4f_daily_rewards_config TO anon, authenticated, service_role;

-- 7. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_daily_checkins_user_date ON public.e4f_daily_checkins(user_id, last_claim_date);
CREATE INDEX IF NOT EXISTS idx_users_referred_by ON public.users(referred_by);

-- 8. Verify Table Status
SELECT 'E4F DAILY CHECK-IN TABLES INSTALLED SUCCESSFULLY' AS status,
       (SELECT count(*) FROM public.e4f_daily_rewards_config) AS total_reward_days,
       (SELECT count(*) FROM public.e4f_daily_checkins) AS total_user_checkins;
