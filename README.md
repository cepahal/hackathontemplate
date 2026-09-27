# Hackathon starter

Reusable Next.js / TypeScript / Tailwind frontend, FastAPI API, and Supabase database starter. The nine areas are reviewed sequentially using [docs/DELIVERY.md](docs/DELIVERY.md). Provider credentials, hosted database execution, and deployment verification are separate acceptance gates.

## Begin here

1. Read the [delivery record](docs/DELIVERY.md) for implemented behavior and remaining checks.
2. Run `npm.cmd run setup` from this folder. Requires Node 22.19+ and Python 3.11+; setup also discovers Codex's bundled Python. Existing environment files are preserved.
3. Follow [database setup](database/README.md): create Supabase, apply migrations in order, create test accounts, and run the two-account access-control verification before storing real data.
4. Fill `frontend/.env.local` and `backend/.env` using their examples. Never put service-role or provider secrets in `NEXT_PUBLIC_` variables.
5. Run `npm.cmd run check` for lint, types, production build and offline tests. It does not start a preview.
6. Follow [deployment instructions](docs/DEPLOYMENT.md) for Vercel and Railway/Render when your accounts are ready.

No preview starts automatically. Optional development commands are `npm.cmd run dev`, `dev:frontend`, and `dev:backend`; they bind to loopback. Stop development servers before setup/checks. Current delivery uses files, builds and in-process tests with no application server left running.

## Nine areas

| # | Area | Implementation |
| --- | --- | --- |
| 1 | Full-stack + database | Project CRUD, typed API, schema, migrations, seeds, RLS and membership |
| 2 | Deployment + DevOps | Docker, Render/Railway config, GitHub Actions, Vercel release instructions |
| 3 | Authentication + security | Email/password, Google, sessions, validated identity and roles |
| 4 | AI infrastructure | OpenAI/Anthropic/Gemini text, SSE, structured responses, vision; OpenAI/Gemini embeddings |
| 5 | Agents + RAG | Text ingestion, retrieval/citations, persisted bounded agents, approval-gated writes |
| 6 | UI system | Reusable components; workspace, landing and chat layouts |
| 7 | External APIs | GitHub, Maps, Discord, Slack, Twilio, Spotify and YouTube adapters |
| 8 | Payments + events | Stripe checkout/portal, subscription/order state, signed deduplicated webhooks |
| 9 | Multimodal + realtime | Image analysis/OCR prompts, text upload, notifications, private presence and bounded shared state |

Missing configuration produces setup errors rather than simulated success. This is a reusable starter, not production certification. [The delivery record](docs/DELIVERY.md) distinguishes implemented examples from extension points.

## Layout and contracts

- `frontend/src/app/`: workspace, login, welcome, chat and foundation pages.
- `frontend/src/components/`: panels and shared UI; `frontend/src/lib/`: authenticated HTTP/SSE and Supabase clients.
- `backend/app/modules/`: identity, AI, integrations, commerce, realtime.
- `backend/app/core/`: configuration, errors, request limits; `backend/tests/`: mocked-provider behavioral tests.
- `database/migrations/`: core/billing SQL; `database/tests/`: hosted RLS verification.
- `scripts/`: setup, development supervision, checks; `templates/`: copyable starters.
- `docs/`: acceptance and hosting; `.github/workflows/`: build/test CI.

`GET /health` verifies the API process, not provider readiness. Restricted APIs use `/api/v1`. User operations validate bearer identity and preserve JWT-based database RLS. Billing webhook persistence alone uses the service-role credential.

Detailed references: [database](database/README.md), [identity](backend/app/modules/identity/README.md), [AI](ai/README.md), [templates](templates/README.md), [deployment](docs/DEPLOYMENT.md).

## Dependencies and GitHub

Frontend versions are locked in `frontend/package-lock.json`. Backend declarations are in `backend/pyproject.toml`, with resolved constraints in `backend/requirements.lock`. Setup uses a project-local npm cache, disables pip's global cache, and keeps TLS verification enabled.

On macOS/Linux, create `backend/.venv`, install `requirements-dev.txt` from the backend directory, run `npm --prefix frontend ci`, and copy example environments without replacing existing files. `npm run check` supports both Windows and POSIX virtualenv paths.


## Team instructions and training

### Hackathon Template + AI Coding Agent OS

Fork this during events. Then treat coding agents as **senior engineering teammates**, not autocomplete.

## What this repository is

1. **Product scaffolds** — `frontend/`, `backend/`, `database/`, `ai/` (intent folders for common hackathon building blocks)
2. **AI Operating System** — permanent instructions, rules, prompts, and workflows so agents behave consistently across stacks and events

## Quick start for agents

1. Read [`AGENTS.md`](./AGENTS.md)
2. Cursor rules load from [`.cursor/rules/`](./.cursor/rules/)
3. Pick a prompt from [`prompts/`](./prompts/) for the task
4. Follow the loop: **INSPECT → UNDERSTAND → PLAN → IMPLEMENT → TEST → REVIEW → POLISH → REPORT**

## Quick start for humans

```bash
# optional: declare time pressure
./scripts/hackathon/set-mode.sh 6-12

# after a big change: bundle a diff for AI review
./scripts/review/ai-code-review.sh

# best-effort environment sanity
./scripts/validate/preflight.sh
```

## System map

```text
AGENTS.md                 Master agent constitution
.cursor/rules/            Persistent Cursor rules (always + globs)
docs/
  architecture/           Overview + decision log
  conventions/            Coding, FE/BE/DB/API, testing, security, git, UI, AI
  workflows/              Loop, debug, review, security, UI, deploy, team, hackathon
  templates/              Task brief, handoff, PR
prompts/                  Reusable master prompts by category
scripts/
  review/                 AI review bundle + checklist
  validate/               Preflight
  hackathon/              Time-band mode setter
frontend|backend|database|ai/   Product scaffolds
```

## Hackathon priority

```text
working core flow → reliability → UX → visual polish → testing → security → extras
```

Time bands: `12+` · `6-12` · `2-6` · `<2` — see `docs/workflows/hackathon-mode.md`.

## Team workflow

- Split work with `docs/templates/task-brief.md` (non-overlapping files)
- Hand off with `docs/templates/handoff.md`
- Review with `prompts/code-review/full-review.md` (genuine findings only)

## Design principle

```text
UNDERSTAND FIRST → CHANGE MINIMALLY → VERIFY → REVIEW → IMPROVE
```

The AI is not an autocomplete engine. It is a senior engineering teammate.
