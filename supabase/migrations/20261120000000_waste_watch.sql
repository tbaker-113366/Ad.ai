-- Waste watch: compare each audit with the previous one, track waste
-- stopped over time, and raise alerts when new waste appears.

-- Every cost a finding counted, so audits can be compared item by item.
alter table public.audit_findings
  add column waste_items jsonb not null default '[]'::jsonb;

alter table public.audits
  add column trigger              text not null default 'manual'
    check (trigger in ('connect', 'manual', 'weekly')),
  add column previous_audit_id    uuid references public.audits(id) on delete set null,
  add column resolved_count       integer,
  add column new_count            integer,
  -- Monthly cost of wasted items from the previous audit that have stopped.
  add column stopped_waste_micros bigint,
  -- Monthly cost of wasted items that weren't in the previous audit.
  add column new_waste_micros     bigint;

create type public.alert_severity as enum ('critical', 'warning', 'info');

create table public.alerts (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references public.businesses(id) on delete cascade,
  ad_account_id  uuid references public.ad_accounts(id) on delete cascade,
  type           text not null,
  severity       public.alert_severity not null default 'warning',
  message        text not null,
  -- In-app path to the screen that fixes it.
  link           text,
  audit_id       uuid references public.audits(id) on delete set null,
  emailed_at     timestamptz,
  resolved_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index alerts_open_idx on public.alerts(business_id, created_at desc) where resolved_at is null;

create trigger alerts_updated_at before update on public.alerts
  for each row execute function public.set_updated_at();

alter table public.alerts enable row level security;

-- Members read; jobs create; dismissal goes through a server action.
create policy alerts_select on public.alerts
  for select to authenticated using (public.is_member(business_id));
