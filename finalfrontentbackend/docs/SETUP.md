# Setup (local development)

Prerequisites: Node.js ≥ 20.9 (CI uses 22), Python ≥ 3.11 (CI and Docker use 3.12), Git, a free
[Supabase](https://supabase.com) account. Docker is optional (only to test the production image).

```bash
git clone <your-repo-url> && cd <repo>/finalfrontentbackend
```

## 1. Create the Supabase project

1. <https://supabase.com/dashboard> → **New project** → choose name, region and a database password
   (store it in a password manager). Wait for provisioning.
2. **Project Settings → Data API**: copy the **Project URL** (`https://<ref>.supabase.co`).
3. **Project Settings → API Keys**: copy the **publishable** key (`sb_publishable_…`) or, on older
   projects, the legacy **anon** key. Do **not** copy the `service_role` / `sb_secret_…` key anywhere
   near the frontend.

## 2. Configure authentication

1. **Authentication → Sign In / Providers → Email**: enable Email.
   - **Confirm email ON**: signup sends a link to `/auth/callback`; it must be opened in the same
     browser. The built-in mailer only delivers to project team members and is rate limited;
     configure custom SMTP (**Authentication → Emails → SMTP Settings**) before real users sign up.
   - **Confirm email OFF** (simplest for a hackathon demo): signup signs in immediately.
2. **Authentication → URL Configuration** (local values; production in step 7):
   - **Site URL**: `http://localhost:3000`
   - **Redirect URLs**: add `http://localhost:3000/auth/callback`

## 3. Apply the migrations

**SQL Editor → New query**: paste and run each file from `databaseFINAL/migrations/` **in order**,
one at a time: `001_extensions.sql`, `002_profiles.sql`, `003_projects.sql`, `004_tasks.sql`,
`005_activity.sql`, `006_rls.sql`, `007_ai_history.sql`. Each runs in a transaction; they are not
re-runnable (see the Reset snippet in [`databaseFINAL/README.md`](../databaseFINAL/README.md)).

Supabase CLI alternative: copy them into `supabase/migrations/` with timestamp prefixes
(`20260101000001_extensions.sql`, …) and run `supabase db push`.

## 4. Verify the schema and RLS

```sql
select tablename, rowsecurity from pg_tables
where schemaname = 'public'
  and tablename in ('profiles', 'projects', 'tasks', 'activity', 'ai_generations');
-- expect 5 rows, all rowsecurity = true
```

After creating two users (step 5), open `databaseFINAL/tests/rls_check.sql`, set `user_a_email` /
`user_b_email`, and run it in the SQL Editor. Success prints `NOTICE: RLS check passed`; everything
is rolled back. An API-level check with two real tokens is in
[`databaseFINAL/README.md` § 6B](../databaseFINAL/README.md#b-through-the-real-api-two-signed-in-users).

## 5. Create test users

Never create users or passwords in SQL files.

1. **Authentication → Users → Add user → Create new user**: e.g. `alice@example.com` with a strong
   throwaway password, tick **Auto Confirm User**. Repeat for `bob@example.com`.
2. Check the profile trigger worked: `select id, email, role from public.profiles;`
3. Optional admin (needed to see `/admin`):

   ```sql
   update auth.users
   set raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'::jsonb
   where email = 'alice@example.com';
   ```

   The user must sign out and in again to get the new role in their JWT.
4. Optional demo data: edit the emails at the top of `databaseFINAL/seed.sql` and run it.

## 6. Run the backend

```bash
cd backendFINAL
python3 -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env        # set SUPABASE_URL, SUPABASE_ANON_KEY; FRONTEND_URL=http://localhost:3000
                            # optional: OPENAI_API_KEY / GEMINI_API_KEY / ... for AI features
uvicorn app.main:app --reload --port 8000
```

Check: `curl http://localhost:8000/api/v1/health` → `{"status":"ok"}`; docs at
<http://localhost:8000/api/v1/docs>. Tests: `python -m pytest` (no network or secrets needed).

## 7. Run the frontend

```bash
cd frontendFINAL
cp .env.example .env.local  # NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
                            # NEXT_PUBLIC_API_URL=http://localhost:8000
npm install
npm run dev                 # http://localhost:3000
```

Check: <http://localhost:3000/api/health> → `{"status":"ok"}`; sign in as a test user → `/dashboard`;
`/settings` → **Backend connection: Connected**; `/ai` lists your configured providers.

Quality gates (same as CI): `npm run lint && npm run typecheck && npm run build`.

## Production URLs (Supabase step 7)

Once the frontend is deployed (see [`DEPLOYMENT.md`](./DEPLOYMENT.md)), go back to
**Authentication → URL Configuration**:

- **Site URL**: `https://<your-app>.vercel.app` (or your custom domain). Email links use it.
- **Redirect URLs**: keep `http://localhost:3000/auth/callback` and add
  `https://<your-app>.vercel.app/auth/callback`. For Vercel preview deployments you can add a
  wildcard such as `https://*-<your-team>.vercel.app/**` (Supabase supports globs here).

## Troubleshooting

| Symptom | Fix |
|---|---|
| Frontend logs `[Supabase config]` | `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` missing in `.env.local`; restart `npm run dev` |
| Backend exits with `Invalid backend configuration` | It lists each problem; fix `backendFINAL/.env` (or the platform's env vars) |
| `/settings` shows backend "Unreachable" | Backend not running, wrong `NEXT_PUBLIC_API_URL`, or `FRONTEND_URL` ≠ the page's origin (CORS) |
| API returns `503 DATABASE_SCHEMA_MISSING` | Migrations not applied (step 3) |
| API returns `401` | Not signed in, token expired, or the backend's `SUPABASE_URL` is a different project |
| AI returns `503 INTEGRATION_NOT_CONFIGURED` | Set that provider's `*_API_KEY` in the backend env and restart |
| "That sign-in link is invalid or has expired" | Opened in a different browser, or the callback URL isn't in Redirect URLs |
