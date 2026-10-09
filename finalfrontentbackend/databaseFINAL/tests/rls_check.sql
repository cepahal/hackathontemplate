-- tests/rls_check.sql — verifies that two users cannot touch each other's data.
-- Not a migration. Run in the Supabase SQL Editor after migrations 001–007.
-- Requires two existing Auth users (see README).
-- Success: NOTICE "RLS check passed". Failure: an exception naming the broken rule.
-- All test work runs in a PL/pgSQL exception block that always ends by raising, so its rows,
-- role switch and JWT claims are rolled back whether the check passes or fails.

do $$
declare
    -- EDIT THESE to two different users that exist in Authentication → Users.
    user_a_email constant text := 'alice@example.com';
    user_b_email constant text := 'bob@example.com';

    user_a uuid;
    user_b uuid;
    project_a uuid := gen_random_uuid();
    project_b uuid := gen_random_uuid();
    task_a uuid := gen_random_uuid();
    task_b uuid := gen_random_uuid();
    generation_a uuid := gen_random_uuid();
    generation_b uuid := gen_random_uuid();
    affected integer;
    visible integer;
begin
    select id into user_a from public.profiles where lower(email) = lower(user_a_email);
    select id into user_b from public.profiles where lower(email) = lower(user_b_email);
    if user_a is null or user_b is null or user_a = user_b then
        raise exception 'Set user_a_email / user_b_email to two different existing users.';
    end if;

    begin
        -- Arrange (as postgres, bypassing RLS).
        insert into public.projects (id, owner_id, name) values
            (project_a, user_a, 'RLS check A ' || project_a),
            (project_b, user_b, 'RLS check B ' || project_b);
        insert into public.tasks (id, project_id, title) values
            (task_a, project_a, 'Task A'),
            (task_b, project_b, 'Task B');
        insert into public.ai_generations (id, user_id, provider, model, type, status) values
            (generation_a, user_a, 'openai', 'm', 'stream', 'pending'),
            (generation_b, user_b, 'openai', 'm', 'stream', 'pending');

        -- Act as user A through the same role and JWT claims PostgREST uses.
        perform set_config('request.jwt.claims',
            jsonb_build_object('sub', user_a::text, 'role', 'authenticated')::text, true);
        execute 'set local role authenticated';

        select count(*) into visible from public.profiles where id in (user_a, user_b);
        if visible <> 1 then raise exception 'FAILED: profiles visible to A = % (expected 1).', visible; end if;

        select count(*) into visible from public.projects where id in (project_a, project_b);
        if visible <> 1 then raise exception 'FAILED: projects visible to A = % (expected 1).', visible; end if;

        select count(*) into visible from public.tasks where id in (task_a, task_b);
        if visible <> 1 then raise exception 'FAILED: tasks visible to A = % (expected 1).', visible; end if;

        if exists (select 1 from public.activity where user_id = user_b) then
            raise exception 'FAILED: A can read B''s activity.';
        end if;
        if not exists (select 1 from public.activity where project_id = project_a) then
            raise exception 'FAILED: A cannot read the activity generated for their own project.';
        end if;

        update public.projects set name = 'hijacked' where id = project_b;
        get diagnostics affected = row_count;
        if affected <> 0 then raise exception 'FAILED: A updated B''s project.'; end if;

        delete from public.projects where id = project_b;
        get diagnostics affected = row_count;
        if affected <> 0 then raise exception 'FAILED: A deleted B''s project.'; end if;

        update public.tasks set completed = true where id = task_b;
        get diagnostics affected = row_count;
        if affected <> 0 then raise exception 'FAILED: A updated B''s task.'; end if;

        delete from public.tasks where id = task_b;
        get diagnostics affected = row_count;
        if affected <> 0 then raise exception 'FAILED: A deleted B''s task.'; end if;

        update public.profiles set display_name = 'hijacked' where id = user_b;
        get diagnostics affected = row_count;
        if affected <> 0 then raise exception 'FAILED: A updated B''s profile.'; end if;

        select count(*) into visible from public.ai_generations where id in (generation_a, generation_b);
        if visible <> 1 then raise exception 'FAILED: ai_generations visible to A = % (expected 1).', visible; end if;

        update public.ai_generations set status = 'completed' where id = generation_b;
        get diagnostics affected = row_count;
        if affected <> 0 then raise exception 'FAILED: A updated B''s AI generation.'; end if;

        delete from public.ai_generations where id = generation_b;
        get diagnostics affected = row_count;
        if affected <> 0 then raise exception 'FAILED: A deleted B''s AI generation.'; end if;

        begin
            insert into public.ai_generations (user_id, provider, model, type) values (user_b, 'openai', 'm', 'text');
            raise exception 'FAILED: A created an AI generation owned by B.';
        exception when insufficient_privilege then null;
        end;

        begin
            update public.ai_generations set input = '{"prompt":"rewritten"}' where id = generation_a;
            raise exception 'FAILED: A rewrote the input of an AI generation.';
        exception when insufficient_privilege then null;
        end;

        begin
            insert into public.projects (owner_id, name) values (user_b, 'Planted in B');
            raise exception 'FAILED: A created a project owned by B.';
        exception when insufficient_privilege then null;
        end;

        begin
            insert into public.tasks (project_id, title) values (project_b, 'Planted task');
            raise exception 'FAILED: A added a task to B''s project.';
        exception when insufficient_privilege then null;
        end;

        begin
            update public.tasks set project_id = project_b where id = task_a;
            raise exception 'FAILED: A moved a task into B''s project.';
        exception when insufficient_privilege then null;
        end;

        begin
            update public.projects set owner_id = user_b where id = project_a;
            raise exception 'FAILED: A transferred project ownership.';
        exception when insufficient_privilege then null;
        end;

        begin
            update public.profiles set role = 'admin' where id = user_a;
            raise exception 'FAILED: A promoted their own role.';
        exception when insufficient_privilege then null;
        end;

        begin
            insert into public.activity (user_id, type, message) values (user_a, 'project_created', 'forged');
            raise exception 'FAILED: A inserted activity directly.';
        exception when insufficient_privilege then null;
        end;

        -- Positive checks: A can manage their own data.
        insert into public.projects (name) values ('RLS check A2 ' || gen_random_uuid());
        get diagnostics affected = row_count;
        if affected <> 1 then raise exception 'FAILED: A could not create a project with default owner.'; end if;

        update public.tasks set completed = true where id = task_a;
        get diagnostics affected = row_count;
        if affected <> 1 then raise exception 'FAILED: A could not update their own task.'; end if;

        update public.profiles set display_name = 'Alice RLS' where id = user_a;
        get diagnostics affected = row_count;
        if affected <> 1 then raise exception 'FAILED: A could not update their own profile.'; end if;

        insert into public.ai_generations (provider, model, type, status) values ('openai', 'm', 'text', 'completed');
        get diagnostics affected = row_count;
        if affected <> 1 then raise exception 'FAILED: A could not record an AI generation with default owner.'; end if;

        update public.ai_generations set status = 'completed', output = '{"text":"ok"}' where id = generation_a;
        get diagnostics affected = row_count;
        if affected <> 1 then raise exception 'FAILED: A could not finalise their own pending AI generation.'; end if;

        update public.ai_generations set output = '{"text":"edited"}' where id = generation_a;
        get diagnostics affected = row_count;
        if affected <> 0 then raise exception 'FAILED: A edited a finalised AI generation.'; end if;

        -- Signed-out (anon) clients get nothing.
        execute 'reset role';
        perform set_config('request.jwt.claims', '{"role":"anon"}', true);
        execute 'set local role anon';
        begin
            perform 1 from public.projects limit 1;
            raise exception 'FAILED: anon can query projects.';
        exception when insufficient_privilege then null;
        end;
        begin
            perform 1 from public.ai_generations limit 1;
            raise exception 'FAILED: anon can query ai_generations.';
        exception when insufficient_privilege then null;
        end;

        raise exception using errcode = 'P0001', message = 'rls_check_ok';
    exception when others then
        if sqlerrm <> 'rls_check_ok' then
            raise;
        end if;
    end;

    raise notice 'RLS check passed. All test rows were rolled back.';
end;
$$;
