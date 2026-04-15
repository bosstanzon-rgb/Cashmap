-- Add session_id to mileage_logs and shift_logs for user-scoped reads
ALTER TABLE public.mileage_logs ADD COLUMN IF NOT EXISTS session_id text;
ALTER TABLE public.shift_logs ADD COLUMN IF NOT EXISTS session_id text;

-- Index for fast per-session queries
CREATE INDEX IF NOT EXISTS idx_mileage_logs_session_id ON public.mileage_logs (session_id);
CREATE INDEX IF NOT EXISTS idx_shift_logs_session_id ON public.shift_logs (session_id);
CREATE INDEX IF NOT EXISTS idx_location_pings_timestamp ON public.location_pings (timestamp);

-- Auto-cleanup location_pings older than 7 days to prevent unbounded growth
-- Run via pg_cron (enable in Supabase dashboard: Database → Extensions → pg_cron)
-- SELECT cron.schedule('cleanup-old-pings', '0 3 * * *', $$
--   DELETE FROM public.location_pings WHERE timestamp < NOW() - INTERVAL '7 days';
-- $$);

-- For now, create a cleanup function you can call manually or via Edge Function
CREATE OR REPLACE FUNCTION public.cleanup_old_location_pings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.location_pings WHERE timestamp < NOW() - INTERVAL '7 days';
END;
$$;
