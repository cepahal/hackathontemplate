# Hackathon Checklist

Copy this into an issue or your notes and tick items off. Commands are run from
`finalfrontentbackend/`. Details: [`SETUP.md`](./SETUP.md), [`DEPLOYMENT.md`](./DEPLOYMENT.md).

## BEFORE HACKATHON

- [ ] **Clone repo** — `git clone <repo> && cd <repo>/finalfrontentbackend`; confirm `node -v` ≥ 20.9 and `python3 -V` ≥ 3.11.
- [ ] **Install dependencies**
  - `cd frontendFINAL && npm install`
  - `cd backendFINAL && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements-dev.txt`
- [ ] **Create Supabase project** — SETUP step 1; copy the Project URL and publishable key into
      `frontendFINAL/.env.local` and `backendFINAL/.env`.
- [ ] **Configure auth** — Email provider on; decide on email confirmation (off is simplest for a demo);
      Site URL `http://localhost:3000`; Redirect URL `http://localhost:3000/auth/callback`.
- [ ] **Verify database** — run migrations 001–007 in order; the `pg_tables` query shows 5 tables
      with RLS on; `tests/rls_check.sql` prints `RLS check passed`.
- [ ] **Verify local frontend** — `npm run dev`; <http://localhost:3000/api/health> → `{"status":"ok"}`;
      `npm run lint && npm run typecheck && npm run build` pass.
- [ ] **Verify local backend** — `uvicorn app.main:app --reload --port 8000`;
      `curl localhost:8000/api/v1/health` → `{"status":"ok"}`; `python -m pytest` passes.
- [ ] **Verify authentication** — create two test users (Auto Confirm); log in → `/dashboard`;
      refresh keeps you signed in; log out → `/login`; non-admin on `/admin` → `/forbidden`.
- [ ] **Verify CRUD** — `/settings` shows **Backend connection: Connected**; create/list a project with
      the curl snippet in `backendFINAL/README.md` ("Manual end-to-end check") or via `backendApi`;
      the second user cannot see it.
- [ ] **Verify AI integration** — set at least one `*_API_KEY` in `backendFINAL/.env`; `/ai` lists the
      provider as configured; a prompt streams a real response and appears in history.
- [ ] **Verify deployment** — deploy backend (Railway/Render) and frontend (Vercel) once, set
      `FRONTEND_URL` and the Supabase production URLs, run the smoke test in DEPLOYMENT § 6.
      Delete or reuse these deployments on the day.

## DURING HACKATHON

- [ ] **Create branch** — `git switch -c feat/<idea>`; keep `main` deployable.
- [ ] **Choose idea** — one sentence: who it's for and the problem it solves.
- [ ] **Define MVP** — the 1–3 features the demo cannot exist without; write everything else under "later".
- [ ] **Define core user flow** — e.g. sign in → create X → AI does Y → see result. This is the demo script.
- [ ] **Define database schema** — add `databaseFINAL/migrations/008_<name>.sql` with RLS policies
      modelled on `003_projects.sql`/`006_rls.sql` (`owner_id default auth.uid()`); update
      `frontendFINAL/src/types/database.ts`; run it in the SQL Editor.
- [ ] **Implement core feature** — backend module in `backendFINAL/app/modules/<name>/`
      (router → service → db, Pydantic schemas with `extra="forbid"`), a test next to
      `tests/test_projects.py`, then the page/components in `frontendFINAL` via `api`/`backendApi`.
      Replace the dashboard's mock data with real calls.
- [ ] **Integrate APIs** — reuse `app/ai/` and `app/integrations/`; add keys to the backend env only.
- [ ] **Test** — `python -m pytest`, `npm run lint && npm run typecheck`; click through the core flow.
- [ ] **Deploy** — push; CI green; Vercel/Railway/Render redeploy automatically; re-run the smoke test.
      Deploy early and every few hours, not only at the end.
- [ ] **Polish UI** — loading/empty/error states on the core flow (`Skeleton`, `EmptyState`,
      `ErrorState`), app name and colours in `src/lib/constants.ts` / `globals.css`, logo.
- [ ] **Prepare demo** — script the core flow, seed realistic data, note the test account.

## FINAL HOUR

Architecture freeze: fix blockers only.

- [ ] **Production build** — `npm run build` passes locally; the latest CI run is green.
- [ ] **Production URL** — the Vercel URL loads; `/api/health` and the backend `/api/v1/health` return ok.
- [ ] **Test login** — sign in on the production URL with the demo account (and sign up, if you'll show it).
- [ ] **Test core flow** — run the full demo script on production, start to finish.
- [ ] **Test on another device** — a phone or a teammate's laptop, on a different network.
- [ ] **Remove console errors** — browser DevTools console is clean on every demo page.
- [ ] **Remove debug data** — test projects, "asdf" rows, debug `console.log`s, placeholder text.
- [ ] **Verify environment variables** — Vercel has only the three `NEXT_PUBLIC_*` values; the backend
      has `ENVIRONMENT=production`, the right `FRONTEND_URL`, and the AI keys the demo needs;
      nothing secret is in git (`git ls-files | grep -E '\.env($|\.)'` shows only `.env.example`).
- [ ] **Record backup demo** — a 2–3 minute screen recording of the core flow, saved offline.
- [ ] **Prepare presentation** — problem, demo, how it works (architecture slide from
      `docs/ARCHITECTURE.md`), what's next. Wake the backend (`/api/v1/health`) right before presenting.
