-- Supabase grants table privileges to these roles by default; mirror that so
-- RLS (not missing grants) is what the tests exercise.
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all functions in schema public to service_role;
