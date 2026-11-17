-- RLS and retention tests for fake-click protection.
\set ON_ERROR_STOP on

create or replace function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(cond, false) then raise exception 'ASSERTION FAILED: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'hana@example.com'),
  ('00000000-0000-0000-0000-0000000000f2', 'ivan@example.com');

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f1';
select public.create_business('Hana Heating') as hana \gset
insert into tracking_sites (business_id, domain) values (:'hana', 'hanaheating.co.uk');
select pg_temp.assert((select length(site_key) from tracking_sites) = 24, 'owner can create a site key');
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f2';
select public.create_business('Ivan Interiors') as ivan \gset

do $$ begin
  insert into tracking_sites (business_id, domain) values (current_setting('test.none', true)::uuid, 'x');
exception when others then null;
end $$;
select set_config('test.hana', :'hana', false);
do $$ begin
  insert into tracking_sites (business_id, domain) values (current_setting('test.hana')::uuid, 'evil.com');
  raise exception 'ASSERTION FAILED: ivan created a site for hana';
exception when insufficient_privilege then raise notice 'ok - cannot create a site for another business';
end $$;

reset role;
set role service_role;
select id as site from tracking_sites where business_id = :'hana' \gset
insert into click_events (business_id, site_id, gclid, ip, suspicious, score, clicked_at)
values (:'hana', :'site', 'g1', '203.0.113.7', true, 80, now()),
       (:'hana', :'site', 'g2', '203.0.113.8', false, 0, now() - interval '100 days');

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f1';
select pg_temp.assert((select count(*) from click_events) = 2, 'hana sees her clicks');
do $$ begin
  insert into click_events (business_id, site_id) select business_id, id from tracking_sites;
  raise exception 'ASSERTION FAILED: user wrote click events';
exception when insufficient_privilege then raise notice 'ok - users cannot write click events';
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f2';
select pg_temp.assert((select count(*) from click_events) = 0, 'ivan sees none of hana''s clicks');
select pg_temp.assert((select count(*) from tracking_sites) = 0, 'ivan sees no site keys of hana''s');

reset role;
set role service_role;
select pg_temp.assert(public.purge_click_events() = 1, 'clicks older than 90 days are purged');
select pg_temp.assert((select count(*) from click_events where business_id = :'hana') = 1, 'recent clicks kept');
reset role;
\echo 'ALL CLICK PROTECTION TESTS PASSED'
