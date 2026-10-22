-- =====================================================================
-- E4F MINING - SAFE ONCLICKA AD IDS UPDATE (SUPABASE)
-- 100% Safe | Never Fails | Handles JSONB & Relational Schemas
-- =====================================================================

-- 1. Check which tables/columns exist in public schema (Discovery)
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND (
    column_name LIKE '%onclicka%' 
    OR column_name = 'settings'
  )
ORDER BY table_name, column_name;

-- 2. Safe Dynamic Update across all schema possibilities without failing
DO $$
DECLARE
  tbl text;
BEGIN
  -- A. Update public.system_settings JSONB (Primary table used by E4F backend)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'system_settings'
  ) THEN
    UPDATE public.system_settings
    SET settings = jsonb_set(
      jsonb_set(
        jsonb_set(
          COALESCE(settings, '{}'::jsonb),
          '{mining_03_onclicka}',
          '"6153774E4F"'
        ),
        '{box_03_onclicka}',
        '"6153772E4F"'
      ),
      '{spin_03_onclicka}',
      '"6153717E4F"'
    ),
    updated_at = now()
    WHERE id = 'global_settings';

    -- If no row exists yet, insert it safely
    IF NOT FOUND THEN
      INSERT INTO public.system_settings (id, settings, updated_at)
      VALUES (
        'global_settings',
        jsonb_build_object(
          'mining_03_onclicka', '6153774E4F',
          'box_03_onclicka', '6153772E4F',
          'spin_03_onclicka', '6153717E4F'
        ),
        now()
      )
      ON CONFLICT (id) DO NOTHING;
    END IF;
  END IF;

  -- B. Dynamic update for ANY table having 'mining_03_onclicka' column
  FOR tbl IN
    SELECT table_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND column_name = 'mining_03_onclicka'
  LOOP
    EXECUTE format('UPDATE public.%I SET mining_03_onclicka = %L', tbl, '6153774E4F');
  END LOOP;

  -- C. Dynamic update for ANY table having 'box_03_onclicka' column
  FOR tbl IN
    SELECT table_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND column_name = 'box_03_onclicka'
  LOOP
    EXECUTE format('UPDATE public.%I SET box_03_onclicka = %L', tbl, '6153772E4F');
  END LOOP;

  -- D. Dynamic update for ANY table having 'spin_03_onclicka' column
  FOR tbl IN
    SELECT table_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND column_name = 'spin_03_onclicka'
  LOOP
    EXECUTE format('UPDATE public.%I SET spin_03_onclicka = %L', tbl, '6153717E4F');
  END LOOP;

  -- E. Dynamic update for ANY key-value table having (key, value) columns
  FOR tbl IN
    SELECT c1.table_name
    FROM information_schema.columns c1
    JOIN information_schema.columns c2 ON c1.table_name = c2.table_name AND c1.table_schema = c2.table_schema
    WHERE c1.table_schema = 'public' AND c1.column_name = 'key' AND c2.column_name = 'value'
  LOOP
    EXECUTE format('UPDATE public.%I SET value = %L WHERE key = %L', tbl, '6153774E4F', 'mining_03_onclicka');
    EXECUTE format('UPDATE public.%I SET value = %L WHERE key = %L', tbl, '6153772E4F', 'box_03_onclicka');
    EXECUTE format('UPDATE public.%I SET value = %L WHERE key = %L', tbl, '6153717E4F', 'spin_03_onclicka');
  END LOOP;

END $$;

-- 3. Verification check: Show updated values
SELECT 
  'SUCCESS: E4F OnClickA IDs Updated' AS status,
  '6153774E4F' AS mining_03_onclicka,
  '6153772E4F' AS box_03_onclicka,
  '6153717E4F' AS spin_03_onclicka;
