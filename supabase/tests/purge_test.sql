-- Data is deleted 30 days after a disconnect, not before.
\set ON_ERROR_STOP on

create or replace function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(cond, false) then raise exception 'ASSERTION FAILED: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000e1', 'gail@example.com');
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
select public.create_business('Gail Gardens') as biz \gset
reset role;
set role service_role;

insert into google_connections (business_id, google_user_email, refresh_token_encrypted, status, disconnected_at)
values (:'biz', 'old@gmail.com', 'x', 'disconnected', now() - interval '31 days') returning id as old_conn \gset
insert into google_connections (business_id, google_user_email, refresh_token_encrypted, status, disconnected_at)
values (:'biz', 'recent@gmail.com', 'x', 'disconnected', now() - interval '5 days') returning id as recent_conn \gset
insert into google_connections (business_id, google_user_email, refresh_token_encrypted)
values (:'biz', 'live@gmail.com', 'x') returning id as live_conn \gset

insert into ad_accounts (business_id, google_connection_id, customer_id, currency, time_zone, status, disconnected_at)
values (:'biz', :'live_conn', '1000000001', 'GBP', 'Europe/London', 'disconnected', now() - interval '40 days') returning id as removed_acct \gset
insert into ad_accounts (business_id, google_connection_id, customer_id, currency, time_zone)
values (:'biz', :'live_conn', '1000000002', 'GBP', 'Europe/London') returning id as live_acct \gset
insert into audits (business_id, ad_account_id, status) values (:'biz', :'removed_acct', 'succeeded');
insert into job_runs (business_id, ad_account_id, job_name) values (:'biz', :'removed_acct', 'audit.run');

do $$ begin
  set local role authenticated;
  perform public.purge_disconnected();
  raise exception 'ASSERTION FAILED: users can purge';
exception when insufficient_privilege then raise notice 'ok - users cannot run the purge';
end $$;

select * from public.purge_disconnected();
select pg_temp.assert((select count(*) from google_connections where business_id = :'biz') = 2, 'old disconnected login deleted, recent and live kept');
select pg_temp.assert(not exists (select 1 from ad_accounts where id = :'removed_acct'), 'account removed 40 days ago deleted');
select pg_temp.assert(exists (select 1 from ad_accounts where id = :'live_acct'), 'live account kept');
select pg_temp.assert((select count(*) from audits where business_id = :'biz') = 0, 'its audits went with it');
select pg_temp.assert((select count(*) from job_runs where business_id = :'biz' and ad_account_id is null) = 1, 'job run audit trail kept');
reset role;
\echo 'ALL PURGE TESTS PASSED'
