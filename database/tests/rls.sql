-- Integration verification, not a migration. Run as Supabase project owner.
-- First create TWO real test accounts through Auth, then replace user_a/user_b below.
-- All records created by this verification are rolled back.
begin;
do $$
declare
    user_a uuid := '00000000-0000-0000-0000-000000000001';
    user_b uuid := '00000000-0000-0000-0000-000000000002';
    project_a uuid := gen_random_uuid();
    project_b uuid := gen_random_uuid();
    document_a uuid := gen_random_uuid();
    document_b uuid := gen_random_uuid();
    affected integer;
    query_vector extensions.vector(1536) := array_fill(0.01::real, array[1536])::extensions.vector;
begin
    if user_a = user_b or (
        select count(*) from auth.users where id in (user_a, user_b)
    ) <> 2 then
        raise exception 'Replace user_a and user_b with two different real test Auth user IDs.';
    end if;

    insert into public.projects(id, owner_id, name)
    values (project_a, user_a, 'RLS verification A'), (project_b, user_b, 'RLS verification B');
    insert into public.documents(id, owner_id, project_id, title, content)
    values (document_a, user_a, project_a, 'Private document A', 'Owner A content'),
        (document_b, user_b, project_b, 'Private document B', 'Owner B content');
    insert into public.document_chunks(document_id, owner_id, content, embedding, metadata)
    values (document_a, user_a, 'Owner A chunk', query_vector,
        '{"embedding_model":"test:1536"}'::jsonb),
        (document_b, user_b, 'Owner B chunk', query_vector,
        '{"embedding_model":"test:1536"}'::jsonb);

    perform set_config('request.jwt.claims',
        jsonb_build_object('sub', user_a::text, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';

    if (select count(*) from public.projects where id in (project_a, project_b)) <> 1 then
        raise exception 'FAILED: owner A could not read exactly their own project.';
    end if;
    if (select count(*) from public.documents where id in (document_a, document_b)) <> 1 then
        raise exception 'FAILED: document reads were not owner-scoped.';
    end if;
    if (select count(*) from public.document_chunks
        where document_id in (document_a, document_b)) <> 1 then
        raise exception 'FAILED: chunk reads were not owner-scoped.';
    end if;
    if exists (
        select 1 from public.match_document_chunks(query_vector, 100, null, 'test:1536')
        where document_id = document_b
    ) then
        raise exception 'FAILED: retrieval exposed another owner''s document.';
    end if;

    update public.projects set name = 'Forbidden edit' where id = project_b;
    get diagnostics affected = row_count;
    if affected <> 0 then raise exception 'FAILED: cross-owner update succeeded.'; end if;
    delete from public.projects where id = project_b;
    get diagnostics affected = row_count;
    if affected <> 0 then raise exception 'FAILED: cross-owner delete succeeded.'; end if;

    begin
        update public.projects set owner_id = user_b where id = project_a;
        raise exception 'FAILED: transferring ownership bypassed WITH CHECK.';
    exception when insufficient_privilege then null;
    end;
    begin
        insert into public.projects(owner_id, name) values (user_b, 'Forbidden owner');
        raise exception 'FAILED: insertion under another owner succeeded.';
    exception when insufficient_privilege then null;
    end;
    begin
        update public.profiles set role = 'admin' where id = user_a;
        raise exception 'FAILED: client could promote their own profile.';
    exception when insufficient_privilege then null;
    end;
    begin
        insert into public.documents(owner_id, project_id, title)
        values (user_a, project_b, 'Forbidden project link');
        raise exception 'FAILED: cross-owner project/document linkage succeeded.';
    exception when foreign_key_violation then null;
    end;
    begin
        update public.notifications set title = 'Forged notification' where owner_id = user_a;
        raise exception 'FAILED: client could rewrite trusted notification content.';
    exception when insufficient_privilege then null;
    end;

    update public.notifications set read_at = now() where owner_id = user_a;
    get diagnostics affected = row_count;
    if affected = 0 then raise exception 'FAILED: owner could not mark notifications read.'; end if;

    -- The owner of B invites A as a viewer, then promotes and removes the membership.
    execute 'reset role';
    perform set_config('request.jwt.claims',
        jsonb_build_object('sub', user_b::text, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    insert into public.project_members(project_id, user_id, role)
    values (project_b, user_a, 'viewer');

    perform set_config('request.jwt.claims',
        jsonb_build_object('sub', user_a::text, 'role', 'authenticated')::text, true);
    if (select count(*) from public.projects where id = project_b) <> 1 then
        raise exception 'FAILED: an invited viewer could not read the shared project.';
    end if;
    if exists (select 1 from public.documents where id = document_b) then
        raise exception 'FAILED: project membership exposed owner-private documents.';
    end if;
    update public.projects set description = 'Viewer edit' where id = project_b;
    get diagnostics affected = row_count;
    if affected <> 0 then raise exception 'FAILED: a viewer could edit the project.'; end if;
    update public.project_members set role = 'editor'
    where project_id = project_b and user_id = user_a;
    get diagnostics affected = row_count;
    if affected <> 0 then raise exception 'FAILED: a viewer promoted their own membership.'; end if;

    perform set_config('request.jwt.claims',
        jsonb_build_object('sub', user_b::text, 'role', 'authenticated')::text, true);
    update public.project_members set role = 'editor'
    where project_id = project_b and user_id = user_a;
    get diagnostics affected = row_count;
    if affected <> 1 then raise exception 'FAILED: owner could not promote a member.'; end if;

    perform set_config('request.jwt.claims',
        jsonb_build_object('sub', user_a::text, 'role', 'authenticated')::text, true);
    update public.projects set description = 'Editor edit' where id = project_b;
    get diagnostics affected = row_count;
    if affected <> 1 then raise exception 'FAILED: an editor could not edit the shared project.'; end if;
    delete from public.projects where id = project_b;
    get diagnostics affected = row_count;
    if affected <> 0 then raise exception 'FAILED: an editor could delete another owner project.'; end if;
    begin
        insert into public.project_members(project_id, user_id, role)
        values (project_b, user_b, 'viewer');
        raise exception 'FAILED: an editor could add members.';
    exception when insufficient_privilege then null;
    end;

    perform set_config('request.jwt.claims',
        jsonb_build_object('sub', user_b::text, 'role', 'authenticated')::text, true);
    delete from public.project_members where project_id = project_b and user_id = user_a;
    perform set_config('request.jwt.claims',
        jsonb_build_object('sub', user_a::text, 'role', 'authenticated')::text, true);
    if exists (select 1 from public.projects where id = project_b) then
        raise exception 'FAILED: a removed member retained project access.';
    end if;

    execute 'reset role';
    raise notice 'RLS verification passed. Test records will now be rolled back.';
end;
$$;
rollback;
