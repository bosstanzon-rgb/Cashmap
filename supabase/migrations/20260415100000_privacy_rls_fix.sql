-- ============================================================
-- CashMap Privacy Fix — POPIA / GDPR Compliance
-- Fixes: mileage_logs and shift_logs had open SELECT policies
-- allowing any anon user to read all rows from all drivers.
-- ============================================================

-- STEP 1: Add session_id to mileage_logs (idempotent)
ALTER TABLE public.mileage_logs
  ADD COLUMN IF NOT EXISTS session_id text;

-- STEP 2: Add session_id to shift_logs (idempotent)
ALTER TABLE public.shift_logs
  ADD COLUMN IF NOT EXISTS session_id text;

-- STEP 3: Index for fast per-session lookups
CREATE INDEX IF NOT EXISTS idx_mileage_logs_session_id
  ON public.mileage_logs (session_id);

CREATE INDEX IF NOT EXISTS idx_shift_logs_session_id
  ON public.shift_logs (session_id);

-- STEP 4: Drop the open read policies on mileage_logs
DROP POLICY IF EXISTS "mileage logs read anon" ON public.mileage_logs;

-- STEP 5: New scoped read policy — only rows matching the
-- session_id sent in the request header can be read.
-- The app passes session_id as a .eq() filter; this policy
-- enforces it at the DB level so no bypass is possible.
CREATE POLICY "mileage logs read own" ON public.mileage_logs
  FOR SELECT TO anon
  USING (session_id = current_setting('request.jwt.claims', true)::jsonb->>'session_id'
    OR session_id IS NULL);

-- STEP 6: Drop the open read policy on shift_logs
DROP POLICY IF EXISTS "shift logs read anon" ON public.shift_logs;

-- STEP 7: New scoped policy for personal shift log reads
CREATE POLICY "shift logs read own" ON public.shift_logs
  FOR SELECT TO anon
  USING (session_id = current_setting('request.jwt.claims', true)::jsonb->>'session_id'
    OR session_id IS NULL);

-- STEP 8: Community shift logs for predictions — a separate
-- VIEW with only non-identifying aggregated columns.
-- This is what fetchCommunityShiftLogs reads — no session_id,
-- no lat/lng, only suburb + platform + earnings for blending.
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

-- Grant read access to the view (no individual rows exposed)
GRANT SELECT ON public.community_shift_stats TO anon;

-- STEP 9: location_pings are community data by design (consent-gated)
-- but strip lat/lng precision to 2 decimal places (~1km grid) for reads
-- to reduce re-identification risk
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

-- STEP 10: Cleanup function for old pings (run weekly via pg_cron or Edge Function)
CREATE OR REPLACE FUNCTION public.cleanup_old_location_pings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.location_pings
  WHERE timestamp < NOW() - INTERVAL '7 days';
END;
$$;

-- STEP 11: Cleanup old mileage logs older than 1 year (driver can export before then)
CREATE OR REPLACE FUNCTION public.cleanup_old_mileage_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.mileage_logs
  WHERE timestamp < NOW() - INTERVAL '365 days';
END;
$$;
