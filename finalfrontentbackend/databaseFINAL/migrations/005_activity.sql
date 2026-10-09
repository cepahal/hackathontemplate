-- 005_activity.sql
-- Append-only activity feed. Rows are written ONLY by the triggers below (SECURITY DEFINER),
-- so clients can read their feed but can never forge, edit or delete entries.
-- activity.user_id is the feed owner (the project owner); metadata.actor_id records who acted
-- (NULL when the change came from the SQL editor / service role).

begin;

create table public.activity (
    id         uuid primary key default gen_random_uuid(),
    user_id    uuid not null references public.profiles (id) on delete cascade,
    project_id uuid references public.projects (id) on delete set null,
    type       text not null,
    message    text not null,
    metadata   jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),

    constraint activity_type_check check (type in (
        'project_created',
        'project_updated',
        'project_status_changed',
        'project_deleted',
        'task_created',
        'task_completed',
        'task_reopened'
    )),
    constraint activity_message_length_check
        check (char_length(message) between 1 and 500),
    constraint activity_metadata_object_check
        check (jsonb_typeof(metadata) = 'object')
);

comment on table public.activity is 'Append-only feed written by triggers. RLS: users read their own rows.';

create index activity_user_id_created_at_idx on public.activity (user_id, created_at desc);
create index activity_project_id_idx on public.activity (project_id) where project_id is not null;
create index activity_created_at_idx on public.activity (created_at desc);

create or replace function private.log_project_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    actor uuid := auth.uid();
begin
    if tg_op = 'INSERT' then
        insert into public.activity (user_id, project_id, type, message, metadata)
        values (
            new.owner_id, new.id, 'project_created',
            left(format('Created project "%s"', new.name), 500),
            jsonb_build_object('actor_id', actor, 'project_name', new.name)
        );
        return new;
    end if;

    if tg_op = 'UPDATE' then
        if new.status is distinct from old.status then
            insert into public.activity (user_id, project_id, type, message, metadata)
            values (
                new.owner_id, new.id, 'project_status_changed',
                left(format('Changed "%s" from %s to %s', new.name, old.status, new.status), 500),
                jsonb_build_object('actor_id', actor, 'from', old.status, 'to', new.status)
            );
        end if;
        if new.name is distinct from old.name or new.description is distinct from old.description then
            insert into public.activity (user_id, project_id, type, message, metadata)
            values (
                new.owner_id, new.id, 'project_updated',
                left(format('Updated project "%s"', new.name), 500),
                jsonb_build_object('actor_id', actor, 'previous_name', old.name)
            );
        end if;
        return new;
    end if;

    -- DELETE: skip when the owner's profile is itself being deleted (account removal cascade),
    -- otherwise the insert would violate activity.user_id's foreign key.
    if exists (select 1 from public.profiles p where p.id = old.owner_id) then
        insert into public.activity (user_id, project_id, type, message, metadata)
        values (
            old.owner_id, null, 'project_deleted',
            left(format('Deleted project "%s"', old.name), 500),
            jsonb_build_object('actor_id', actor, 'project_id', old.id, 'project_name', old.name)
        );
    end if;
    return old;
end;
$$;

create or replace function private.log_task_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    actor uuid := auth.uid();
    project_owner uuid;
    project_name text;
begin
    select p.owner_id, p.name into project_owner, project_name
    from public.projects p
    where p.id = new.project_id;

    if project_owner is null then
        return new;
    end if;

    if tg_op = 'INSERT' then
        insert into public.activity (user_id, project_id, type, message, metadata)
        values (
            project_owner, new.project_id, 'task_created',
            left(format('Added task "%s" to %s', new.title, project_name), 500),
            jsonb_build_object('actor_id', actor, 'task_id', new.id, 'task_title', new.title)
        );
    elsif new.completed is distinct from old.completed then
        insert into public.activity (user_id, project_id, type, message, metadata)
        values (
            project_owner, new.project_id,
            case when new.completed then 'task_completed' else 'task_reopened' end,
            left(format(
                case when new.completed then 'Completed task "%s" in %s' else 'Reopened task "%s" in %s' end,
                new.title, project_name
            ), 500),
            jsonb_build_object('actor_id', actor, 'task_id', new.id, 'task_title', new.title)
        );
    end if;
    return new;
end;
$$;

revoke all on function private.log_project_activity() from public, anon, authenticated;
revoke all on function private.log_task_activity() from public, anon, authenticated;

create trigger projects_log_activity
    after insert or update or delete on public.projects
    for each row execute function private.log_project_activity();

create trigger tasks_log_activity
    after insert or update of completed on public.tasks
    for each row execute function private.log_task_activity();

commit;
