-- Anonymous ride/delivery mode per brand (e.g. {"Uber":"uber_black"}), optional jsonb on each ping.
alter table public.location_pings
  add column if not exists active_service_modes jsonb not null default '{}'::jsonb;

comment on column public.location_pings.active_service_modes is
  'Maps active_platforms brand to ride tier id or mode; delivery brands typically omitted.';
