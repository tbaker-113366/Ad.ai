-- Design refresh: values the new audit report shows, the new onboarding
-- answers, and timestamps for deleting data 30 days after a disconnect.

alter table public.audits
  add column searches_checked integer,
  add column campaigns_checked integer,
  add column score_if_fixed integer check (score_if_fixed is null or score_if_fixed between 0 and 100),
  add column whats_working text;

alter table public.business_profiles
  add column who_runs_ads text check (who_runs_ads in ('self', 'agency', 'both')),
  add column lead_types text[] not null default '{}',
  add column spend_band text check (spend_band in ('under_500', '500_1500', '1500_5000', 'over_5000')),
  -- What a new customer is worth (micros). The audit's target cost per lead
  -- is derived from it when no explicit target is set.
  add column customer_value_micros bigint check (customer_value_micros is null or customer_value_micros > 0),
  add column base_location text,
  add column travel_radius_miles integer check (travel_radius_miles is null or travel_radius_miles between 0 and 500),
  -- Onboarding progress: the furthest step completed (1-4).
  add column onboarding_step integer not null default 0;

alter table public.ad_accounts add column disconnected_at timestamptz;
alter table public.google_connections add column disconnected_at timestamptz;

-- Delete data 30 days after a disconnect (promised in the app and policy).
-- Removing an ad account cascades to its metrics, audits, findings and
-- alerts; job_runs keep their audit trail with ad_account_id set to null.
create or replace function public.purge_disconnected(p_days integer default 30)
returns table (connections_deleted integer, accounts_deleted integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cutoff timestamptz := now() - make_interval(days => p_days);
  v_accounts integer;
  v_connections integer;
begin
  delete from public.ad_accounts
  where status = 'disconnected' and disconnected_at is not null and disconnected_at < v_cutoff;
  get diagnostics v_accounts = row_count;

  delete from public.google_connections
  where status = 'disconnected' and disconnected_at is not null and disconnected_at < v_cutoff;
  get diagnostics v_connections = row_count;

  return query select v_connections, v_accounts;
end;
$$;

revoke all on function public.purge_disconnected(integer) from public, anon, authenticated;
