-- 004_tasks.sql
-- Tasks belong to a project; access is inherited from the parent project's owner (see 006_rls.sql).
-- Priority: 1 = low, 2 = medium, 3 = high, 4 = urgent.

begin;

create table public.tasks (
    id          uuid primary key default gen_random_uuid(),
    project_id  uuid not null references public.projects (id) on delete cascade,
    title       text not null,
    description text not null default '',
    completed   boolean not null default false,
    priority    integer not null default 2,
    due_date    timestamptz,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),

    constraint tasks_title_length_check
        check (char_length(btrim(title)) between 1 and 200),
    constraint tasks_description_length_check
        check (char_length(description) <= 5000),
    constraint tasks_priority_check
        check (priority between 1 and 4)
);

comment on table public.tasks is 'Tasks inside a project. RLS: owner of the parent project only.';
comment on column public.tasks.priority is '1 = low, 2 = medium, 3 = high, 4 = urgent.';

create index tasks_project_id_idx on public.tasks (project_id, created_at desc);
create index tasks_due_date_idx on public.tasks (due_date) where due_date is not null;

create trigger tasks_set_updated_at
    before update on public.tasks
    for each row execute function private.set_updated_at();

commit;
