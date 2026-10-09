-- 002_profiles.sql
-- One profile per Supabase Auth user, created automatically by a trigger on auth.users.
--
-- Role source of truth: auth.users.raw_app_meta_data ->> 'role' (Supabase `app_metadata`).
-- Only the service role / SQL editor can write app_metadata, and it is embedded in the JWT the
-- frontend reads. profiles.role mirrors it so SQL (RLS, joins, reports) can use it too.
-- Never derive roles from raw_user_meta_data: users can edit that themselves.

begin;

create table public.profiles (
    id           uuid primary key references auth.users (id) on delete cascade,
    email        text,
    display_name text,
    avatar_url   text,
    role         text not null default 'user',
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now(),

    constraint profiles_role_check
        check (role in ('user', 'admin')),
    constraint profiles_email_format_check
        check (email is null or email ~ '^[^@[:space:]]+@[^@[:space:]]+$'),
    constraint profiles_display_name_length_check
        check (display_name is null or char_length(btrim(display_name)) between 1 and 100),
    constraint profiles_avatar_url_check
        check (avatar_url is null or (avatar_url ~* '^https://' and char_length(avatar_url) <= 2048))
);

comment on table public.profiles is 'Public profile for each auth.users row. Created by private.handle_new_user().';
comment on column public.profiles.role is 'Mirror of auth.users app_metadata.role. Change it there, not here.';

-- Not unique: Supabase can hold an SSO identity and a password identity with the same email.
create index profiles_email_idx on public.profiles (email);

create trigger profiles_set_updated_at
    before update on public.profiles
    for each row execute function private.set_updated_at();

-- Maps app_metadata.role to an allowed role; anything unexpected becomes 'user'.
create or replace function private.role_from_app_metadata(app_metadata jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
    select case when app_metadata ->> 'role' = 'admin' then 'admin' else 'user' end;
$$;

-- Cosmetic display name from signup metadata; NULL when absent or blank.
create or replace function private.display_name_from_user_metadata(user_metadata jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
    select nullif(
        left(btrim(coalesce(user_metadata ->> 'full_name', user_metadata ->> 'display_name', '')), 100),
        ''
    );
$$;

-- Creates the profile for a new auth user. SECURITY DEFINER because the Auth service
-- (supabase_auth_admin) inserts into auth.users and has no rights on public.profiles.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.profiles (id, email, display_name, role)
    values (
        new.id,
        new.email,
        private.display_name_from_user_metadata(new.raw_user_meta_data),
        private.role_from_app_metadata(new.raw_app_meta_data)
    )
    on conflict (id) do nothing;
    return new;
end;
$$;

-- Keeps email, role and (when the user changes it in Auth) display name in sync.
create or replace function private.sync_profile_from_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    old_name text := private.display_name_from_user_metadata(old.raw_user_meta_data);
    new_name text := private.display_name_from_user_metadata(new.raw_user_meta_data);
begin
    insert into public.profiles (id, email, display_name, role)
    values (new.id, new.email, new_name, private.role_from_app_metadata(new.raw_app_meta_data))
    on conflict (id) do update
        set email = excluded.email,
            role = excluded.role,
            display_name = case
                when new_name is distinct from old_name then excluded.display_name
                else public.profiles.display_name
            end;
    return new;
end;
$$;

revoke all on function private.role_from_app_metadata(jsonb) from public, anon, authenticated;
revoke all on function private.display_name_from_user_metadata(jsonb) from public, anon, authenticated;
revoke all on function private.handle_new_user() from public, anon, authenticated;
revoke all on function private.sync_profile_from_auth_user() from public, anon, authenticated;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function private.handle_new_user();

create trigger on_auth_user_updated
    after update of email, raw_app_meta_data, raw_user_meta_data on auth.users
    for each row
    when (
        old.email is distinct from new.email
        or old.raw_app_meta_data is distinct from new.raw_app_meta_data
        or old.raw_user_meta_data is distinct from new.raw_user_meta_data
    )
    execute function private.sync_profile_from_auth_user();

-- Backfill profiles for users who signed up before this migration (e.g. Layer 2 testing).
insert into public.profiles (id, email, display_name, role)
select
    u.id,
    u.email,
    private.display_name_from_user_metadata(u.raw_user_meta_data),
    private.role_from_app_metadata(u.raw_app_meta_data)
from auth.users u
on conflict (id) do nothing;

commit;
