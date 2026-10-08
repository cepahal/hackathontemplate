-- 007_ai_history.sql
-- History of AI generations (text, structured, streamed, image/file analysis), written by the
-- FastAPI backend with the caller's own JWT, so RLS applies to every write.
-- Lifecycle: a row is inserted as 'pending' (streams) or directly as completed/failed; a pending
-- row can be finalised exactly once (completed | failed | cancelled) and is then immutable.
-- input holds the prompt and metadata (never file bytes); output holds the result or error.

begin;

create table public.ai_generations (
    id         uuid primary key default gen_random_uuid(),
    user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
    provider   text not null,
    model      text not null,
    type       text not null,
    status     text not null default 'pending',
    input      jsonb not null default '{}'::jsonb,
    output     jsonb,
    created_at timestamptz not null default now(),

    constraint ai_generations_provider_check
        check (provider in ('openai', 'gemini', 'anthropic', 'grok')),
    constraint ai_generations_model_length_check
        check (char_length(model) between 1 and 200),
    constraint ai_generations_type_check
        check (type in ('text', 'structured', 'stream', 'image', 'file')),
    constraint ai_generations_status_check
        check (status in ('pending', 'completed', 'failed', 'cancelled')),
    constraint ai_generations_input_object_check
        check (jsonb_typeof(input) = 'object'),
    constraint ai_generations_input_size_check
        check (octet_length(input::text) <= 1048576),
    constraint ai_generations_output_object_check
        check (output is null or jsonb_typeof(output) = 'object'),
    constraint ai_generations_output_size_check
        check (output is null or octet_length(output::text) <= 1048576)
);

comment on table public.ai_generations is
    'AI generation history. RLS: users see and write only their own rows; finished rows are immutable.';

create index ai_generations_user_id_created_at_idx on public.ai_generations (user_id, created_at desc);
create index ai_generations_user_id_type_created_at_idx on public.ai_generations (user_id, type, created_at desc);

alter table public.ai_generations enable row level security;

revoke all on public.ai_generations from public, anon, authenticated;

-- Clients may create rows, finalise pending ones (status/model/output only) and delete their own.
-- id, user_id, provider, type, input and created_at can never be changed after insert.
grant select, delete on public.ai_generations to authenticated;
grant insert (user_id, provider, model, type, status, input, output) on public.ai_generations to authenticated;
grant update (status, model, output) on public.ai_generations to authenticated;
grant all on public.ai_generations to service_role;

create policy ai_generations_select_own on public.ai_generations
    for select to authenticated
    using (user_id = (select auth.uid()));

create policy ai_generations_insert_own on public.ai_generations
    for insert to authenticated
    with check (user_id = (select auth.uid()));

-- USING sees the old row (must still be pending); WITH CHECK sees the new row.
create policy ai_generations_update_own_pending on public.ai_generations
    for update to authenticated
    using (user_id = (select auth.uid()) and status = 'pending')
    with check (user_id = (select auth.uid()));

create policy ai_generations_delete_own on public.ai_generations
    for delete to authenticated
    using (user_id = (select auth.uid()));

commit;
