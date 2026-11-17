-- RLS tests for Phase 0 tables. Fails (ON_ERROR_STOP) on the first broken assertion.
\set ON_ERROR_STOP on

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@example.com');

create or replace function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(cond, false) then raise exception 'ASSERTION FAILED: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;

-- Alice signs up and creates a business.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select public.create_business('Alice Plumbing', 'https://alice.example', 'plumbing') as alice_biz \gset
select pg_temp.assert((select count(*) from businesses) = 1, 'alice sees her business');
select pg_temp.assert((select role from members where user_id = auth.uid()) = 'owner', 'alice is owner');
select pg_temp.assert((select count(*) from business_profiles) = 1, 'profile created with business');
select pg_temp.assert((select business_id from businesses) = :'alice_biz', 'businesses.business_id mirrors id');

-- Second business for the same login is refused (one business per login in v1).
do $$ begin
  perform public.create_business('Second');
  raise exception 'ASSERTION FAILED: second business allowed';
exception when unique_violation then raise notice 'ok - second business refused';
end $$;

-- Alice can edit her profile.
update business_profiles set offering = 'Emergency plumbing', monthly_budget_micros = 1500000000;
select pg_temp.assert((select offering from business_profiles) = 'Emergency plumbing', 'owner can update profile');

-- Direct insert into businesses is blocked (must use RPC).
do $$ begin
  insert into businesses (name) values ('sneaky');
  raise exception 'ASSERTION FAILED: direct business insert allowed';
exception when insufficient_privilege then raise notice 'ok - direct business insert blocked';
end $$;

-- Bob creates his own business and cannot see Alice's data.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select public.create_business('Bob Bakery') as bob_biz \gset
select pg_temp.assert((select count(*) from businesses) = 1, 'bob sees only his business');
select pg_temp.assert((select count(*) from business_profiles) = 1, 'bob sees only his profile');
select pg_temp.assert((select count(*) from members) = 1, 'bob sees only his membership');

-- Bob cannot modify Alice's profile (update silently matches 0 rows under RLS).
update business_profiles set offering = 'hacked' where business_id = :'alice_biz';
-- Bob cannot add himself to Alice's business.
select set_config('test.alice_biz', :'alice_biz', false);
do $$ begin
  insert into members (business_id, user_id, role)
  values (current_setting('test.alice_biz')::uuid, '00000000-0000-0000-0000-00000000000b', 'owner');
  raise exception 'ASSERTION FAILED: bob joined alice''s business';
exception when insufficient_privilege then raise notice 'ok - bob cannot join alice''s business';
end $$;

-- Users cannot write job_runs directly.
do $$ begin
  insert into job_runs (business_id, job_name) values (current_setting('test.alice_biz')::uuid, 'x');
  raise exception 'ASSERTION FAILED: user wrote job_runs';
exception when insufficient_privilege then raise notice 'ok - users cannot write job_runs';
end $$;

-- Anonymous users see nothing.
reset request.jwt.claim.sub;
set role anon;
select pg_temp.assert((select count(*) from businesses) = 0, 'anon sees no businesses');

-- Service role (server jobs) logs a job run for Alice.
set role service_role;
select pg_temp.assert((select offering from business_profiles where business_id = :'alice_biz') = 'Emergency plumbing', 'bob''s update did not touch alice''s profile');
insert into job_runs (business_id, job_name, status, finished_at)
values (:'alice_biz', 'system.healthcheck', 'succeeded', now());

-- job_runs cannot be deleted, even by the service role.
do $$ begin
  delete from job_runs;
  raise exception 'ASSERTION FAILED: job_runs deleted';
exception when raise_exception then
  if sqlerrm like 'ASSERTION FAILED%' then raise; end if;
  raise notice 'ok - job_runs cannot be deleted';
end $$;

-- Alice sees her job run; Bob doesn't.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select pg_temp.assert((select count(*) from job_runs) = 1, 'alice sees her job run');
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select pg_temp.assert((select count(*) from job_runs) = 0, 'bob does not see alice''s job run');

reset role;
\echo 'ALL RLS TESTS PASSED'
