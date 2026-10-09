# Deployment Workflow

App-specific steps (Vercel, Railway/Render, Supabase): `finalfrontentbackend/docs/DEPLOYMENT.md`.

## Production readiness checklist
- [ ] Build succeeds cleanly
- [ ] Required env vars documented in `finalfrontentbackend/backendFINAL/.env.example` and `frontendFINAL/.env.example` (no secrets committed)
- [ ] Health check / ping route works
- [ ] Auth callback URLs match deployed domains
- [ ] DB migrations applied (or noted as manual step)
- [ ] CORS origins correct
- [ ] Logging does not print secrets
- [ ] Error pages do not leak internals
- [ ] Smoke test of demo path on deployed URL

## Debugging deploys
1. Read build + runtime logs
2. Compare configured variable names against the relevant app's `.env.example` without printing secrets
3. Confirm migration/version
4. Hit health endpoint
5. Reproduce with same API base URL as the client

## Offline prerequisite check
```bash
./scripts/validate/preflight.sh
```

Preflight is not a deployed smoke test. Run the app's lint/typecheck/build and pytest (see the root
`README.md`), then follow `finalfrontentbackend/databaseFINAL/README.md` for hosted RLS verification and
`finalfrontentbackend/docs/DEPLOYMENT.md` for the production smoke test.

Prompts: `prompts/deployment/`
