-- 006_rls.sql
-- Row Level Security + explicit privileges for every user-owned table.
--
-- Two layers:
--   1. GRANTs decide which operations/columns a role may touch at all. Supabase grants ALL on new
--      public tables to anon/authenticated by default, so we revoke that and re-grant precisely.
--   2. POLICIES decide which rows. No policy uses USING (true); every rule is tied to auth.uid().
-- anon (signed-out) gets no access to any of these tables.

begin;

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.tasks    enable row level security;
alter table public.activity enable row level security;

revoke all on public.profiles, public.projects, public.tasks, public.activity
    from public, anon, authenticated;

grant usage on schema public to authenticated, service_role;

-- profiles: read own row; edit only cosmetic columns (never id, email, role, timestamps).
grant select on public.profiles to authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;

-- projects: full CRUD on own rows; owner_id can be set on insert (checked below) but never changed.
grant select, delete on public.projects to authenticated;
grant insert (owner_id, name, description, status) on public.projects to authenticated;
grant update (name, description, status) on public.projects to authenticated;

-- tasks: full CRUD inside own projects; project_id may change only to another own project.
grant select, delete on public.tasks to authenticated;
grant insert (project_id, title, description, completed, priority, due_date) on public.tasks to authenticated;
grant update (project_id, title, description, completed, priority, due_date) on public.tasks to authenticated;

-- activity: read-only for clients; rows come from SECURITY DEFINER triggers.
grant select on public.activity to authenticated;

grant all on public.profiles, public.projects, public.tasks, public.activity to service_role;

-- profiles --------------------------------------------------------------------------------
create policy profiles_select_own on public.profiles
    for select to authenticated
    using (id = (select auth.uid()));

create policy profiles_update_own on public.profiles
    for update to authenticated
    using (id = (select auth.uid()))
    with check (id = (select auth.uid()));

-- projects --------------------------------------------------------------------------------
create policy projects_select_own on public.projects
    for select to authenticated
    using (owner_id = (select auth.uid()));

create policy projects_insert_own on public.projects
    for insert to authenticated
    with check (owner_id = (select auth.uid()));

create policy projects_update_own on public.projects
    for update to authenticated
    using (owner_id = (select auth.uid()))
    with check (owner_id = (select auth.uid()));

create policy projects_delete_own on public.projects
    for delete to authenticated
    using (owner_id = (select auth.uid()));

-- tasks: access follows the parent project's owner ----------------------------------------
create policy tasks_select_own_project on public.tasks
    for select to authenticated
    using (exists (
        select 1 from public.projects p
        where p.id = tasks.project_id and p.owner_id = (select auth.uid())
    ));

create policy tasks_insert_own_project on public.tasks
    for insert to authenticated
    with check (exists (
        select 1 from public.projects p
        where p.id = tasks.project_id and p.owner_id = (select auth.uid())
    ));

create policy tasks_update_own_project on public.tasks
    for update to authenticated
    using (exists (
        select 1 from public.projects p
        where p.id = tasks.project_id and p.owner_id = (select auth.uid())
    ))
    with check (exists (
        select 1 from public.projects p
        where p.id = tasks.project_id and p.owner_id = (select auth.uid())
    ));

create policy tasks_delete_own_project on public.tasks
    for delete to authenticated
    using (exists (
        select 1 from public.projects p
        where p.id = tasks.project_id and p.owner_id = (select auth.uid())
    ));

-- activity: read own feed only; no insert/update/delete policies on purpose ---------------
create policy activity_select_own on public.activity
    for select to authenticated
    using (user_id = (select auth.uid()));

commit;
