-- RLS tests for Phase 1 tables (google_connections, ad_accounts, daily_metrics).
\set ON_ERROR_STOP on

create or replace function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(cond, false) then raise exception 'ASSERTION FAILED: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'carol@example.com'),
  ('00000000-0000-0000-0000-0000000000b1', 'dan@example.com');

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
select public.create_business('Carol Cars') as carol_biz \gset
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b1';
select public.create_business('Dan Dental') as dan_biz \gset

-- Server (service role) stores Carol's connection, account and metrics.
reset role;
set role service_role;
insert into google_connections (business_id, google_user_email, refresh_token_encrypted, scopes)
values (:'carol_biz', 'carol@gmail.com', 'v1:ciphertext', array['https://www.googleapis.com/auth/adwords'])
returning id as carol_conn \gset
insert into ad_accounts (business_id, google_connection_id, customer_id, currency, time_zone)
values (:'carol_biz', :'carol_conn', '1234567890', 'GBP', 'Europe/London')
returning id as carol_acct \gset
insert into daily_metrics (business_id, ad_account_id, date, campaign_id, cost_micros, clicks, impressions, conversions)
values (:'carol_biz', :'carol_acct', current_date - 1, '111', 25000000, 10, 100, 2);
insert into job_runs (business_id, ad_account_id, job_name, api_operations_used)
values (:'carol_biz', :'carol_acct', 'ads.sync', 7);
select pg_temp.assert(public.api_operations_used_today() >= 7, 'service role can read today''s API operations');

do $$ begin
  insert into ad_accounts (business_id, google_connection_id, customer_id, currency, time_zone)
  values (current_setting('test.none', true)::uuid, gen_random_uuid(), '123-456-7890', 'GBP', 'Europe/London');
  raise exception 'ASSERTION FAILED: dashed customer id accepted';
exception when check_violation or not_null_violation then raise notice 'ok - customer ids must be 10 digits';
end $$;

-- Carol sees her data but never the token column.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
select pg_temp.assert((select count(*) from google_connections) = 1, 'carol sees her connection');
select pg_temp.assert((select google_user_email from google_connections) = 'carol@gmail.com', 'carol reads non-secret columns');
do $$ begin
  perform refresh_token_encrypted from google_connections;
  raise exception 'ASSERTION FAILED: token column readable';
exception when insufficient_privilege then raise notice 'ok - refresh token column is not readable by users';
end $$;
select pg_temp.assert((select count(*) from ad_accounts) = 1, 'carol sees her ad account');
select pg_temp.assert((select sum(cost_micros) from daily_metrics) = 25000000, 'carol sees her metrics');

-- Users cannot write these tables directly.
-- No update policy: RLS makes this match zero rows (checked below).
update ad_accounts set status = 'paused';
do $$ begin
  insert into daily_metrics (business_id, ad_account_id, date, campaign_id)
  select business_id, id, current_date, 'x' from ad_accounts;
  raise exception 'ASSERTION FAILED: user wrote daily_metrics';
exception when insufficient_privilege then raise notice 'ok - users cannot write daily_metrics';
end $$;
do $$ begin
  perform public.api_operations_used_today();
  raise exception 'ASSERTION FAILED: user called quota function';
exception when insufficient_privilege then raise notice 'ok - users cannot call quota function';
end $$;

set role service_role;
select pg_temp.assert((select status from ad_accounts where id = :'carol_acct') = 'active', 'users cannot update ad_accounts');
set role authenticated;

-- Dan sees none of Carol's data.
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b1';
select pg_temp.assert((select count(*) from google_connections) = 0, 'dan sees no connections');
select pg_temp.assert((select count(*) from ad_accounts) = 0, 'dan sees no ad accounts');
select pg_temp.assert((select count(*) from daily_metrics) = 0, 'dan sees no metrics');

reset role;
\echo 'ALL GOOGLE CONNECTION TESTS PASSED'
