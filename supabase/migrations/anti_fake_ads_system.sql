-- =====================================================================
-- ANTI FAKE ADS SYSTEM - E4F MINING (SUPABASE MIGRATION)
-- =====================================================================

-- 1. Table: user_ad_logs
CREATE TABLE IF NOT EXISTS public.user_ad_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  ad_id TEXT NOT NULL,
  network TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  watch_duration INT,
  token TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Table: user_daily_ads
CREATE TABLE IF NOT EXISTS public.user_daily_ads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  key TEXT NOT NULL,
  date DATE NOT NULL,
  done BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, type, key, date)
);

-- 3. Secure Balance Add Function: add_e4f_balance
CREATE OR REPLACE FUNCTION public.add_e4f_balance(p_user_id TEXT, p_amount NUMERIC, p_spin_amount INT DEFAULT 0)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  -- Update profiles table by telegram_id or id
  UPDATE public.profiles 
  SET e4f_balance = COALESCE(e4f_balance, 0) + p_amount 
  WHERE telegram_id::text = p_user_id OR id = p_user_id;
  
  IF p_spin_amount > 0 THEN
    UPDATE public.profiles 
    SET spin_balance = COALESCE(spin_balance, 0) + p_spin_amount 
    WHERE telegram_id::text = p_user_id OR id = p_user_id;
  END IF;

  -- Also sync balances table if present
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'balances') THEN
    UPDATE public.balances 
    SET e4f = COALESCE(e4f, 0) + p_amount,
        updated_at = NOW()
    WHERE user_id = p_user_id OR user_id = 'usr_' || p_user_id;

    IF NOT FOUND THEN
      INSERT INTO public.balances (user_id, e4f, updated_at)
      VALUES (p_user_id, p_amount, NOW())
      ON CONFLICT (user_id) DO UPDATE 
      SET e4f = COALESCE(public.balances.e4f, 0) + p_amount, updated_at = NOW();
    END IF;
  END IF;
END;
$$;

-- 4. Enable RLS (Safe with full access policy)
ALTER TABLE public.user_ad_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_daily_ads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow all" ON public.user_ad_logs;
CREATE POLICY "allow all" ON public.user_ad_logs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow all" ON public.user_daily_ads;
CREATE POLICY "allow all" ON public.user_daily_ads FOR ALL USING (true) WITH CHECK (true);
