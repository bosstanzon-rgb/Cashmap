-- Launch giveaway: first 500 redemptions of LAUNCH500 → Lifetime Pro (app sets local flags after RPC ok).

create table if not exists public.giveaway_redemptions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  redeemed_count integer not null default 0,
  max_redemptions integer not null default 500
);

insert into public.giveaway_redemptions (code, redeemed_count, max_redemptions)
values ('LAUNCH500', 0, 500)
on conflict (code) do nothing;

alter table public.giveaway_redemptions enable row level security;

-- No direct table access for clients; RPC uses SECURITY DEFINER.
create policy "giveaway_redemptions_no_direct_access"
  on public.giveaway_redemptions
  for all
  using (false)
  with check (false);

create or replace function public.redeem_giveaway_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.giveaway_redemptions%rowtype;
  normalized text;
begin
  normalized := upper(trim(p_code));
  if normalized is null or normalized = '' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_code');
  end if;

  update public.giveaway_redemptions
  set redeemed_count = redeemed_count + 1
  where upper(code) = normalized
    and redeemed_count < max_redemptions
  returning * into r;

  if not found then
    if exists (select 1 from public.giveaway_redemptions where upper(code) = normalized) then
      return jsonb_build_object('ok', false, 'reason', 'sold_out');
    end if;
    return jsonb_build_object('ok', false, 'reason', 'invalid_code');
  end if;

  return jsonb_build_object('ok', true, 'redeemed_count', r.redeemed_count);
end;
$$;

grant execute on function public.redeem_giveaway_code(text) to anon, authenticated;
