-- seed.sql — development data. Safe to re-run (fixed IDs + ON CONFLICT DO NOTHING).
--
-- This script does NOT create Auth users or passwords. First create two users in the Supabase
-- dashboard (Authentication → Users → Add user → "Create new user", tick "Auto Confirm User"),
-- then put their emails below and run this file in the SQL Editor.
-- Activity rows are generated automatically by the triggers from 005_activity.sql.

do $$
declare
    -- EDIT THESE two emails to match the users you created.
    alice_email constant text := 'alice@example.com';
    bob_email   constant text := 'bob@example.com';

    alice_id uuid;
    bob_id   uuid;
begin
    select id into alice_id from public.profiles where lower(email) = lower(alice_email);
    select id into bob_id   from public.profiles where lower(email) = lower(bob_email);

    if alice_id is null or bob_id is null then
        raise exception
            'Seed aborted: no profile for % or %. Create both users in Authentication → Users first, '
            'or edit alice_email / bob_email at the top of seed.sql.', alice_email, bob_email;
    end if;
    if alice_id = bob_id then
        raise exception 'Seed aborted: alice_email and bob_email must be different users.';
    end if;

    update public.profiles set display_name = 'Alice (seed)' where id = alice_id and display_name is null;
    update public.profiles set display_name = 'Bob (seed)'   where id = bob_id   and display_name is null;

    insert into public.projects (id, owner_id, name, description, status) values
        ('0d5e7a10-0000-4000-8000-000000000001', alice_id, 'Onboarding flow',
            'Sign-up, welcome screens and first-run checklist.', 'active'),
        ('0d5e7a10-0000-4000-8000-000000000002', alice_id, 'Analytics dashboard',
            'Charts and KPIs for the demo account.', 'active'),
        ('0d5e7a10-0000-4000-8000-000000000003', alice_id, 'Pitch deck assets',
            'Screenshots and diagrams for the final demo.', 'completed'),
        ('0d5e7a10-0000-4000-8000-000000000004', bob_id, 'Mobile layout',
            'Responsive pass across core screens.', 'paused'),
        ('0d5e7a10-0000-4000-8000-000000000005', bob_id, 'API integration',
            'Connect the frontend to the backend endpoints.', 'active')
    on conflict (id) do nothing;

    insert into public.tasks (id, project_id, title, description, completed, priority, due_date) values
        ('0d5e7a10-0000-4000-8000-000000000101', '0d5e7a10-0000-4000-8000-000000000001',
            'Write welcome copy', '', true, 2, null),
        ('0d5e7a10-0000-4000-8000-000000000102', '0d5e7a10-0000-4000-8000-000000000001',
            'Add first-run checklist', 'Three steps max.', false, 3, now() + interval '3 days'),
        ('0d5e7a10-0000-4000-8000-000000000103', '0d5e7a10-0000-4000-8000-000000000002',
            'Wire KPI cards to the API', '', false, 4, now() + interval '1 day'),
        ('0d5e7a10-0000-4000-8000-000000000104', '0d5e7a10-0000-4000-8000-000000000002',
            'Empty state for charts', '', false, 1, null),
        ('0d5e7a10-0000-4000-8000-000000000105', '0d5e7a10-0000-4000-8000-000000000004',
            'Fix navbar on small screens', '', false, 3, now() + interval '5 days'),
        ('0d5e7a10-0000-4000-8000-000000000106', '0d5e7a10-0000-4000-8000-000000000005',
            'Generate typed API client', '', true, 2, null)
    on conflict (id) do nothing;

    raise notice 'Seed complete: projects/tasks for % and %.', alice_email, bob_email;
end;
$$;
