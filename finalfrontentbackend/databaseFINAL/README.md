# databaseFINAL — Supabase schema for frontendFINAL

Postgres schema, Row Level Security and dev seed for the `frontendFINAL` app.
Tables: `profiles`, `projects`, `tasks`, `activity`, `ai_generations`. Details: [`schema.md`](./schema.md).

```text
databaseFINAL/
├── migrations/
│   ├── 001_extensions.sql   pgcrypto, private schema, updated_at helper
│   ├── 002_profiles.sql     profiles + auth.users → profiles triggers (+ backfill)
│   ├── 003_projects.sql     projects
│   ├── 004_tasks.sql        tasks
│   ├── 005_activity.sql     activity + activity-logging triggers
│   ├── 006_rls.sql          grants + RLS policies for the tables above
│   └── 007_ai_history.sql   ai_generations (AI history) + its grants and RLS
├── seed.sql                 dev projects/tasks for two existing users (no credentials)
├── tests/rls_check.sql      proves two users can't read/write each other's data (rolls back)
├── schema.md
└── README.md
```

TypeScript types matching this schema: `../frontendFINAL/src/types/database.ts`
(used by `createClient()` in `src/lib/supabase/browser.ts` and `server.ts`).

---

## 1. Create the Supabase project

1. Go to <https://supabase.com/dashboard> → **New project**.
2. Pick an organisation, name, database password (store it in a password manager) and region.
3. Wait until the project is provisioned.

## 2. Get the project URL

Dashboard → **Project Settings → Data API** (or the **Connect** button) → **Project URL**,
e.g. `https://abcdefghijkl.supabase.co`.

## 3. Get the anon / publishable key

Dashboard → **Project Settings → API Keys**. Copy the **publishable** key (`sb_publishable_…`)
or, on older projects, the legacy **anon** `public` key. Both are safe for the browser because
RLS protects the data.

Put both values in `frontendFINAL/.env.local` (git-ignored):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijkl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
NEXT_PUBLIC_API_URL=http://localhost:8000
```

**Never** put the `service_role` / `sb_secret_…` key in the frontend or in git. The app refuses
to start with one (`src/lib/supabase/config.ts`).

## 4. Apply the migrations

Dashboard → **SQL Editor** → **New query**. Paste and run each file **in order**, one at a time:

1. `migrations/001_extensions.sql`
2. `migrations/002_profiles.sql`
3. `migrations/003_projects.sql`
4. `migrations/004_tasks.sql`
5. `migrations/005_activity.sql`
6. `migrations/006_rls.sql`
7. `migrations/007_ai_history.sql`

Each file runs in a transaction (`begin … commit`), so a failure leaves nothing half-applied.
They are not re-runnable (plain `create table`); to start over use [Reset](#reset-development-only).

Check it worked:

```sql
select tablename, rowsecurity from pg_tables
where schemaname = 'public' and tablename in ('profiles', 'projects', 'tasks', 'activity', 'ai_generations');
-- expect 5 rows, rowsecurity = true

select count(*) from public.profiles;  -- = number of existing users in Authentication → Users
```

Using the Supabase CLI instead? Copy the files into `supabase/migrations/` with timestamp prefixes
(e.g. `20260101000001_extensions.sql`) and run `supabase db push`.

## 5. Create test accounts

Auth users (and their passwords) are **never** created in SQL here. Create two users in the dashboard:

1. **Authentication → Users → Add user → Create new user**.
2. Email `alice@example.com` (any address you like), a strong throwaway password,
   tick **Auto Confirm User**. Repeat for `bob@example.com`.
3. A row appears in `public.profiles` for each one automatically (trigger `on_auth_user_created`):

```sql
select id, email, role from public.profiles order by created_at;
```

Or sign up through the app at `/signup` (requires email confirmation unless disabled in
**Authentication → Sign In / Providers → Email**).

Make a user an admin (role lives in `app_metadata`; `profiles.role` follows via trigger):

```sql
update auth.users
set raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'::jsonb
where email = 'alice@example.com';
```

The user must sign out and in again (or wait for a token refresh) for the JWT to carry the new role.

## 6. Verify RLS

### A. SQL check (fastest)

Open `tests/rls_check.sql`, set `user_a_email` / `user_b_email` to your two test users, and run it
in the SQL Editor. It impersonates user A exactly like the Data API does
(`set local role authenticated` + `request.jwt.claims`), then asserts that A:

- sees only their own profile, projects, tasks, activity and AI generations;
- updating/deleting B's project, task, profile or AI generation affects 0 rows;
- cannot create a project owned by B, add a task to B's project, or move a task into it (42501);
- cannot change `owner_id`, promote their own `role`, insert activity, create an AI generation for B
  or rewrite a generation's `input` (42501); a finalised generation can no longer be edited;
- *can* create/update their own rows; and that `anon` cannot read anything.

Success prints `NOTICE: RLS check passed`. Any failure raises `FAILED: …` naming the broken rule.
Everything is rolled back, so it is safe to run repeatedly.

### B. Through the real API (two signed-in users)

Run after seeding (step 7). Replace the placeholders; the passwords are the ones you chose in step 5.

```bash
URL=https://abcdefghijkl.supabase.co
KEY=sb_publishable_...

token() {
  curl -s "$URL/auth/v1/token?grant_type=password" -H "apikey: $KEY" \
    -H "Content-Type: application/json" -d "{\"email\":\"$1\",\"password\":\"$2\"}" |
    node -pe 'JSON.parse(require("fs").readFileSync(0)).access_token'
}
ALICE=$(token alice@example.com 'alice-password')
BOB=$(token bob@example.com 'bob-password')

# Each user sees only their own projects (Alice 3, Bob 2 with the seed):
curl -s "$URL/rest/v1/projects?select=name" -H "apikey: $KEY" -H "Authorization: Bearer $ALICE"
curl -s "$URL/rest/v1/projects?select=name" -H "apikey: $KEY" -H "Authorization: Bearer $BOB"

# Bob cannot delete Alice's project — returns [] and the row survives:
curl -s -X DELETE "$URL/rest/v1/projects?id=eq.0d5e7a10-0000-4000-8000-000000000001" \
  -H "apikey: $KEY" -H "Authorization: Bearer $BOB" -H "Prefer: return=representation"

# Signed out (no user token) — permission denied:
curl -s "$URL/rest/v1/projects?select=name" -H "apikey: $KEY"
```

## 7. Seed data

1. Make sure the two users from step 5 exist.
2. Edit `alice_email` / `bob_email` at the top of `seed.sql` if you used other addresses.
3. Run `seed.sql` in the SQL Editor.

It inserts 5 projects (3 for Alice, 2 for Bob) and 6 tasks with fixed IDs; activity rows are
generated by the triggers. Re-running is a no-op. If a user is missing it aborts with
`Seed aborted: no profile for …` and inserts nothing.

---

## Reset (development only)

Deletes all app data (Auth users are kept; their profiles are recreated by re-running 002).

```sql
begin;
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_updated on auth.users;
drop table if exists public.ai_generations, public.activity, public.tasks, public.projects, public.profiles cascade;
drop schema if exists private cascade;
commit;
```

Then re-apply migrations 001–007.

## How the pieces fit

- **Roles:** source of truth is `app_metadata.role` on `auth.users`; `profiles.role` mirrors it.
  The frontend reads the JWT's `app_metadata` (`src/lib/roles.ts`). Users cannot edit either.
- **Ownership:** `projects.owner_id` defaults to `auth.uid()`, so clients insert with just
  `{ name }`. Task access follows the parent project.
- **AI history:** `ai_generations` rows are written by the FastAPI backend with the caller's JWT
  (RLS applies). A `pending` row (streams) can be finalised once; then only delete is allowed.
- **Activity:** written only by `SECURITY DEFINER` triggers in the non-exposed `private` schema,
  so the feed cannot be forged from the client.
- **Verified locally:** all migrations, `seed.sql` and `tests/rls_check.sql` were executed against
  PostgreSQL (PGlite) with a shim of Supabase's `auth` schema, roles and default grants, including
  a negative test where an insecure `using (true)` policy is detected by `rls_check.sql`.
  Run them once on your real project to confirm.
