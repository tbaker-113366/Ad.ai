-- Phase 0: Foundations
-- businesses, members, business_profiles, job_runs + Row Level Security.
-- Every business-owned table carries business_id and is scoped by RLS.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create type public.member_role as enum ('owner', 'admin', 'viewer');
create type public.job_status as enum ('running', 'succeeded', 'failed');

-- ---------------------------------------------------------------------------
-- businesses
-- ---------------------------------------------------------------------------

create table public.businesses (
  id          uuid primary key default gen_random_uuid(),
  -- A business is its own tenant; business_id = id keeps the "every table has
  -- business_id" rule uniform for RLS helpers and app code.
  business_id uuid generated always as (id) stored,
  name        text not null check (char_length(name) between 1 and 200),
  website     text,
  industry    text,
  country     text not null default 'GB' check (char_length(country) = 2),
  currency    text not null default 'GBP' check (char_length(currency) = 3),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger businesses_updated_at before update on public.businesses
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- members
-- ---------------------------------------------------------------------------

create table public.members (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        public.member_role not null default 'viewer',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (business_id, user_id)
);

create index members_user_id_idx on public.members(user_id);

create trigger members_updated_at before update on public.members
  for each row execute function public.set_updated_at();

-- Membership checks. SECURITY DEFINER so policies on members can call them
-- without recursing into members' own RLS.
create or replace function public.is_member(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.members
    where business_id = p_business_id and user_id = auth.uid()
  );
$$;

create or replace function public.has_role(p_business_id uuid, p_roles public.member_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.members
    where business_id = p_business_id
      and user_id = auth.uid()
      and role = any (p_roles)
  );
$$;

-- ---------------------------------------------------------------------------
-- business_profiles
-- ---------------------------------------------------------------------------

create table public.business_profiles (
  id                     uuid primary key default gen_random_uuid(),
  business_id            uuid not null unique references public.businesses(id) on delete cascade,
  offering               text,
  locations_served       text[] not null default '{}',
  -- Money in account currency micros (1,000,000 = 1 unit).
  target_cpa_micros      bigint check (target_cpa_micros is null or target_cpa_micros > 0),
  target_roas            numeric(8, 2) check (target_roas is null or target_roas > 0),
  monthly_budget_micros  bigint check (monthly_budget_micros is null or monthly_budget_micros > 0),
  irrelevant_terms       text[] not null default '{}',
  brand_terms            text[] not null default '{}',
  tone_of_voice          text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create trigger business_profiles_updated_at before update on public.business_profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- job_runs  (audit trail + quota tracking; never deleted)
-- ---------------------------------------------------------------------------

create table public.job_runs (
  id                  uuid primary key default gen_random_uuid(),
  business_id         uuid references public.businesses(id) on delete set null,
  -- FK to ad_accounts is added in Phase 1 when that table exists.
  ad_account_id       uuid,
  job_name            text not null,
  status              public.job_status not null default 'running',
  started_at          timestamptz not null default now(),
  finished_at         timestamptz,
  api_operations_used integer not null default 0 check (api_operations_used >= 0),
  -- AI usage per spec section 8: prompt version, model, token cost.
  ai_usage            jsonb not null default '[]'::jsonb,
  metadata            jsonb not null default '{}'::jsonb,
  error               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index job_runs_business_started_idx on public.job_runs(business_id, started_at desc);
create index job_runs_ad_account_started_idx on public.job_runs(ad_account_id, started_at desc);

create trigger job_runs_updated_at before update on public.job_runs
  for each row execute function public.set_updated_at();

-- job_runs is append-only for everyone except the service role, and never
-- deleted (spec section 5).
create or replace function public.prevent_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception '% rows are an audit trail and cannot be deleted', tg_table_name;
end;
$$;

create trigger job_runs_no_delete before delete on public.job_runs
  for each row execute function public.prevent_delete();

-- ---------------------------------------------------------------------------
-- Onboarding RPC: create a business, its owner membership and an empty
-- profile atomically. Avoids the RLS chicken-and-egg of inserting a business
-- you are not yet a member of.
-- ---------------------------------------------------------------------------

create or replace function public.create_business(
  p_name     text,
  p_website  text default null,
  p_industry text default null,
  p_country  text default 'GB',
  p_currency text default 'GBP'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_business_id uuid;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- v1: one business per login (spec section 2).
  if exists (select 1 from public.members where user_id = v_user) then
    raise exception 'user already belongs to a business' using errcode = '23505';
  end if;

  insert into public.businesses (name, website, industry, country, currency)
  values (p_name, p_website, p_industry, upper(p_country), upper(p_currency))
  returning id into v_business_id;

  insert into public.members (business_id, user_id, role)
  values (v_business_id, v_user, 'owner');

  insert into public.business_profiles (business_id)
  values (v_business_id);

  return v_business_id;
end;
$$;

revoke all on function public.create_business(text, text, text, text, text) from public;
grant execute on function public.create_business(text, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.businesses        enable row level security;
alter table public.members           enable row level security;
alter table public.business_profiles enable row level security;
alter table public.job_runs          enable row level security;

-- businesses: members read; owner/admin update; creation only via RPC;
-- deletion only via server-side flow (service role).
create policy businesses_select on public.businesses
  for select to authenticated using (public.is_member(id));
create policy businesses_update on public.businesses
  for update to authenticated
  using (public.has_role(id, array['owner', 'admin']::public.member_role[]))
  with check (public.has_role(id, array['owner', 'admin']::public.member_role[]));

-- members: members see co-members; only owners manage membership.
create policy members_select on public.members
  for select to authenticated using (public.is_member(business_id));
create policy members_insert on public.members
  for insert to authenticated
  with check (public.has_role(business_id, array['owner']::public.member_role[]));
create policy members_update on public.members
  for update to authenticated
  using (public.has_role(business_id, array['owner']::public.member_role[]))
  with check (public.has_role(business_id, array['owner']::public.member_role[]));
create policy members_delete on public.members
  for delete to authenticated
  using (public.has_role(business_id, array['owner']::public.member_role[]));

-- business_profiles: members read; owner/admin edit.
create policy business_profiles_select on public.business_profiles
  for select to authenticated using (public.is_member(business_id));
create policy business_profiles_update on public.business_profiles
  for update to authenticated
  using (public.has_role(business_id, array['owner', 'admin']::public.member_role[]))
  with check (public.has_role(business_id, array['owner', 'admin']::public.member_role[]));

-- job_runs: members read only. Writes come from server jobs (service role,
-- which bypasses RLS).
create policy job_runs_select on public.job_runs
  for select to authenticated using (business_id is not null and public.is_member(business_id));
