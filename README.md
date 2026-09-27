# Hackathon Template + AI Coding Agent OS

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
