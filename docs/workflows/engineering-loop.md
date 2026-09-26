# Engineering Loop Workflow

```text
INSPECT → UNDERSTAND → PLAN → IMPLEMENT → TEST → REVIEW → POLISH → REPORT
```

## INSPECT
- Tree the relevant roots
- `rg`/search for symbols and similar features
- Open contracts: types, OpenAPI, Zod/Pydantic, migrations
- Skim tests and `.env.example`

## UNDERSTAND
Write briefly (even to yourself):
- current behavior
- invariants that must hold
- gaps between request and reality

## PLAN
- files to touch
- reuse targets
- risks (auth, data loss, contract breaks)
- verification commands

## IMPLEMENT
- smallest correct diff
- no unrelated edits

## TEST
- run targeted tests + typecheck/lint if present
- fix failures before moving on

## REVIEW
- self-diff against the plan
- security-sensitive paths if touched
- use `scripts/review/` for structured review

## POLISH
- states, copy, obvious UX gaps on the changed surface
- deploy/env notes if needed

## REPORT
```text
Changed:
Verified:
Risks / not verified:
Follow-ups:
```
