# Architecture Overview

> Update this file whenever the real stack or top-level layout changes.

## Purpose

Reusable hackathon starter + **AI Coding Agent Operating System**.
Scaffold folders mark intended feature areas; they are not a finished application until you add real code.

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
