-- Optional seed for one REAL account. Run once in the Supabase SQL editor as project owner.
-- Replace the UUID below with an existing Auth user's ID before executing.
begin;
do $$
declare
    seed_owner uuid := '00000000-0000-0000-0000-000000000000';
begin
    if seed_owner = '00000000-0000-0000-0000-000000000000'::uuid then
        raise exception 'Set seed_owner to a real Supabase Auth user ID before running this seed.';
    end if;
    if not exists (select 1 from auth.users where id = seed_owner) then
        raise exception 'seed_owner does not match an existing Auth user.';
    end if;
    if not exists (
        select 1 from public.projects where owner_id = seed_owner and name = 'My first project'
    ) then
        insert into public.projects(owner_id, name, description)
        values (seed_owner, 'My first project', 'A starting point for your next idea.');
    end if;
end;
$$;
commit;
