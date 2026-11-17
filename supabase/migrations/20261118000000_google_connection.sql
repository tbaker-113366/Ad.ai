-- Phase 1: Google connection
-- google_connections, ad_accounts, daily_metrics + RLS, quota helper.

-- revoked: Google access lost (user must reconnect). disconnected: user chose to disconnect.
create type public.connection_status as enum ('active', 'revoked', 'disconnected', 'error');
create type public.ad_account_status as enum ('active', 'disconnected', 'paused');
create type public.discovery_status as enum ('pending', 'ready', 'failed');

-- ---------------------------------------------------------------------------
-- google_connections: one per Google login that authorised Google Ads access.
-- refresh_token_encrypted is AES-256-GCM ciphertext produced by the app
-- (src/lib/crypto/tokens.ts). It is never exposed to the browser: the
-- authenticated role has no SELECT grant on that column.
-- ---------------------------------------------------------------------------

create table public.google_connections (
  id                       uuid primary key default gen_random_uuid(),
  business_id              uuid not null references public.businesses(id) on delete cascade,
  connected_by             uuid references auth.users(id) on delete set null,
  google_user_email        text not null,
  refresh_token_encrypted  text not null,
  scopes                   text[] not null default '{}',
  status                   public.connection_status not null default 'active',
  status_reason            text,
  -- Accounts this login can reach, filled by the discovery job for the picker.
  discovery_status         public.discovery_status not null default 'pending',
  discovered_accounts      jsonb not null default '[]'::jsonb,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (business_id, google_user_email)
);

create trigger google_connections_updated_at before update on public.google_connections
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- ad_accounts: Google Ads customers the business chose to connect.
-- ---------------------------------------------------------------------------

create table public.ad_accounts (
  id                    uuid primary key default gen_random_uuid(),
  business_id           uuid not null references public.businesses(id) on delete cascade,
  google_connection_id  uuid not null references public.google_connections(id) on delete cascade,
  customer_id           text not null check (customer_id ~ '^[0-9]{10}$'),
  login_customer_id     text check (login_customer_id is null or login_customer_id ~ '^[0-9]{10}$'),
  descriptive_name      text,
  currency              text not null check (char_length(currency) = 3),
  time_zone             text not null,
  is_test_account       boolean not null default false,
  status                public.ad_account_status not null default 'active',
  last_synced_at        timestamptz,
  initial_sync_done     boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (business_id, customer_id)
);

create index ad_accounts_connection_idx on public.ad_accounts(google_connection_id);

create trigger ad_accounts_updated_at before update on public.ad_accounts
  for each row execute function public.set_updated_at();

alter table public.job_runs
  add constraint job_runs_ad_account_fk
  foreign key (ad_account_id) references public.ad_accounts(id) on delete set null;

-- ---------------------------------------------------------------------------
-- daily_metrics: cached per-campaign daily reporting. The dashboard reads
-- this, never the Google Ads API.
-- ---------------------------------------------------------------------------

create table public.daily_metrics (
  id                    uuid primary key default gen_random_uuid(),
  business_id           uuid not null references public.businesses(id) on delete cascade,
  ad_account_id         uuid not null references public.ad_accounts(id) on delete cascade,
  date                  date not null,
  campaign_id           text not null,
  campaign_name         text,
  campaign_type         text,
  cost_micros           bigint not null default 0 check (cost_micros >= 0),
  clicks                bigint not null default 0 check (clicks >= 0),
  impressions           bigint not null default 0 check (impressions >= 0),
  conversions           numeric(14, 4) not null default 0,
  conv_value_micros     bigint not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (ad_account_id, date, campaign_id)
);

create index daily_metrics_account_date_idx on public.daily_metrics(ad_account_id, date desc);

create trigger daily_metrics_updated_at before update on public.daily_metrics
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Quota: Google Ads API operations used today (UTC) across the whole app.
-- Access-level limits apply per developer token / Cloud project, not per
-- customer, so this is deliberately global. Service role only.
-- ---------------------------------------------------------------------------

create or replace function public.api_operations_used_today()
returns bigint
language sql
stable
as $$
  select coalesce(sum(api_operations_used), 0)::bigint
  from public.job_runs
  where started_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';
$$;

revoke all on function public.api_operations_used_today() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.google_connections enable row level security;
alter table public.ad_accounts        enable row level security;
alter table public.daily_metrics      enable row level security;

-- google_connections: members read (minus the token column, see grants
-- below). All writes go through server code using the service role.
create policy google_connections_select on public.google_connections
  for select to authenticated using (public.is_member(business_id));

-- ad_accounts: members read. Connect / disconnect run server-side after a
-- role check, using the service role.
create policy ad_accounts_select on public.ad_accounts
  for select to authenticated using (public.is_member(business_id));

-- daily_metrics: members read; jobs write.
create policy daily_metrics_select on public.daily_metrics
  for select to authenticated using (public.is_member(business_id));

-- Column-level protection for the encrypted token: even with RLS allowing
-- the row, the browser-facing roles cannot read refresh_token_encrypted.
revoke all on public.google_connections from anon, authenticated;
grant select (
  id, business_id, connected_by, google_user_email, scopes, status, status_reason,
  discovery_status, discovered_accounts, created_at, updated_at
) on public.google_connections to authenticated;
