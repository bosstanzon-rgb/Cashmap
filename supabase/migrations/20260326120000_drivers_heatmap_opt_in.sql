alter table public.drivers
  add column if not exists share_heatmap_data boolean not null default false;

comment on column public.drivers.share_heatmap_data is 'User opt-in for anonymous heatmap pings (app default off).';
