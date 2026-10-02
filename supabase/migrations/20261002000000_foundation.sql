-- Establish a deny-by-default API boundary before introducing domain tables.
-- Each following migration must explicitly grant only its intended API access
-- and enable RLS on exposed tables. No member or production data is seeded.
begin;

revoke create on schema public from public, anon, authenticated;

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
-- PostgreSQL's implicit PUBLIC execute grant is global; a schema-local revoke
-- cannot remove it. Also undo Supabase's explicit public-schema API defaults.
alter default privileges for role postgres
  revoke execute on functions from public;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;

commit;
