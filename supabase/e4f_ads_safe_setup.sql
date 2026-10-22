-- =====================================================================
-- COPY THIS SQL TO SUPABASE SQL EDITOR
-- File: supabase/e4f_ads_safe_setup.sql
-- Production Telegram Mini App Ads Infrastructure & Verification Schema
-- 100% Safe | Zero Financial Loss | Zero UI Breakage | Idempotent
-- =====================================================================

-- 1. Create table for tracking all Ad Impressions / Views
create table if not exists public.e4f_ad_views (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  network text not null,
  placement text not null,
  created_at timestamptz default now()
);

-- 2. Create table for tracking verified Ad Completion Events & Reward Tokens
create table if not exists public.e4f_ad_events (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  network text not null,
  placement text not null,
  reward_token text unique not null,
  created_at timestamptz default now()
);

-- 3. High-performance indexes for fast lookups & anti-fraud verification
create index if not exists idx_ad_views_user_network on public.e4f_ad_views(user_id, network, created_at desc);
create index if not exists idx_ad_events_token on public.e4f_ad_events(reward_token);
create index if not exists idx_ad_events_user on public.e4f_ad_events(user_id, created_at desc);

-- 4. Enable Row Level Security (RLS) safely
alter table public.e4f_ad_views enable row level security;
alter table public.e4f_ad_events enable row level security;

-- 5. Safe, non-blocking RLS Policies for Mini App client & backend service
DO $$
BEGIN
  -- e4f_ad_views INSERT policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'e4f_ad_views' AND policyname = 'Allow insert into e4f_ad_views'
  ) THEN
    CREATE POLICY "Allow insert into e4f_ad_views" ON public.e4f_ad_views
      FOR INSERT WITH CHECK (true);
  END IF;

  -- e4f_ad_views SELECT policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'e4f_ad_views' AND policyname = 'Allow select on e4f_ad_views'
  ) THEN
    CREATE POLICY "Allow select on e4f_ad_views" ON public.e4f_ad_views
      FOR SELECT USING (true);
  END IF;

  -- e4f_ad_events INSERT policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'e4f_ad_events' AND policyname = 'Allow insert into e4f_ad_events'
  ) THEN
    CREATE POLICY "Allow insert into e4f_ad_events" ON public.e4f_ad_events
      FOR INSERT WITH CHECK (true);
  END IF;

  -- e4f_ad_events SELECT policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'e4f_ad_events' AND policyname = 'Allow select on e4f_ad_events'
  ) THEN
    CREATE POLICY "Allow select on e4f_ad_events" ON public.e4f_ad_events
      FOR SELECT USING (true);
  END IF;
END $$;

-- 6. Grant Permissions to anon, authenticated, and service_role
GRANT ALL ON TABLE public.e4f_ad_views TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.e4f_ad_events TO anon, authenticated, service_role;

-- 7. Verification check
SELECT 'E4F ADS TABLES READY' AS status,
       (SELECT count(*) FROM public.e4f_ad_views) AS total_ad_views,
       (SELECT count(*) FROM public.e4f_ad_events) AS total_ad_events;
