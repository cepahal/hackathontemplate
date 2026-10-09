# Architecture Overview

> Update this file whenever the top-level layout changes.

## Purpose

Reusable hackathon starter + **AI Coding Agent Operating System**.

- The application is in `finalfrontentbackend/`. Its architecture, auth model and security
  boundaries are documented in
  [`finalfrontentbackend/docs/ARCHITECTURE.md`](../../finalfrontentbackend/docs/ARCHITECTURE.md).
- Everything else in the repository is the agent operating system and training material.

## Top-level layout

```text
finalfrontentbackend/     # The app: frontendFINAL (Next.js), backendFINAL (FastAPI), databaseFINAL (Supabase SQL), docs/
.github/workflows/        # hackathon-check.yml — CI for the app
render.yaml               # Render Blueprint for the backend
AGENTS.md                 # Master instructions for coding agents (CLAUDE.md points here)
.cursor/rules/            # Persistent Cursor rules
docs/                     # Agent conventions, workflows, templates, training curricula
prompts/                  # Reusable task prompts
scripts/                  # Review / validate / hackathon-mode helpers
```

## Stack

| Layer | Choice | Where |
|---|---|---|
| Frontend | Next.js 16 + React 19 + TypeScript + Tailwind 4 | `finalfrontentbackend/frontendFINAL/` |
| Backend | FastAPI + Pydantic (Python 3.12, Docker) | `finalfrontentbackend/backendFINAL/` |
| DB | Supabase Postgres, RLS on every table | `finalfrontentbackend/databaseFINAL/migrations/` |
| Auth | Supabase Auth (email/password), JWT verified by the backend | frontend `src/lib/supabase/`, backend `app/core/security.py` |
| AI | Server-side provider adapters (OpenAI, Gemini, Anthropic, xAI) | `finalfrontentbackend/backendFINAL/app/ai/` |
| Hosting | Vercel (frontend), Railway or Render (backend), Supabase | `finalfrontentbackend/docs/DEPLOYMENT.md` |

## Principles

1. **Evidence over assumptions** — inspect the repo before inventing patterns
2. **Vertical slices** — ship end-to-end thin features
3. **Stable contracts** — API/DB changes are explicit
4. **Demo path sacred** — under time pressure, protect the happy path

## Decision log

Record significant decisions in `docs/architecture/decision-log.md`.
