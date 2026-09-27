# Environment Debugging

Most "it works locally but not in prod" bugs are **configuration**, not algorithms.

## Separation

| Layer | Typical vars | Must not |
|---|---|---|
| Frontend | `NEXT_PUBLIC_*`, `VITE_*` | Contain server secrets |
| Backend | `DATABASE_URL`, `AUTH_SECRET`, API keys | Be committed in `.env` |
| Deploy platform | Dashboard env | Drift from `.env.example` |

## Checklist

1. Diff **names** against `.env.example` (typos: `SUPABASE_URL` vs `SUPA_BASE_URL`)
2. Confirm process actually loaded env (print keys **names** at boot, not values)
3. Frontend built with wrong `API_URL` → baked in at build time for many frameworks
4. `localhost` in production client config
5. OAuth callback URL allowlist mismatch
6. CORS_ORIGINS missing deployed frontend origin
7. Secrets rotated in provider but not in deploy

## Diagnosis pattern

```text
FACT: local 200, prod 401
HYPOTHESIS: AUTH_SECRET differs → sessions invalid
NEXT: compare secret presence (not value paste in chat); re-login after align
```

## Safety

- Never paste live secrets into AI chat or commits
- If leaked: rotate first, then remove from git history if needed
