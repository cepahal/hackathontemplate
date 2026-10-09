-- 003_projects.sql
-- Projects are owned by exactly one profile. Deleting the owner deletes their projects.

begin;

create table public.projects (
    id          uuid primary key default gen_random_uuid(),
    owner_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
    name        text not null,
    description text not null default '',
    status      text not null default 'active',
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),

    constraint projects_name_length_check
        check (char_length(btrim(name)) between 1 and 120),
    constraint projects_description_length_check
        check (char_length(description) <= 2000),
    constraint projects_status_check
        check (status in ('active', 'paused', 'completed', 'archived'))
);

comment on table public.projects is 'User-owned projects. RLS: owner only.';
comment on column public.projects.owner_id is 'Defaults to auth.uid() so clients do not need to send it.';

-- One project name per owner (case-insensitive). Also serves lookups by owner_id.
create unique index projects_owner_id_name_key on public.projects (owner_id, lower(name));
-- Owner's project list, newest first.
create index projects_owner_id_created_at_idx on public.projects (owner_id, created_at desc);
create index projects_created_at_idx on public.projects (created_at desc);

create trigger projects_set_updated_at
    before update on public.projects
    for each row execute function private.set_updated_at();

commit;
