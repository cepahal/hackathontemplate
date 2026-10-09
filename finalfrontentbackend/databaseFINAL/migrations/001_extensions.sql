-- 001_extensions.sql
-- Extensions, the non-exposed `private` schema, and shared trigger helpers.
-- Run first, once, in the Supabase SQL Editor (as the default `postgres` role).

begin;

-- Supabase already ships pgcrypto in the `extensions` schema; this is a no-op there.
-- gen_random_uuid() used for primary keys is built into PostgreSQL 13+.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- Functions here are NOT exposed through the Supabase Data API (only `public` is),
-- so clients cannot call trigger/definer helpers via RPC.
create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon, authenticated;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;

commit;
