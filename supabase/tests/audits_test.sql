-- RLS tests for Phase 2 tables (audits, audit_findings).
\set ON_ERROR_STOP on

create or replace function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(cond, false) then raise exception 'ASSERTION FAILED: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'erin@example.com'),
  ('00000000-0000-0000-0000-0000000000d1', 'finn@example.com');

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
select public.create_business('Erin Electrical') as erin_biz \gset
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
select public.create_business('Finn Florists') as finn_biz \gset

reset role;
set role service_role;
insert into google_connections (business_id, google_user_email, refresh_token_encrypted)
values (:'erin_biz', 'erin@gmail.com', 'ct') returning id as conn \gset
insert into ad_accounts (business_id, google_connection_id, customer_id, currency, time_zone)
values (:'erin_biz', :'conn', '5555555555', 'GBP', 'Europe/London') returning id as acct \gset
insert into audits (business_id, ad_account_id, status, score, est_monthly_waste_micros)
values (:'erin_biz', :'acct', 'succeeded', 62, 412000000) returning id as audit \gset
insert into audit_findings (business_id, audit_id, check_key, severity, rank, title, explanation, fix)
values (:'erin_biz', :'audit', 'wasted_search_terms', 'warning', 1, 't', 'e', 'f');

do $$ begin
  insert into audits (business_id, ad_account_id, score)
  select business_id, id, 101 from ad_accounts limit 1;
  raise exception 'ASSERTION FAILED: score 101 accepted';
exception when check_violation then raise notice 'ok - score must be 0-100';
end $$;

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
select pg_temp.assert((select score from audits) = 62, 'erin sees her audit');
select pg_temp.assert((select count(*) from audit_findings) = 1, 'erin sees her findings');
do $$ begin
  insert into audit_findings (business_id, audit_id, check_key, severity, rank, title, explanation, fix)
  select business_id, id, 'fake', 'critical', 2, 't', 'e', 'f' from audits;
  raise exception 'ASSERTION FAILED: user wrote findings';
exception when insufficient_privilege then raise notice 'ok - users cannot write findings';
end $$;

set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
select pg_temp.assert((select count(*) from audits) = 0, 'finn sees no audits');
select pg_temp.assert((select count(*) from audit_findings) = 0, 'finn sees no findings');

reset role;
\echo 'ALL AUDIT TESTS PASSED'

-- Waste watch additions
set role service_role;
insert into alerts (business_id, ad_account_id, type, message)
values (:'erin_biz', :'acct', 'new_waste', 'New waste found');
do $$ begin
  insert into audits (business_id, ad_account_id, trigger)
  select business_id, id, 'hourly' from ad_accounts limit 1;
  raise exception 'ASSERTION FAILED: bad trigger accepted';
exception when check_violation then raise notice 'ok - audit trigger is constrained';
end $$;

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
select pg_temp.assert((select count(*) from alerts) = 1, 'erin sees her alert');
update alerts set resolved_at = now();
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
select pg_temp.assert((select count(*) from alerts) = 0, 'finn sees no alerts');

set role service_role;
select pg_temp.assert((select resolved_at is null from alerts limit 1), 'users cannot resolve alerts directly');
reset role;
\echo 'ALL WASTE WATCH TESTS PASSED'
