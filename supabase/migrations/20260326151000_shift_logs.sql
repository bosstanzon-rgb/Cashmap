-- Smart end-of-day shift logger (anonymous earnings logs)

create table if not exists public.shift_logs (
  id bigint generated always as identity primary key,
  date date not null,
  approx_zone text not null,
  earnings double precision,
  platforms text[] not null default '{}',
  deliveries integer,
  rating text
);

alter table public.shift_logs enable row level security;

create policy "shift logs insert anon" on public.shift_logs for insert to anon with check (true);
create policy "shift logs read anon" on public.shift_logs for select to anon using (true);

