# Deployment

```text
GitHub ─► Vercel          ─► frontendFINAL   (Next.js)
       ─► Railway/Render  ─► backendFINAL    (Docker, FastAPI)
          Supabase        ─► databaseFINAL   (Postgres, Auth, RLS)
```

**Paths.** Hosting dashboards want paths relative to the repository root, so they include
`finalfrontentbackend/` (e.g. Vercel Root Directory `finalfrontentbackend/frontendFINAL`). Shell
commands below are run from `finalfrontentbackend/`.

**Order matters**, because the frontend bakes in the backend URL and the backend allows exactly one
frontend origin:

1. Supabase project + migrations + test user ([`SETUP.md`](./SETUP.md) steps 1–5)
2. Backend → get its public URL
3. Frontend with `NEXT_PUBLIC_API_URL` = backend URL → get its public URL
4. Backend `FRONTEND_URL` = frontend URL → redeploy backend
5. Supabase Site URL / Redirect URLs = frontend URL
6. Smoke test (bottom of this page)

---

## 1. Database — Supabase

Follow [`SETUP.md`](./SETUP.md) steps 1–5 against the project you will demo with. A free project
pauses after a week of inactivity; open the dashboard the day before the demo.

## 2. Backend — Railway (option A)

Files used: `backendFINAL/Dockerfile`, `backendFINAL/.dockerignore`. No `railway.json` is included:
Railway's config-as-code is being retired, so configure it in the dashboard.

1. <https://railway.com> → **New Project → Deploy from GitHub repo** → pick the repo.
2. Service → **Settings → Source → Root Directory**: `/finalfrontentbackend/backendFINAL`. Railway
   finds the `Dockerfile` there and builds it. Optional **Watch Paths**: `/finalfrontentbackend/backendFINAL/**`.
3. **Settings → Deploy → Healthcheck Path**: `/api/v1/health`.
4. **Variables** (RAW editor) — see [`ENVIRONMENT.md`](./ENVIRONMENT.md#backend):

   ```bash
   ENVIRONMENT=production
   SUPABASE_URL=https://<ref>.supabase.co
   SUPABASE_ANON_KEY=sb_publishable_...
   FRONTEND_URL=https://<your-app>.vercel.app   # placeholder until step 3; update after
   OPENAI_API_KEY=...                            # any AI/integration keys you use
   ```

   Do not set `PORT`; Railway injects it and the container listens on it.
5. **Settings → Networking → Generate Domain** → `https://<service>.up.railway.app`.
6. Check: `curl https://<service>.up.railway.app/api/v1/health` → `{"status":"ok"}`.

## 2. Backend — Render (option B)

Files used: `render.yaml` at the repository root (Blueprint), `backendFINAL/Dockerfile`.

1. <https://dashboard.render.com> → **New → Blueprint** → pick the repo. Render reads the root
   `render.yaml` (Docker build of `finalfrontentbackend/backendFINAL`, redeploys only when that folder changes).
2. It prompts for every `sync: false` variable (`SUPABASE_URL`, `SUPABASE_ANON_KEY`,
   `FRONTEND_URL`, `CORS_ORIGINS`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `GITHUB_TOKEN`). Leave unused
   ones blank. Add others later under **Environment**.
3. Render injects `PORT` (10000), builds the Dockerfile and health-checks `/api/v1/health`.

Without the Blueprint: **New → Web Service** → repo → Language **Docker**, Root Directory
`finalfrontentbackend/backendFINAL`, Health Check Path `/api/v1/health`, env vars as above.

The free plan sleeps after ~15 minutes idle and takes up to a minute to wake. Before the demo, open
`/api/v1/health` or point an uptime monitor at it (GET and HEAD both return 200).

## 2b. Backend — any Docker host

```bash
docker build -t hackathon-backend backendFINAL
docker run --rm -p 8000:8000 --env-file backendFINAL/.env -e ENVIRONMENT=production hackathon-backend
curl localhost:8000/api/v1/health
```

The image: Python 3.12-slim, runtime dependencies only, non-root user (UID 10001), listens on
`$PORT` (default 8000), `ENVIRONMENT=production` by default, `WEB_CONCURRENCY=1` uvicorn worker,
Docker `HEALTHCHECK` on `/api/v1/health`. No `.env` or tests are copied into it. `--env-file` takes
`KEY=value` lines literally (no quotes, no inline comments), which `backendFINAL/.env.example` follows.

Keep `WEB_CONCURRENCY=1` on small instances: each worker has its own in-memory rate limiter.

## 3. Frontend — Vercel

No `vercel.json` is needed; Vercel detects Next.js.

1. <https://vercel.com/new> → import the repo.
2. **Root Directory**: `finalfrontentbackend/frontendFINAL`. Framework preset: **Next.js** (auto). Build command
   `npm run build`, install command `npm install` (auto-detected from `package-lock.json`),
   output: default. **Settings → Build and Deployment → Node.js Version**: 22.x.
3. **Environment Variables** (Production **and** Preview):

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | publishable / anon key |
   | `NEXT_PUBLIC_API_URL` | backend URL from step 2, no trailing slash |

   These are inlined at **build time**: after changing one, **redeploy**. Never add the service-role
   key, AI keys or any other secret here; the frontend does not need them.
4. Deploy → `https://<your-app>.vercel.app`. Check `https://<your-app>.vercel.app/api/health`.

## 4. Point the backend at the frontend (CORS)

Set the backend's `FRONTEND_URL=https://<your-app>.vercel.app` (exact origin: scheme + host, no
path, no trailing slash) and redeploy/restart. Extra origins (custom domain, a fixed preview alias
such as `https://<project>-git-<branch>-<team>.vercel.app`) go in `CORS_ORIGINS`, comma-separated.
Wildcards are rejected at startup, so per-deployment preview URLs cannot call the API unless listed.

## 5. Supabase production URLs

**Authentication → URL Configuration**:

- **Site URL**: `https://<your-app>.vercel.app`
- **Redirect URLs**: `https://<your-app>.vercel.app/auth/callback` (keep the localhost entry for
  development; optional preview glob `https://*-<team>.vercel.app/**`)

If email confirmation is on for real users, configure custom SMTP first.

## 6. Production smoke test

```bash
API=https://<backend-host>; WEB=https://<your-app>.vercel.app
curl -s $API/api/v1/health                               # {"status":"ok"}
curl -s -o /dev/null -w '%{http_code}\n' $API/api/v1/docs  # 404 (docs off in production)
curl -s -o /dev/null -w '%{http_code}\n' $API/api/v1/me    # 401 without a token
curl -s $WEB/api/health                                  # {"status":"ok"}
```

Then in a browser: sign in → `/dashboard`; refresh (still signed in); `/settings` shows
**Backend connection: Connected**; `/ai` generates a response with a configured provider; sign out
→ `/login`; a non-admin visiting `/admin` lands on `/forbidden`.

---

## CI — `.github/workflows/hackathon-check.yml` (repository root)

Runs on every push and pull request, with no secrets (placeholders + mocks):

| Job | Steps |
|---|---|
| `hygiene` | fails if any `.env` file is tracked, or a secret-looking variable uses the `NEXT_PUBLIC_` prefix |
| `frontend` | Node 22: `npm ci`, `npm run lint`, `npm run typecheck`, `npm run build` |
| `backend` | Python 3.12: `pip install -r requirements-dev.txt`, `compileall`, `ruff check`, `ruff format --check`, `mypy`, `pytest`, then starts uvicorn in production mode and probes `/api/v1/health` (and that docs are 404) |
| `docker` | `docker build` of `backendFINAL`, runs it with `PORT=8080`, probes `/api/v1/health`, asserts the container is non-root and has no `.env` |

The workflow lives at the repository root (`.github/workflows/`) because that is the only place
GitHub runs workflows from.

Vercel, Railway and Render deploy from GitHub on their own; CI does not deploy. Turn on branch
protection requiring `hackathon-check` if you want failing checks to block merges.

---

## What has been verified where

**Verified locally** (clean copy without `node_modules`, `.venv` or `.env` files):

- Frontend: `npm ci`, lint, typecheck and production build on Node 22 with placeholder public
  variables; `npm start` serves `/api/health`, `/login`, and redirects `/dashboard` to `/login`.
- Backend on Python 3.12: compileall, ruff, mypy and the full pytest suite; the Dockerfile's exact
  `CMD` run with only runtime dependencies and only `app/` (as the image copies it): health 200,
  HEAD 200, docs 404, AI routes 401 without a token, the `HEALTHCHECK` command exits 0.
- Workflow linted with `actionlint`; `render.yaml` parses.

**Requires cloud or user configuration (not verified here):**

- `docker build` itself (Docker was not available locally; the CI `docker` job builds and runs it).
- GitHub Actions actually running (runs once these changes are pushed to GitHub).
- Vercel, Railway and Render deployments, domains, and their environment variables.
- Supabase: applying migrations, auth URL configuration, creating test users, RLS check on the
  real project, real sign-in through the deployed frontend.
- Real AI / GitHub / email / maps calls in production (need your API keys and credits).
