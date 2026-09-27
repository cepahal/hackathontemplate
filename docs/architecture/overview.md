# Architecture Overview

> Update this file whenever the real stack or top-level layout changes.

## Purpose

Reusable hackathon starter + **AI Coding Agent Operating System**.
The application starter now implements Next.js, FastAPI and Supabase modules. Original scaffold folders remain intent markers alongside the implementation. Offline checks pass; hosted service acceptance is tracked separately in [the delivery record](../DELIVERY.md).

## Implemented application

- `frontend/src/app/`: workspace, login, landing, chat and health-diagnostic routes.
- `frontend/src/components/`: project CRUD, AI/RAG/vision, agents, billing, integrations and collaboration panels; reusable UI.
- `backend/app/modules/`: identity, AI, integrations, commerce and realtime APIs under `/api/v1`.
- `database/migrations/`: core ownership/RLS/vector schema and transactional billing event persistence.
- `database/tests/`: hosted two-account RLS and billing verification scripts.
- `scripts/check.mjs`: frontend lint/types/tests/build and backend Ruff/pytest/dependency checks.
- `.github/workflows/checks.yml`: Linux CI. Hosting configurations target Vercel plus Railway or Render.

User requests validate Supabase bearer identity and preserve user-JWT RLS. Only billing webhook processing uses a backend service-role credential. Provider keys remain server-side. See [deployment](../DEPLOYMENT.md), [integrations](../INTEGRATIONS.md), and [realtime](../REALTIME.md) for account setup and operational limits.

## Top-level layout

```text
AGENTS.md                 # Master instructions for coding agents
.cursor/rules/            # Persistent Cursor rules
docs/                     # Conventions + workflows
prompts/                  # Reusable task prompts
scripts/                  # Review / validate / hackathon helpers
frontend/                 # UI scaffolds (navbar, forms, dashboard, …)
backend/                  # API / auth / data-access scaffolds
database/                 # Schema / Supabase notes
ai/                       # LLM wrapper / embeddings / structured output scaffolds
```

## Default stack (when not yet chosen)

| Layer | Default lean choice | Notes |
|---|---|---|
| Frontend | React / Next.js + TypeScript | Prefer existing components |
| Backend | FastAPI or Next route handlers | Match what the team actually adds |
| DB | Supabase / Postgres | Migrations over ad-hoc SQL in app code |
| Auth | OAuth (e.g. Google) via provider | Never roll crypto yourself in a hackathon |
| AI | Server-side wrappers | Keys never in the client |

## Principles

1. **Evidence over assumptions** — inspect the repo before inventing patterns
2. **Vertical slices** — ship end-to-end thin features
3. **Stable contracts** — API/DB changes are explicit
4. **Demo path sacred** — under time pressure, protect the happy path

## Decision log

Record significant decisions in `docs/architecture/decision-log.md`.
