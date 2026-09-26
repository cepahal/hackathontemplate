# Git Conventions

## Branching
- `main` — stable demo / deployable
- `feat/<short-name>` — features
- `fix/<short-name>` — fixes
- Avoid long-lived diverging branches during hackathons

## Commits
- Small, reviewable
- Message explains **why**
- No secrets, no `node_modules`, no `.env`

## Merging
- Prefer squash or clean rebase per team norm
- Resolve conflicts consciously — do not blindly accept either side
- Protect `main` with at least one human glance before demo-critical merges when possible

## Agent rules
- Commit only when the human asks
- Never force-push shared `main` unless explicitly requested
