# Team + Multi-Agent Workflow

## Principles
- Parallelize by **file ownership**, not by editing the same files
- Small PRs beat giant end-of-night merges
- Explicit handoffs beat tribal knowledge

## Task decomposition
Split by vertical slices or layers **without** overlapping files:
- Auth slice
- Dashboard UI slice
- API/data slice

Each task uses `docs/templates/task-brief.md`:

```text
Objective
Context
Files
Dependencies
Acceptance criteria
Verification
```

## Branch strategy
- One branch per task brief
- Rebase/merge from `main` often during the event
- Name: `feat/<task>` or `fix/<task>`

## Merge strategy
- Prefer merge when CI/tests green (or manually verified)
- Demo-critical: second pair of eyes (human or AI review script)
- Resolve conflicts with the file owner present when possible

## Conflict prevention
- Announce intended file lists in the task brief
- Extract shared types early to a neutral module
- Avoid formatting-only diffs on hot files

## Context / AI handoff
Use `docs/templates/handoff.md` when switching humans or agents:
- what works
- what doesn't
- decisions made
- exact next command/step
- files in flight

## Review requirements
- Non-trivial merges: run `scripts/review/ai-code-review.sh` or paste `prompts/code-review/full-review.md`
- Auth/data: also run security checklist
