# Architecture Overview

> Update this file whenever the real stack or top-level layout changes.

## Purpose

Reusable hackathon starter + **AI Coding Agent Operating System**.
The application starter implements Next.js, FastAPI and Supabase modules. Original `explanation.txt` folders contain historical intent notes; new implementation belongs in the application paths below. Dated offline evidence and pending hosted acceptance are recorded separately in [the delivery record](../DELIVERY.md).

## Implemented application

- `frontend/src/app/`: workspace, login, landing, chat and health-diagnostic routes.
- `frontend/src/components/`: project CRUD, AI/RAG/vision, agents, billing, integrations and collaboration panels; reusable UI.
- `backend/app/modules/`: identity, AI, integrations, commerce and realtime APIs under `/api/v1`.
- `database/migrations/`: core ownership/RLS/vector schema and transactional billing event persistence.
- `database/tests/`: hosted two-account RLS and billing verification scripts.
- `scripts/check.mjs`: frontend lint/types/tests/build and backend Ruff/pytest/dependency checks.
- `scripts/setup.mjs` and `scripts/preflight.mjs`: shared Windows/macOS/Linux setup and local prerequisite checks, exposed through root npm commands.
- `.github/workflows/checks.yml`: application CI and setup smoke tests on Windows, macOS, and Linux. Hosting configurations target Vercel plus Railway or Render.

User requests validate Supabase bearer identity and preserve user-JWT RLS. Only billing webhook processing uses a backend service-role credential. Provider keys remain server-side. See [deployment](../DEPLOYMENT.md), [integrations](../INTEGRATIONS.md), and [realtime](../REALTIME.md) for account setup and operational limits.

## Top-level layout

```text
AGENTS.md                 # Master instructions for coding agents
.cursor/rules/            # Persistent Cursor rules
docs/                     # Conventions + workflows
prompts/                  # Reusable task prompts
scripts/                  # Review / validate / hackathon helpers
frontend/src/             # Next.js pages, components, HTTP/SSE/Supabase clients
backend/app/              # FastAPI entrypoint, core utilities and feature modules
database/                 # SQL migrations, seed and hosted verification scripts
ai/                       # AI documentation; runtime code is in backend/app/modules/ai/
templates/                # Inactive copy-and-adapt feature/integration starters
```

## Implemented stack

| Layer | Implementation | Notes |
|---|---|---|
| Frontend | Next.js App Router, React, TypeScript, Tailwind | Reuse `frontend/src/components/` and `frontend/src/lib/` |
| Backend | FastAPI, Pydantic, HTTPX | New features use `app/modules/<name>/`; register their router in `app/api/router.py` |
| DB | Supabase Postgres with RLS and pgvector | Versioned SQL in `database/migrations/`; user requests carry their JWT |
| Auth | Supabase email/password and Google | Backend validates identity with Supabase; hosted flow remains an acceptance gate |
| AI | OpenAI, Anthropic and Gemini adapters | Server-side provider calls; supported capabilities are documented in `ai/README.md` |

## Configuration and verification boundaries

`backend/.env.example` documents server settings; `frontend/.env.example` documents public browser
settings. Setup copies them to `backend/.env` and `frontend/.env.local` without overwriting either.
There is no root application environment file. Feature-specific settings live alongside their module;
shared settings live in `backend/app/core/config.py`.

`npm run preflight` checks local prerequisites without printing values or calling providers.
`npm run check` runs offline application checks. Neither proves hosted RLS or real provider behavior.
The first hosted gate is `database/tests/rls.sql` with two distinct real Supabase test accounts, followed
by the Auth/UI and provider workflows described in `database/README.md` and `docs/DELIVERY.md`.

## Principles

1. **Evidence over assumptions** — inspect the repo before inventing patterns
2. **Vertical slices** — ship end-to-end thin features
3. **Stable contracts** — API/DB changes are explicit
4. **Demo path sacred** — under time pressure, protect the happy path

## Decision log

Record significant decisions in `docs/architecture/decision-log.md`.
