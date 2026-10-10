# Architecture

Optional hackathon APIs are documented in [API_SETUP.md](API_SETUP.md). Gemini uses the existing
AI provider boundary. Snowflake SQL REST and Tiger Data PostgreSQL are independent, server-only
registry adapters; neither replaces Supabase auth or application storage. Photon Spectrum runs
as a separate Node 24 service with bounded optional Gemini text replies. No startup migrations,
cross-database replication, or public arbitrary-SQL endpoint are added.

## HackNC local tooling

Repository-root `package.json` and `scripts/hacknc/` provide environment-preserving setup,
configuration checks, and loopback development commands for the canonical app. The optional
`services/photon/` is an independent Node 24 process using Spectrum for terminal development
and managed iMessage. It uses optional bounded Gemini text replies and an explicit fixed reply
when Gemini is unconfigured; it has no connection to FastAPI. See [API_SETUP.md](API_SETUP.md)
and the service README.

When both public Supabase values are absent, the frontend renders public previews signed out;
protected pages still redirect to login. Partial configuration and secret/service-role public
keys still fail validation. Configured projects retain the normal session-refresh path.

## Reusable UI templates

`frontendFINAL/src/components/layout/` supplies the auth-aware global navbar, shared footer, page container, app/website shells, and responsive navigation drawers. `src/components/ui/` remains the single component system; the new templates reuse its uppercase component APIs and semantic design tokens. `/ui`, `/ui/workspace`, and `/ui/website` are public previews under the existing root chrome, with one main landmark per route. The workspace preview uses in-memory example projects and does not call the backend. Protected application routes retain the existing proxy and server authorization checks.

The optional Expo app under repository-root `mobile/` is a separate native UI starter, with its own React Native dependency versions. It is not a second web or backend implementation. See [UI_LIBRARY.md](UI_LIBRARY.md).

Three deployable parts, each with its own README:

| Part | Folder | Runtime | Hosted on |
|---|---|---|---|
| Frontend | [`frontendFINAL/`](../frontendFINAL/README.md) | Next.js 16 (App Router) + React 19 + TypeScript | Vercel |
| Backend | [`backendFINAL/`](../backendFINAL/README.md) | FastAPI + Pydantic on Python 3.12 (Docker) | Railway or Render |
| Database | [`databaseFINAL/`](../databaseFINAL/README.md) | Postgres + Auth + RLS | Supabase |

```text
                    ┌──────────────────────────── Supabase ───────────────────────────┐
                    │  Auth (users, sessions, JWKS)      Postgres + RLS (PostgREST)   │
                    └──────▲──────────────────────────────────────▲───────────────────┘
         sign in / refresh │                                      │ user's JWT → RLS
                           │                                      │
┌─────────┐  HTML, RSC  ┌──┴─────────────────┐  Bearer JWT   ┌────┴──────────────────┐   API keys   ┌───────────────┐
│ Browser │ ──────────► │ Next.js (Vercel)   │ ────────────► │ FastAPI (Docker)      │ ───────────► │ OpenAI, Gemini│
│         │ ◄────────── │ proxy.ts, pages,   │ ◄──────────── │ /api/v1: projects,    │ ◄─────────── │ Anthropic, xAI│
└─────────┘   cookies   │ lib/api.ts, ai.ts  │  JSON / SSE   │ tasks, ai, integr.    │              │ GitHub, maps, │
                        └────────────────────┘               └───────────────────────┘              │ Resend, hooks │
                                                                                                    └───────────────┘
```

## Frontend (`frontendFINAL`)

- **Pages** live in `src/app/` (`/`, `/login`, `/signup`, `/auth/callback`, `/dashboard`, `/settings`,
  `/admin`, `/ai`, `/forbidden`, `/api/health`).
- **Supabase is used directly only for authentication** (sign up, sign in, sign out, session refresh,
  display-name update). Application data goes through the backend.
- **Backend calls** use the typed wrapper `src/lib/api.ts` (`api`, `backendApi`) and `src/lib/ai.ts`.
  It attaches the signed-in user's access token, accepts only relative paths (tokens cannot leak to
  other origins), applies timeouts and normalises errors into `ApiRequestError`.
- **Configuration** is three public build-time variables (`NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL`). `src/lib/supabase/config.ts` refuses a
  secret/service-role key in the public variable.
- The dashboard still renders demo data from `src/lib/mock-data.ts`; replacing it with
  `backendApi.projects.list()` is the first product task.

## Backend (`backendFINAL`)

- `app/main.py` → `create_app()`: settings validation, middleware (request ID, access log,
  body-size limits, JSON 500s, CORS), routers under `/api/v1`.
- Each module (`app/modules/<name>/`) is `router.py` (HTTP only) → `service.py` (rules, ownership)
  → `app/db/supabase.py` (PostgREST over httpx). Pydantic models reject unknown fields, so clients
  cannot inject `owner_id` or `project_id`.
- `GET|HEAD /api/v1/health` is a liveness probe used by Docker, Railway and Render. It does not
  check Supabase.
- Production image: `backendFINAL/Dockerfile` (Python 3.12-slim, non-root UID 10001, binds `$PORT`,
  `ENVIRONMENT=production` hides `/api/v1/docs`).

## Database (`databaseFINAL`)

- Tables: `profiles`, `projects`, `tasks`, `activity`, `ai_generations` (migrations 001–007).
- Every table has RLS enabled. Projects/tasks/AI history are owner-scoped; `activity` is written
  only by `SECURITY DEFINER` triggers in the non-exposed `private` schema.
- `profiles` rows are created by a trigger on `auth.users`; `profiles.role` mirrors
  `auth.users.raw_app_meta_data.role`.

## Authentication (who are you?)

1. The browser signs in with Supabase Auth (email + password, optional email confirmation via
   `/auth/callback`). `@supabase/ssr` stores the session in cookies.
2. `src/proxy.ts` refreshes the session on every page request and redirects signed-out users away
   from protected pages; pages re-check on the server with `requireUser()` / `requireRole()`.
3. Requests to FastAPI carry `Authorization: Bearer <access token>`. The backend verifies the
   signature against the project's public JWKS (or `SUPABASE_JWT_SECRET` for legacy HS256 projects),
   the `authenticated` audience and expiry. The user ID always comes from the verified token, never
   from request bodies or query strings.

## Authorization (what may you do?)

Authentication is not authorization; three layers enforce it independently:

| Layer | Enforces |
|---|---|
| Next.js | `requireRole("admin")` for `/admin`; nav links are hidden by role (UI hint only) |
| FastAPI | `require_role` dependency for role-gated routes; services check ownership and return 404 for other users' rows |
| Postgres RLS | Every query runs with the caller's JWT (`SUPABASE_ANON_KEY` + user token), so even a backend bug cannot read or write another user's rows |

Roles (`user`, `admin`) live in `app_metadata`, which only the service role can change, so users
cannot promote themselves. The service-role key is not used by any route.

## AI

- `app/ai/` holds the service, provider adapters (OpenAI, Gemini, Anthropic, xAI Grok), prompt
  templates, streaming (Server-Sent Events), file/image handling and history persistence.
- Routes: `/api/v1/ai/{providers,generate,structured,stream,analyze-image,analyze-file,history}`.
- Clients may pick a **configured** provider but never a model; models come from `*_MODEL` env vars.
- Limits: prompt/context characters, output tokens, upload size and type, stream timeout,
  per-user rate limit, separate JSON vs multipart body-size limits.
- Model output is treated as untrusted text: the frontend renders it as Markdown without raw HTML.
- History rows are written with the caller's JWT, so RLS scopes them to their owner.

Details: [`backendFINAL/app/ai/README.md`](../backendFINAL/app/ai/README.md).

## External integrations

- `app/integrations/`: GitHub, geocoding (Mapbox/Google), email (Resend), Slack/Discord webhooks,
  plus thin AI clients, behind one shared httpx client with timeouts and error mapping.
- Each adapter talks to a **fixed provider base URL**; webhook URLs must match the official
  Slack/Discord prefixes. No endpoint fetches arbitrary user-supplied URLs (SSRF protection).
- Unconfigured integrations return `503 INTEGRATION_NOT_CONFIGURED` naming the missing variable;
  `GET /api/v1/integrations/status` reports which ones have keys (booleans only).

Details: [`backendFINAL/app/integrations/README.md`](../backendFINAL/app/integrations/README.md).

## Deployment

```text
GitHub ──push──► GitHub Actions (hackathon-check.yml: lint, typecheck, build, tests, Docker smoke)
   │
   ├──► Vercel          frontendFINAL    (Root Directory = finalfrontentbackend/frontendFINAL)
   ├──► Railway/Render  backendFINAL     (Dockerfile; Render can use the root render.yaml)
   └──  Supabase        databaseFINAL    (migrations applied in the SQL Editor)
```

Step by step: [`DEPLOYMENT.md`](./DEPLOYMENT.md).

## Security boundaries

| Boundary | Rule |
|---|---|
| Browser ↔ everything | Only `NEXT_PUBLIC_*` values reach the browser. They must be public (URL, publishable key, API URL). CI fails if a secret-looking name gets the prefix. |
| Frontend ↔ backend | Bearer JWT only; CORS allows exactly `FRONTEND_URL` + `CORS_ORIGINS` (wildcards rejected at startup); no cookies cross origins. |
| Backend ↔ Supabase | Publishable key + the caller's JWT, so RLS applies. The service-role key is not used by any route. |
| Backend ↔ providers | API keys only in backend env vars (`SecretStr`, never logged or returned). Fixed hosts, timeouts, per-user rate limits. |
| Repository / image | `.env*` git-ignored and excluded from the Docker build context; CI fails if one is tracked; the image runs as a non-root user and has no secrets baked in. |
| Logs | Request IDs and status codes; no Authorization headers, keys or prompt bodies. |

Known limits: rate limiting is in-memory per process (it resets on restart and multiplies with
`WEB_CONCURRENCY`); `/health` is liveness only; uvicorn trusts `X-Forwarded-*` from any proxy
(acceptable behind Railway/Render, where the container is not directly reachable).
