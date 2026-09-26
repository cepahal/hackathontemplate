# Automated / AI Code Review Workflow

Goal: **genuine findings only**. No style nit noise. No generic "best practice" filler.

## When to run
- After a significant feature or refactor
- Before demo merge to `main`
- After auth/payments/upload/AI-tool changes

## How to run
```bash
./scripts/review/ai-code-review.sh
# or paste prompts/code-review/full-review.md into the agent with the diff
```

## Review dimensions
Inspect only where relevant:

| Dimension | Look for |
|---|---|
| Correctness | Logic bugs, edge cases, off-by-one, race assumptions |
| Architecture | Violates existing patterns; duplicate layers |
| Security | Authz gaps, injection, XSS, secrets, IDOR, SSRF |
| Performance | N+1, unbounded lists, sync work on request path |
| Testing | Missing critical coverage for changed behavior |
| API contracts | Breaking response/request changes |
| Database | Missing filters, unsafe migrations |
| Error handling | Swallowed errors, wrong status codes |
| UX | Broken states on changed screens |
| Accessibility | New unlabeled controls, focus traps |
| Maintainability | Unnecessary complexity introduced by this diff |

## Output format (strict)
```text
## Findings
### P0 — Blockers
- [file:line] problem → impact → fix sketch

### P1 — Should fix before merge
- ...

### P2 — Nice to have
- ...

## Residual risk
- ...

## Explicit non-issues
- Briefly list areas checked with no findings (keeps honesty without noise)
```

If there are no real issues: say **"No material findings"** and list what you checked.
Do **not** invent nits to look thorough.
