# Hackathon Full-Stack Starter

A product-agnostic starter for shipping a real, deployed full-stack app in a weekend:
Next.js frontend, FastAPI backend, Supabase (Postgres + Auth + RLS), multi-provider AI, external
API adapters, Docker, CI and deployment configs. Clone it, rename it, build your idea on top.

```text
Browser ──► Next.js (Vercel) ──► FastAPI (Railway/Render) ──► Supabase (Postgres + RLS)
   │              │                                              ▲
   └── Supabase Auth (sign in, session cookies) ─────────────────┘

Next.js ──► FastAPI AI / API adapters ──► External services
                (keys stay server-side)     OpenAI · Gemini · Anthropic · xAI Grok
                                            GitHub · Mapbox/Google · Resend · Slack/Discord
```

```text
finalfrontentbackend/
├── frontendFINAL/                  Next.js 16 + React 19 + TypeScript + Tailwind 4
├── backendFINAL/                   FastAPI + Pydantic, Dockerfile, pytest suite
├── databaseFINAL/                  SQL migrations 001–007, RLS, seed, RLS test
├── docs/
│   ├── ARCHITECTURE.md             components, auth, security boundaries
│   ├── SETUP.md                    local setup + Supabase configuration
│   ├── DEPLOYMENT.md               Vercel, Railway, Render, CI
│   ├── ENVIRONMENT.md              every variable, public vs secret
│   └── HACKATHON_CHECKLIST.md      before / during / final hour
├── .env.example                    all variables, FRONTEND PUBLIC vs BACKEND SECRET
└── README.md
```

CI ([`../.github/workflows/hackathon-check.yml`](../.github/workflows/hackathon-check.yml)) and the
Render Blueprint ([`../render.yaml`](../render.yaml)) sit at the repository root, the only place
GitHub and Render read them from.

## Quick start

```bash
# 1. Database: create a Supabase project, run databaseFINAL/migrations/001–007 in the SQL Editor
#    (docs/SETUP.md steps 1–5)

# 2. Backend
cd backendFINAL
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env                       # SUPABASE_URL, SUPABASE_ANON_KEY (+ optional AI keys)
uvicorn app.main:app --reload --port 8000  # http://localhost:8000/api/v1/health

# 3. Frontend (new terminal)
cd frontendFINAL
cp .env.example .env.local                 # NEXT_PUBLIC_SUPABASE_URL, _ANON_KEY, NEXT_PUBLIC_API_URL
npm install
npm run dev                                # http://localhost:3000
```

## Frontend

`frontendFINAL/` — Next.js App Router with a UI kit (`components/ui`), auth-aware layout, dashboard,
settings, admin and AI playground pages. `src/lib/api.ts` is a typed fetch wrapper that attaches the
user's Supabase token to backend calls. Only three public build-time variables. The dashboard ships
with demo data (`src/lib/mock-data.ts`) to replace with real calls.
→ [`frontendFINAL/README.md`](frontendFINAL/README.md)

## Backend

`backendFINAL/` — FastAPI under `/api/v1`: health, profile, projects/tasks CRUD, AI, integrations.
Modules follow router → service → db; Pydantic validates every request and rejects unknown fields;
errors share one JSON envelope with a request ID. Production runs the `Dockerfile` (non-root, `$PORT`).
→ [`backendFINAL/README.md`](backendFINAL/README.md)

## Database

`databaseFINAL/` — Supabase Postgres: `profiles`, `projects`, `tasks`, `activity`, `ai_generations`,
all with Row Level Security. Profiles are created by a trigger on sign-up; activity is written by
triggers only. `tests/rls_check.sql` proves users cannot touch each other's data.
→ [`databaseFINAL/README.md`](databaseFINAL/README.md)

## Authentication

Supabase Auth with email + password (optional email confirmation via `/auth/callback`). Sessions live
in cookies (`@supabase/ssr`), are refreshed by `src/proxy.ts`, and protected pages re-check on the
server. The backend verifies the same JWT against Supabase's public keys and takes the user ID only
from the verified token.

## Authorization

Roles (`user`, `admin`) come from `app_metadata`, which users cannot edit. Enforced three times:
Next.js (`requireRole`), FastAPI (`require_role` + ownership checks), and Postgres RLS (every query
runs with the caller's JWT). Hiding a link is never treated as access control.

## AI

`/api/v1/ai/*` — generate, structured output (Pydantic-validated), Server-Sent-Event streaming, image
and file analysis, per-user history. Providers: OpenAI, Gemini, Anthropic, xAI Grok; clients may choose
a configured provider, never a model. Prompt, output, upload size and rate limits are enforced
server-side. → [`backendFINAL/app/ai/README.md`](backendFINAL/app/ai/README.md)

## External APIs

`backendFINAL/app/integrations/` — GitHub, geocoding, email (Resend), Slack/Discord webhooks behind one
HTTP client with timeouts, error mapping and per-user rate limits. Fixed provider hosts only (no
arbitrary URL fetching); missing keys return `503 INTEGRATION_NOT_CONFIGURED`.
→ [`backendFINAL/app/integrations/README.md`](backendFINAL/app/integrations/README.md)

## Deployment

| Part | Platform | Config in this repo |
|---|---|---|
| Frontend | Vercel (Root Directory `finalfrontentbackend/frontendFINAL`) | auto-detected Next.js; env vars in the dashboard |
| Backend | Railway or Render | `backendFINAL/Dockerfile`, root `render.yaml` |
| Database | Supabase | `databaseFINAL/migrations/` |

Order: Supabase → backend → frontend → set backend `FRONTEND_URL` → Supabase redirect URLs.
→ [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)

## Testing

```bash
cd backendFINAL && python -m pytest                 # Supabase and all external APIs mocked
cd backendFINAL && ruff check . && ruff format --check . && mypy
cd frontendFINAL && npm run lint && npm run typecheck && npm run build
```

CI (`.github/workflows/hackathon-check.yml` at the repository root) runs all of the above on every push and pull request,
plus a production-mode startup check, a Docker build/run check and a secrets hygiene check. It needs
no secrets.

## Environment variables

| Side | Variables | Visibility |
|---|---|---|
| Frontend | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL` | **Public** (in the browser bundle) |
| Backend | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `FRONTEND_URL` (required); `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `GROK_API_KEY`, `GITHUB_TOKEN`, `MAPS_API_KEY`, `RESEND_API_KEY`, … (optional) | **Secret** (server only) |

Never give a secret the `NEXT_PUBLIC_` prefix. Full reference: [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md),
template: [`.env.example`](.env.example).

## Hackathon day

[`docs/HACKATHON_CHECKLIST.md`](docs/HACKATHON_CHECKLIST.md) — before, during, and the final hour.
