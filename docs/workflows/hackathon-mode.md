# Hackathon Mode Workflow

## Priority stack
```text
working core flow
→ reliability
→ UX
→ visual polish
→ testing
→ security
→ nonessential features
```

## Time bands
| Remaining | Mode | Allowed | Forbidden |
|---|---|---|---|
| 12+ h | Build properly | Structure, critical tests | Endless speculative refactors |
| 6–12 h | MVP | One vertical slice E2E | Parallel feature sprawl |
| 2–6 h | Stabilize + polish | Bugfixes, UX on demo path | New architecture, new deps |
| < 2 h | Demo freeze | Blocker fixes only | Features, migrations, redesigns |

## Scope control
For every new ask, answer:
1. Does this unblock the demo?
2. Can it ship as a stub/hardcode safely?
3. If no — park it in `FOLLOWUPS.md` or the task board

## Set mode
```bash
./scripts/hackathon/set-mode.sh 6-12
```

Prompts: `prompts/hackathon/`
