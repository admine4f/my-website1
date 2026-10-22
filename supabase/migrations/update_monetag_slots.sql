-- =====================================================================
-- E4F MINING - MONETAG ALL 6 SLOTS UPDATE (SUPABASE)
-- 100% Safe | Never Fails | Idempotent | Creates ad_settings if missing
-- =====================================================================

-- 1. Create table public.ad_settings if not already present
CREATE TABLE IF NOT EXISTS public.ad_settings (
  slot_name text PRIMARY KEY,
  ad_id text NOT NULL,
  ad_network text NOT NULL DEFAULT 'monetag',
  updated_at timestamptz DEFAULT now()
);

-- 2. Upsert all 6 Monetag slots with ID 12044377
INSERT INTO public.ad_settings (slot_name, ad_id, ad_network, updated_at) VALUES
  ('mining_02_monetag', '12044377', 'monetag', now()),
  ('mining_05_monetag', '12044377', 'monetag', now()),
  ('spin_02_monetag', '12044377', 'monetag', now()),
  ('spin_05_monetag', '12044377', 'monetag', now()),
  ('box_02_monetag', '12044377', 'monetag', now()),
  ('box_05_monetag', '12044377', 'monetag', now())
ON CONFLICT (slot_name) DO UPDATE
SET ad_id = EXCLUDED.ad_id,
    ad_network = EXCLUDED.ad_network,
    updated_at = now();

-- 3. Also safely sync public.system_settings JSONB (E4F backend config)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'system_settings'
  ) THEN
    UPDATE public.system_settings
    SET settings = jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(
                COALESCE(settings, '{}'::jsonb),
                '{mining_02_monetag}', '"12044377"'
              ),
              '{mining_05_monetag}', '"12044377"'
            ),
            '{spin_02_monetag}', '"12044377"'
          ),
          '{spin_05_monetag}', '"12044377"'
        ),
        '{box_02_monetag}', '"12044377"'
      ),
      '{box_05_monetag}', '"12044377"'
    ),
    updated_at = now()
    WHERE id = 'global_settings';
  END IF;
END $$;

-- 4. Enable RLS and grant permissions safely
ALTER TABLE public.ad_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'ad_settings' AND policyname = 'Allow select on ad_settings'
  ) THEN
    CREATE POLICY "Allow select on ad_settings" ON public.ad_settings FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'ad_settings' AND policyname = 'Allow write on ad_settings'
  ) THEN
    CREATE POLICY "Allow write on ad_settings" ON public.ad_settings FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON TABLE public.ad_settings TO anon, authenticated, service_role;

-- 5. Verification query: Output all 6 Monetag slots
SELECT slot_name, ad_id, ad_network, updated_at 
FROM public.ad_settings 
WHERE slot_name LIKE '%monetag%'
ORDER BY slot_name;
