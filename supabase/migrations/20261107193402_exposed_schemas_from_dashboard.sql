-- Exposed schemas are managed in Dashboard → Project Settings → Data API
-- (public, graphql_public, encore, winenote). Drop the role-level override set earlier.
alter role authenticator reset pgrst.db_schemas;
notify pgrst, 'reload config';
notify pgrst, 'reload schema';
