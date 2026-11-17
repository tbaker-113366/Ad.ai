-- Fake-click protection, stage 1 (detect and show).
-- A snippet on the business's website reports each paid ad click; Adiro
-- scores it and stores the result. IPs are kept 90 days (fraud prevention),
-- then deleted by purge_click_events().

create table public.tracking_sites (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses(id) on delete cascade,
  -- Public identifier used in the snippet (not a secret).
  site_key      text not null unique default encode(gen_random_bytes(12), 'hex'),
  domain        text,
  last_seen_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (business_id)
);

create trigger tracking_sites_updated_at before update on public.tracking_sites
  for each row execute function public.set_updated_at();

create table public.click_events (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses(id) on delete cascade,
  site_id         uuid not null references public.tracking_sites(id) on delete cascade,
  -- Google click identifiers (one of these marks a paid click).
  gclid           text,
  gbraid          text,
  wbraid          text,
  ip              inet,
  country         text,
  region          text,
  city            text,
  user_agent      text,
  -- Hash of browser/device traits, to spot one device behind changing IPs.
  device_hash     text,
  device          text check (device in ('mobile', 'desktop', 'tablet', 'bot', 'unknown')),
  timezone        text,
  page_path       text,
  signals         jsonb not null default '{}'::jsonb,
  dwell_ms        integer,
  interacted      boolean not null default false,
  score           integer not null default 0 check (score between 0 and 100),
  reasons         text[] not null default '{}',
  suspicious      boolean not null default false,
  clicked_at      timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index click_events_business_time_idx on public.click_events(business_id, clicked_at desc);
create index click_events_ip_idx on public.click_events(business_id, ip, clicked_at desc);
create index click_events_device_idx on public.click_events(business_id, device_hash, clicked_at desc);

create trigger click_events_updated_at before update on public.click_events
  for each row execute function public.set_updated_at();

alter table public.tracking_sites enable row level security;
alter table public.click_events   enable row level security;

-- Members read; the snippet's ingest endpoint writes with the service role.
create policy tracking_sites_select on public.tracking_sites
  for select to authenticated using (public.is_member(business_id));
create policy click_events_select on public.click_events
  for select to authenticated using (public.is_member(business_id));

-- Owners/admins can create their site key from the app.
create policy tracking_sites_insert on public.tracking_sites
  for insert to authenticated
  with check (public.has_role(business_id, array['owner', 'admin']::public.member_role[]));

-- Delete click data older than p_days (default 90).
create or replace function public.purge_click_events(p_days integer default 90)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v integer;
begin
  delete from public.click_events where clicked_at < now() - make_interval(days => p_days);
  get diagnostics v = row_count;
  return v;
end;
$$;

revoke all on function public.purge_click_events(integer) from public, anon, authenticated;
