# 03 — Build Strategy (P0 / P1 / P2)

## Prefer
```text
working end-to-end flow
```
over perfect frontend + unfinished backend.

## Definitions
- **P0**: Without it, no demo story
- **P1**: Clearly better for judges if time
- **P2**: Vanity / optional

## Sequence
1. Stub UI → real API → real DB/AI → wire UI (thin)
2. Harden authz on that path
3. Then broaden

Template: `templates/p0-p1-p2.md`
