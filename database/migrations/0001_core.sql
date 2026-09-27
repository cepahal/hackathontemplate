-- Apply once to a fresh Supabase project, before 0002_billing.sql.
-- This transaction creates owner-scoped application tables, not Auth users.
begin;

create schema if not exists extensions;
create extension if not exists vector with schema extensions;

create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    display_name text not null default '' check (length(display_name) <= 120),
    avatar_url text check (avatar_url is null or length(avatar_url) <= 2048),
    role text not null default 'user' check (role in ('user', 'admin')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.projects (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users(id) on delete cascade,
    name text not null check (length(btrim(name)) between 1 and 120),
    description text not null default '' check (length(description) <= 5000),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (id, owner_id)
);
create index projects_owner_created_idx on public.projects(owner_id, created_at desc, id desc);

create table public.project_members (
    project_id uuid not null references public.projects(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    role text not null check (role in ('viewer', 'editor')),
    created_at timestamptz not null default now(),
    primary key (project_id, user_id)
);
create index project_members_user_idx on public.project_members(user_id, project_id);

create table public.documents (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users(id) on delete cascade,
    project_id uuid,
    title text not null check (length(btrim(title)) between 1 and 200),
    content text not null default '' check (length(content) <= 2000000),
    metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (id, owner_id),
    foreign key (project_id, owner_id) references public.projects(id, owner_id) on delete cascade
);
create index documents_owner_created_idx on public.documents(owner_id, created_at desc);
create index documents_project_idx on public.documents(project_id);

create table public.document_chunks (
    id uuid primary key default gen_random_uuid(),
    document_id uuid not null,
    owner_id uuid not null references auth.users(id) on delete cascade,
    content text not null check (length(content) between 1 and 32000),
    embedding extensions.vector(1536) not null,
    -- RAG stores title, chunk_index, and embedding_model (provider:model) here.
    metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
    created_at timestamptz not null default now(),
    foreign key (document_id, owner_id)
        references public.documents(id, owner_id) on delete cascade
);
create index document_chunks_document_idx on public.document_chunks(document_id);
create index document_chunks_owner_idx on public.document_chunks(owner_id);
create index document_chunks_embedding_idx on public.document_chunks
    using hnsw (embedding extensions.vector_cosine_ops);

create table public.agent_runs (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users(id) on delete cascade,
    goal text not null check (length(btrim(goal)) between 1 and 20000),
    state jsonb not null default '{}'::jsonb check (jsonb_typeof(state) = 'object'),
    status text not null default 'planned' check (
        status in ('planned', 'running', 'awaiting_approval', 'completed', 'failed', 'rejected')
    ),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index agent_runs_owner_created_idx on public.agent_runs(owner_id, created_at desc);

create table public.notifications (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users(id) on delete cascade,
    title text not null check (length(btrim(title)) between 1 and 200),
    message text not null default '' check (length(message) <= 5000),
    data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
    read_at timestamptz,
    created_at timestamptz not null default now()
);
create index notifications_owner_created_idx on public.notifications(owner_id, created_at desc);

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
    new.updated_at = now();
    return new;
end;
$$;
revoke all on function public.touch_updated_at() from public, anon, authenticated;

create trigger profiles_touch_updated before update on public.profiles
    for each row execute function public.touch_updated_at();
create trigger projects_touch_updated before update on public.projects
    for each row execute function public.touch_updated_at();

create function public.keep_project_identity() returns trigger
language plpgsql set search_path = '' as $$
begin
    if new.id is distinct from old.id or new.owner_id is distinct from old.owner_id then
        raise exception 'Project identity and ownership are immutable.' using errcode = '42501';
    end if;
    return new;
end;
$$;
revoke all on function public.keep_project_identity() from public, anon, authenticated;
create trigger projects_keep_identity before update on public.projects
    for each row execute function public.keep_project_identity();
create trigger documents_touch_updated before update on public.documents
    for each row execute function public.touch_updated_at();
create trigger agent_runs_touch_updated before update on public.agent_runs
    for each row execute function public.touch_updated_at();

-- Public user_metadata is cosmetic only. Only server-controlled app_metadata grants a role.
create function public.sync_auth_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
    insert into public.profiles (id, display_name, role)
    values (
        new.id,
        left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120),
        case when new.raw_app_meta_data ->> 'role' = 'admin' then 'admin' else 'user' end
    )
    on conflict (id) do update set role = excluded.role;
    return new;
end;
$$;
revoke all on function public.sync_auth_profile() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users
    for each row execute function public.sync_auth_profile();
create trigger on_auth_user_role_changed after update of raw_app_meta_data on auth.users
    for each row execute function public.sync_auth_profile();

-- Backfill pre-existing real Auth users without creating or modifying login accounts.
insert into public.profiles (id, display_name, role)
select id, left(coalesce(raw_user_meta_data ->> 'full_name', ''), 120),
    case when raw_app_meta_data ->> 'role' = 'admin' then 'admin' else 'user' end
from auth.users on conflict (id) do nothing;

-- Definer helpers avoid recursive projects <-> project_members RLS evaluation.
-- They return only access booleans for auth.uid(), never arbitrary callers' identities.
create function public.is_project_owner(project_uuid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
    select exists (
        select 1 from public.projects
        where id = project_uuid and owner_id = (select auth.uid())
    );
$$;
create function public.can_read_project(project_uuid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
    select exists (
        select 1 from public.projects p
        where p.id = project_uuid and (
            p.owner_id = (select auth.uid())
            or exists (
                select 1 from public.project_members m
                where m.project_id = p.id and m.user_id = (select auth.uid())
            )
        )
    );
$$;
create function public.can_edit_project(project_uuid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
    select exists (
        select 1 from public.projects p
        where p.id = project_uuid and (
            p.owner_id = (select auth.uid())
            or exists (
                select 1 from public.project_members m
                where m.project_id = p.id and m.user_id = (select auth.uid()) and m.role = 'editor'
            )
        )
    );
$$;
revoke all on function public.is_project_owner(uuid), public.can_read_project(uuid),
    public.can_edit_project(uuid) from public, anon;
grant execute on function public.is_project_owner(uuid), public.can_read_project(uuid),
    public.can_edit_project(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.agent_runs enable row level security;
alter table public.notifications enable row level security;

-- Remove Supabase's broad default grants before granting the exact client operations.
revoke all on public.profiles, public.projects, public.project_members,
    public.documents, public.document_chunks,
    public.agent_runs, public.notifications from public, anon, authenticated;
grant usage on schema public, extensions to authenticated, service_role;
grant select on public.profiles to authenticated;
grant update(display_name, avatar_url) on public.profiles to authenticated;
grant select, insert, delete on public.projects to authenticated;
grant update(name, description) on public.projects to authenticated;
grant select, insert, delete on public.project_members to authenticated;
grant update(role) on public.project_members to authenticated;
grant select, insert, update, delete on public.documents,
    public.document_chunks, public.agent_runs to authenticated;
grant select on public.notifications to authenticated;
grant update(read_at) on public.notifications to authenticated;
grant all on public.profiles, public.projects, public.project_members,
    public.documents, public.document_chunks,
    public.agent_runs, public.notifications to service_role;

create policy profiles_read_own on public.profiles for select to authenticated
    using ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles for update to authenticated
    using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy projects_read_accessible on public.projects for select to authenticated
    using (public.can_read_project(id));
create policy projects_insert_own on public.projects for insert to authenticated
    with check ((select auth.uid()) = owner_id);
create policy projects_update_editable on public.projects for update to authenticated
    using (public.can_edit_project(id)) with check (public.can_edit_project(id));
create policy projects_delete_own on public.projects for delete to authenticated
    using ((select auth.uid()) = owner_id);

create policy members_read_self_or_owner on public.project_members for select to authenticated
    using (user_id = (select auth.uid()) or public.is_project_owner(project_id));
create policy members_insert_owner on public.project_members for insert to authenticated
    with check (public.is_project_owner(project_id));
create policy members_update_owner on public.project_members for update to authenticated
    using (public.is_project_owner(project_id)) with check (public.is_project_owner(project_id));
create policy members_delete_owner on public.project_members for delete to authenticated
    using (public.is_project_owner(project_id));

create policy documents_read_own on public.documents for select to authenticated
    using ((select auth.uid()) = owner_id);
create policy documents_insert_own on public.documents for insert to authenticated
    with check ((select auth.uid()) = owner_id);
create policy documents_update_own on public.documents for update to authenticated
    using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy documents_delete_own on public.documents for delete to authenticated
    using ((select auth.uid()) = owner_id);

create policy chunks_read_own on public.document_chunks for select to authenticated
    using ((select auth.uid()) = owner_id);
create policy chunks_insert_own on public.document_chunks for insert to authenticated
    with check ((select auth.uid()) = owner_id);
create policy chunks_update_own on public.document_chunks for update to authenticated
    using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy chunks_delete_own on public.document_chunks for delete to authenticated
    using ((select auth.uid()) = owner_id);

create policy agent_runs_read_own on public.agent_runs for select to authenticated
    using ((select auth.uid()) = owner_id);
create policy agent_runs_insert_own on public.agent_runs for insert to authenticated
    with check ((select auth.uid()) = owner_id);
create policy agent_runs_update_own on public.agent_runs for update to authenticated
    using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy agent_runs_delete_own on public.agent_runs for delete to authenticated
    using ((select auth.uid()) = owner_id);

create policy notifications_read_own on public.notifications for select to authenticated
    using ((select auth.uid()) = owner_id);
create policy notifications_mark_own on public.notifications for update to authenticated
    using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

-- A real project insert emits a real notification, atomically in the same transaction.
create function public.notify_project_created() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
    insert into public.notifications(owner_id, title, message, data)
    values (new.owner_id, 'Project created', 'Your project is ready.',
        jsonb_build_object('project_id', new.id));
    return new;
end;
$$;
revoke all on function public.notify_project_created() from public, anon, authenticated;
create trigger on_project_created after insert on public.projects
    for each row execute function public.notify_project_created();

create function public.match_document_chunks(
    query_embedding extensions.vector(1536),
    match_count integer default 5,
    filter_project_id uuid default null,
    filter_embedding_model text default null
)
returns table (
    id uuid, document_id uuid, content text, metadata jsonb, similarity double precision
)
language sql stable security invoker set search_path = '' as $$
    select c.id, c.document_id, c.content, c.metadata,
        1 - (c.embedding operator(extensions.<=>) query_embedding) as similarity
    from public.document_chunks c
    join public.documents d on d.id = c.document_id and d.owner_id = c.owner_id
    where c.owner_id = (select auth.uid())
        and (filter_project_id is null or d.project_id = filter_project_id)
        and (filter_embedding_model is null
            or c.metadata ->> 'embedding_model' = filter_embedding_model)
    order by c.embedding operator(extensions.<=>) query_embedding
    limit least(greatest(coalesce(match_count, 5), 1), 100);
$$;
revoke all on function public.match_document_chunks(extensions.vector, integer, uuid, text)
    from public, anon;
grant execute on function public.match_document_chunks(extensions.vector, integer, uuid, text)
    to authenticated;

-- postgres_changes honors each table's SELECT RLS when delivering records.
do $$
declare table_name text;
begin
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
        foreach table_name in array array['projects', 'project_members', 'notifications', 'agent_runs']
        loop
            if not exists (
                select 1 from pg_publication_tables
                where pubname = 'supabase_realtime' and schemaname = 'public'
                    and tablename = table_name
            ) then
                execute format('alter publication supabase_realtime add table public.%I', table_name);
            end if;
        end loop;
    end if;
end;
$$;

-- Private presence/broadcast: project owner/members or the owner of a user:<uuid> channel.
create policy workspace_realtime_read on realtime.messages for select to authenticated
using (
    extension in ('presence', 'broadcast')
    and (
        (select realtime.topic()) = 'user:' || (select auth.uid())::text
        or exists (
            select 1 from public.projects p
            where (select realtime.topic()) = 'project:' || p.id::text
        )
    )
);
create policy workspace_realtime_write on realtime.messages for insert to authenticated
with check (
    extension in ('presence', 'broadcast')
    and (
        (select realtime.topic()) = 'user:' || (select auth.uid())::text
        or exists (
            select 1 from public.projects p
            where (select realtime.topic()) = 'project:' || p.id::text
        )
    )
);

commit;
