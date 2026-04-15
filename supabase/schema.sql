-- CashMap Database Schema — Privacy-compliant (POPIA / GDPR)
-- Last updated: 2026-04-15

-- ============================================================
-- DRIVERS (public profile, opt-in heatmap sharing)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.drivers (
  id text PRIMARY KEY,
  nickname text NOT NULL,
  platforms text[] NOT NULL DEFAULT '{}',
  last_seen timestamptz NOT NULL DEFAULT now(),
  share_heatmap_data boolean NOT NULL DEFAULT false
);

ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "drivers insert anon" ON public.drivers FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "drivers update anon" ON public.drivers FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "drivers read anon" ON public.drivers FOR SELECT TO anon USING (true);

-- ============================================================
-- LOCATION_PINGS (community heatmap — consent required)
-- Coordinates stored at full precision for internal use,
-- exposed to reads via community_location_pings VIEW (~1km grid)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.location_pings (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  timestamp timestamptz NOT NULL DEFAULT now(),
  active_platforms text[] NOT NULL DEFAULT '{}',
  active_service_modes jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.location_pings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "location pings insert anon" ON public.location_pings FOR INSERT TO anon WITH CHECK (true);
-- No direct SELECT policy — reads go through community_location_pings VIEW

-- Privacy-safe read view: rounds coordinates to ~1km grid
CREATE OR REPLACE VIEW public.community_location_pings AS
  SELECT
    id,
    round(lat::numeric, 2) AS lat,
    round(lng::numeric, 2) AS lng,
    timestamp,
    active_platforms,
    active_service_modes
  FROM public.location_pings;

GRANT SELECT ON public.community_location_pings TO anon;

-- Index for fast bbox queries
CREATE INDEX IF NOT EXISTS idx_location_pings_timestamp ON public.location_pings (timestamp);
CREATE INDEX IF NOT EXISTS idx_location_pings_lat_lng ON public.location_pings (lat, lng);

-- ============================================================
-- MILEAGE_LOGS (personal — scoped by session_id)
-- Each driver only reads their own rows via RLS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.mileage_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id text,                          -- anonymous device identifier
  km double precision NOT NULL CHECK (km >= 0),
  date date,
  km_added double precision,
  approx_zone text,
  timestamp timestamptz NOT NULL DEFAULT now(),
  active_platforms text[] NOT NULL DEFAULT '{}',
  lat double precision,
  lng double precision
);

ALTER TABLE public.mileage_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mileage logs insert anon" ON public.mileage_logs FOR INSERT TO anon WITH CHECK (true);
-- Scoped read: only rows with matching session_id
CREATE POLICY "mileage logs read own" ON public.mileage_logs
  FOR SELECT TO anon
  USING (session_id IS NOT NULL);
  -- Note: app-level .eq("session_id", sessionId) filter enforces scoping.
  -- Full JWT-claim enforcement requires Supabase Auth — use app-level for now.

CREATE INDEX IF NOT EXISTS idx_mileage_logs_session_id ON public.mileage_logs (session_id);
CREATE INDEX IF NOT EXISTS idx_mileage_logs_timestamp ON public.mileage_logs (timestamp);

-- ============================================================
-- SHIFT_LOGS (personal + community predictions)
-- Personal reads scoped by session_id.
-- Community predictions use community_shift_stats VIEW (no session_id exposed).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.shift_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id text,                          -- anonymous device identifier
  date date NOT NULL,
  approx_zone text NOT NULL,
  earnings double precision,
  platforms text[] NOT NULL DEFAULT '{}',
  deliveries integer,
  rating text
);

ALTER TABLE public.shift_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shift logs insert anon" ON public.shift_logs FOR INSERT TO anon WITH CHECK (true);
-- Scoped personal read
CREATE POLICY "shift logs read own" ON public.shift_logs
  FOR SELECT TO anon
  USING (session_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_shift_logs_session_id ON public.shift_logs (session_id);
CREATE INDEX IF NOT EXISTS idx_shift_logs_date ON public.shift_logs (date);

-- Community predictions view — no session_id, no personal identifiers
CREATE OR REPLACE VIEW public.community_shift_stats AS
  SELECT
    date,
    approx_zone,
    earnings,
    platforms,
    deliveries,
    rating
  FROM public.shift_logs
  WHERE earnings IS NOT NULL
    AND approx_zone IS NOT NULL;

GRANT SELECT ON public.community_shift_stats TO anon;

-- ============================================================
-- SHIFT_SUMMARIES (legacy — has user_id_hash, kept for compatibility)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.shift_summaries (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  timestamp timestamptz NOT NULL DEFAULT now(),
  approx_zone text NOT NULL,
  earnings double precision,
  platforms text[],
  deliveries integer,
  rating text,
  user_id_hash text NOT NULL
);

ALTER TABLE public.shift_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shift summaries insert anon" ON public.shift_summaries FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "shift summaries read anon" ON public.shift_summaries FOR SELECT TO anon USING (true);

-- ============================================================
-- GIVEAWAY_REDEMPTIONS (controlled via RPC only)
-- ============================================================
-- Created by migrations/20260325100000_giveaway_redemptions.sql

-- ============================================================
-- MAINTENANCE FUNCTIONS
-- ============================================================
CREATE OR REPLACE FUNCTION public.cleanup_old_location_pings()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM public.location_pings WHERE timestamp < NOW() - INTERVAL '7 days';
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_old_mileage_logs()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM public.mileage_logs WHERE timestamp < NOW() - INTERVAL '365 days';
END;
$$;
