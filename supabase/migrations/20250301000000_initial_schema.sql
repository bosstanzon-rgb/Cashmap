-- Baseline schema (mirrors supabase/schema.sql). New environments: run via `supabase db reset` or hosted `db push`.
create table if not exists public.drivers (
  id text primary key,
  nickname text not null,
  platforms text[] not null default '{}',
  last_seen timestamptz not null default now()
);

alter table public.drivers enable row level security;
create policy "drivers insert anon" on public.drivers for insert to anon with check (true);
create policy "drivers update anon" on public.drivers for update to anon using (true) with check (true);
create policy "drivers read anon" on public.drivers for select to anon using (true);

create table if not exists public.location_pings (
  id bigint generated always as identity primary key,
  lat double precision not null,
  lng double precision not null,
  timestamp timestamptz not null default now(),
  active_platforms text[] not null default '{}',
  active_service_modes jsonb not null default '{}'::jsonb
);
alter table public.location_pings enable row level security;
create policy "location pings insert anon" on public.location_pings for insert to anon with check (true);
create policy "location pings read anon" on public.location_pings for select to anon using (true);

create table if not exists public.mileage_logs (
  id bigint generated always as identity primary key,
  km double precision not null check (km >= 0),
  date date,
  km_added double precision,
  approx_zone text,
  timestamp timestamptz not null default now(),
  active_platforms text[] not null default '{}',
  lat double precision,
  lng double precision
);
alter table public.mileage_logs enable row level security;
create policy "mileage logs insert anon" on public.mileage_logs for insert to anon with check (true);
create policy "mileage logs read anon" on public.mileage_logs for select to anon using (true);

create table if not exists public.shift_summaries (
  id bigint generated always as identity primary key,
  timestamp timestamptz not null default now(),
  approx_zone text not null,
  earnings double precision,
  platforms text[],
  deliveries integer,
  rating text,
  user_id_hash text not null
);
alter table public.shift_summaries enable row level security;
create policy "shift summaries insert anon" on public.shift_summaries for insert to anon with check (true);
create policy "shift summaries read anon" on public.shift_summaries for select to anon using (true);
