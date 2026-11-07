-- Applied to the hub project (formerly "encore"). First step of merging Wine Note into it:
-- per-app schemas exposed through the Data API, and pg_net (HTTP from SQL; used for checks and
-- the one-off file copy from the old "winenote" project).
create extension if not exists pg_net with schema extensions;
create schema if not exists encore;
create schema if not exists winenote;
grant usage on schema encore, winenote to anon, authenticated, service_role;
alter role authenticator set pgrst.db_schemas = 'public, graphql_public, encore, winenote';
notify pgrst, 'reload config';
notify pgrst, 'reload schema';
