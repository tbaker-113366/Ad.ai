-- Phase 2: Audit engine
-- audits (one run) and audit_findings (one issue found) + RLS.

create type public.audit_status as enum ('queued', 'running', 'succeeded', 'failed');
create type public.finding_severity as enum ('critical', 'warning', 'opportunity');

create table public.audits (
  id                        uuid primary key default gen_random_uuid(),
  business_id               uuid not null references public.businesses(id) on delete cascade,
  ad_account_id             uuid not null references public.ad_accounts(id) on delete cascade,
  status                    public.audit_status not null default 'queued',
  -- Plain-English step shown on the progress screen ("Checking search terms…").
  progress_step             text,
  started_at                timestamptz,
  finished_at               timestamptz,
  score                     integer check (score is null or score between 0 and 100),
  est_monthly_waste_micros  bigint check (est_monthly_waste_micros is null or est_monthly_waste_micros >= 0),
  currency                  text check (currency is null or char_length(currency) = 3),
  window_from               date,
  window_to                 date,
  window_days               integer,
  total_spend_micros        bigint,
  blocks_autopilot          boolean not null default false,
  skipped_checks            text[] not null default '{}',
  error                     text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index audits_account_created_idx on public.audits(ad_account_id, created_at desc);
create index audits_business_created_idx on public.audits(business_id, created_at desc);

create trigger audits_updated_at before update on public.audits
  for each row execute function public.set_updated_at();

create table public.audit_findings (
  id                        uuid primary key default gen_random_uuid(),
  business_id               uuid not null references public.businesses(id) on delete cascade,
  audit_id                  uuid not null references public.audits(id) on delete cascade,
  check_key                 text not null,
  severity                  public.finding_severity not null,
  rank                      integer not null,
  title                     text not null,
  explanation               text not null,
  fix                       text not null,
  est_monthly_waste_micros  bigint,
  evidence                  jsonb not null default '{}'::jsonb,
  recommended_actions       jsonb not null default '[]'::jsonb,
  blocks_autopilot          boolean not null default false,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  unique (audit_id, check_key)
);

create index audit_findings_audit_idx on public.audit_findings(audit_id, rank);

create trigger audit_findings_updated_at before update on public.audit_findings
  for each row execute function public.set_updated_at();

alter table public.audits         enable row level security;
alter table public.audit_findings enable row level security;

-- Members read; audit jobs write with the service role.
create policy audits_select on public.audits
  for select to authenticated using (public.is_member(business_id));
create policy audit_findings_select on public.audit_findings
  for select to authenticated using (public.is_member(business_id));
