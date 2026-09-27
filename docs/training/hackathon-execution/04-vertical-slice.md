# 04 — Vertical Slice

Build this spine **first**:

```text
User action
→ frontend
→ API
→ backend
→ database/AI
→ response
→ frontend
```

## Done means
- Real network call (not only mocked forever)
- Visible result in UI
- Deployable later without rewriting contracts

## Anti-pattern
Three beautiful screens + zero backend = nothing to demo if time dies.
