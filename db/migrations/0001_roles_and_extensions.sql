-- 0001 — roles, extensions, schemas
-- Role model mirrors Supabase (anon / authenticated / service_role) so these migrations run
-- unchanged on Supabase Postgres, a plain managed Postgres (Neon, RDS, Cloud SQL) or locally.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;

create extension if not exists citext;
create extension if not exists pgcrypto;

-- `faceoff` holds product data; it is NOT exposed through Supabase's auto-generated REST API
-- (which only serves `public` by default). All access goes through the FaceOff API.
create schema if not exists faceoff;
-- `app` holds request-context helpers used by RLS policies.
create schema if not exists app;

grant usage on schema faceoff to anon, authenticated, service_role;
grant usage on schema app to anon, authenticated, service_role;

-- Request context. The API sets these with SET LOCAL inside each transaction, so they can never
-- leak between pooled connections.
create or replace function app.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('app.user_id', true), '')::uuid $$;
