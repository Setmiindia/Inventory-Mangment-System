-- The inventory system lives in its own schema, inside the central database (setmi-central) that every Setmi system shares.
-- Central, shared things stay in public (staff_profiles, ...). Nothing in public is changed except one trigger on
-- public.staff_profiles (created in 20261024000001_foundation.sql) that gives each new staff member an inactive inventory row.
-- NOTE: the schema must also be added to Supabase Dashboard > Settings > API > "Exposed schemas" (a dashboard setting, not SQL).

create schema if not exists inventory;
create extension if not exists pg_trgm with schema extensions;

grant usage on schema inventory to authenticated, service_role;
-- Same default as Supabase gives public tables, but the anonymous (not signed-in) role gets nothing, ever.
alter default privileges in schema inventory grant all on tables to authenticated, service_role;
alter default privileges in schema inventory grant all on sequences to authenticated, service_role;
alter default privileges in schema inventory grant all on functions to authenticated, service_role;
