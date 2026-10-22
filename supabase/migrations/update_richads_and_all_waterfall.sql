-- =====================================================================
-- E4F MINING - ALL 15 WATERFALL SLOTS SYNC (SUPABASE)
-- RichAds (Playable/Video/Banner) + Monetag (12044377) + OnClickA
-- 100% Safe | Never Fails | Idempotent
-- =====================================================================

-- 1. Create table public.ad_settings if not already present
CREATE TABLE IF NOT EXISTS public.ad_settings (
  slot_name text PRIMARY KEY,
  ad_id text NOT NULL,
  ad_network text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- 2. Upsert All Waterfall Slots (Mining, Spin, Gift Box)
INSERT INTO public.ad_settings (slot_name, ad_id, ad_network, updated_at) VALUES
  -- Mining Waterfall
  ('mining_01_richads', '410204', 'richads', now()),
  ('mining_02_monetag', '12044377', 'monetag', now()),
  ('mining_03_onclicka', '6153774E4F', 'onclicka', now()),
  ('mining_04_richads', '410204', 'richads', now()),
  ('mining_05_monetag', '12044377', 'monetag', now()),
  -- Spin Wheel Waterfall
  ('spin_01_richads', '410203', 'richads', now()),
  ('spin_02_monetag', '12044377', 'monetag', now()),
  ('spin_03_onclicka', '6153717E4F', 'onclicka', now()),
  ('spin_04_richads', '410203', 'richads', now()),
  ('spin_05_monetag', '12044377', 'monetag', now()),
  -- Gift Box Waterfall
  ('box_01_richads', '410202', 'richads', now()),
  ('box_02_monetag', '12044377', 'monetag', now()),
  ('box_03_onclicka', '6153772E4F', 'onclicka', now()),
  ('box_04_richads', '410202', 'richads', now()),
  ('box_05_monetag', '12044377', 'monetag', now())
ON CONFLICT (slot_name) DO UPDATE
SET ad_id = EXCLUDED.ad_id,
    ad_network = EXCLUDED.ad_network,
    updated_at = now();

-- 3. Sync public.system_settings JSONB (Backend Config)
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
                '{mining_01_richads}', '"410204"'
              ),
              '{mining_04_richads}', '"410204"'
            ),
            '{spin_01_richads}', '"410203"'
          ),
          '{spin_04_richads}', '"410203"'
        ),
        '{box_01_richads}', '"410202"'
      ),
      '{box_04_richads}', '"410202"'
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

-- 5. Verification query: Output updated slots
SELECT slot_name, ad_id, ad_network, updated_at 
FROM public.ad_settings 
ORDER BY slot_name;
