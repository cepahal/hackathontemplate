# Hackathon Template

A deployable full-stack starter plus an **AI Coding Agent Operating System** for hackathons.
Fork it during events.

| What | Where |
|---|---|
| Frontend (Next.js 16, React 19, TypeScript, Tailwind, Supabase Auth) | [`finalfrontentbackend/frontendFINAL/`](finalfrontentbackend/frontendFINAL/README.md) |
| Backend (FastAPI, Pydantic, Docker; AI + external API adapters) | [`finalfrontentbackend/backendFINAL/`](finalfrontentbackend/backendFINAL/README.md) |
| Database migrations (Supabase Postgres, RLS) | [`finalfrontentbackend/databaseFINAL/`](finalfrontentbackend/databaseFINAL/README.md) |
| App docs: architecture, setup, deployment, env vars, checklist | [`finalfrontentbackend/docs/`](finalfrontentbackend/docs/) |
| CI (lint, typecheck, build, tests, Docker) | [`.github/workflows/hackathon-check.yml`](.github/workflows/hackathon-check.yml) |
| Render Blueprint (backend) | [`render.yaml`](render.yaml) |
| Agent instructions, rules, prompts, training | `AGENTS.md`, `.cursor/rules/`, `prompts/`, `docs/`, `scripts/` |

## Run locally

Requires Node.js ≥ 20.9, Python ≥ 3.11 and a Supabase project with
`finalfrontentbackend/databaseFINAL/migrations/001–007` applied
([setup guide](finalfrontentbackend/docs/SETUP.md)).

```bash
# Backend — http://localhost:8000/api/v1/health
cd finalfrontentbackend/backendFINAL
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env            # SUPABASE_URL, SUPABASE_ANON_KEY, optional AI/API keys
uvicorn app.main:app --reload --port 8000

# Frontend — http://localhost:3000
cd finalfrontentbackend/frontendFINAL
cp .env.example .env.local      # NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_API_URL
npm install
npm run dev
```

## Environment variables

The frontend gets only three **public** `NEXT_PUBLIC_*` values (Supabase URL, publishable key, API URL).
Every secret (service-role key, AI keys, GitHub token, Resend key, webhooks) lives only in the
backend's `.env` or host settings. `.env` files are git-ignored; templates are the `.env.example`
files. Reference: [`finalfrontentbackend/docs/ENVIRONMENT.md`](finalfrontentbackend/docs/ENVIRONMENT.md).

## Authentication

Supabase Auth (email + password) in the browser, with sessions in cookies. The backend verifies the
same JWT and derives the user from it. Roles come from `app_metadata`. Postgres RLS enforces
ownership on every table. Details: [`finalfrontentbackend/docs/ARCHITECTURE.md`](finalfrontentbackend/docs/ARCHITECTURE.md).

## UI templates

The canonical frontend includes a responsive component gallery at `/ui`, a working local workspace at `/ui/workspace`, and a website template at `/ui/website`. Reuse its navbar, sidebar/drawer, footer, cards, skeletons, and loading states. See the [UI library guide](finalfrontentbackend/docs/UI_LIBRARY.md) for examples and [verification record](finalfrontentbackend/docs/UI_VERIFICATION.md) for test scope. The optional [native mobile starter](mobile/README.md) has its own dependency setup.

## Tests

```bash
cd finalfrontentbackend/backendFINAL && python -m pytest && ruff check . && mypy
cd finalfrontentbackend/frontendFINAL && npm run lint && npm run typecheck && npm run build
```

CI runs these on every push and pull request without secrets.

## Deploy

Supabase (database) → Railway or Render (backend `Dockerfile`, or `render.yaml`) → Vercel (Root
Directory `finalfrontentbackend/frontendFINAL`) → set the backend's `FRONTEND_URL` → Supabase redirect URLs.
Step by step: [`finalfrontentbackend/docs/DEPLOYMENT.md`](finalfrontentbackend/docs/DEPLOYMENT.md).
Hackathon-day checklist: [`finalfrontentbackend/docs/HACKATHON_CHECKLIST.md`](finalfrontentbackend/docs/HACKATHON_CHECKLIST.md).

## AI Coding Agent OS

Coding agents are treated as **senior engineering teammates**, not autocomplete.

1. Agents read [`AGENTS.md`](AGENTS.md) (Claude/Codex via [`CLAUDE.md`](CLAUDE.md)); Cursor loads [`.cursor/rules/`](.cursor/rules/).
2. Pick a prompt from [`prompts/`](prompts/) (start with [`prompts/QUICKREF.md`](prompts/QUICKREF.md)).
3. Loop: **INSPECT → UNDERSTAND → PLAN → IMPLEMENT → TEST → REVIEW → POLISH → REPORT**.

```bash
./scripts/hackathon/set-mode.sh 6-12     # declare time pressure (12+ | 6-12 | 2-6 | <2)
./scripts/review/ai-code-review.sh       # bundle the current diff for AI review
./scripts/validate/preflight.sh          # check the app's dependencies and env files
```

| Need | Path |
|---|---|
| Conventions (coding, FE/BE/DB/API, testing, security, git, UI, AI) | [`docs/conventions/`](docs/conventions/) |
| Workflows (loop, debug, review, security, deploy, team, hackathon mode) | [`docs/workflows/`](docs/workflows/) |
| Task brief / handoff templates (PR template: `.github/PULL_REQUEST_TEMPLATE.md`) | [`docs/templates/`](docs/templates/) |
| Training curricula (debugging, web fundamentals, product strategy, hackathon execution) | [`docs/training/`](docs/training/) |
| Parked scope during an event | [`FOLLOWUPS.md`](FOLLOWUPS.md) |

Priority under time pressure: working core flow → reliability → UX → visual polish → testing → security → extras.
