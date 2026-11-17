-- Supabase grants table privileges to these roles by default when tables are
-- created. Mirror that (before migrations run) so RLS and any explicit
-- revokes in migrations are what the tests exercise.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
