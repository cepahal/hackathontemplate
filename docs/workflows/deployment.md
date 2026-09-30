# Deployment Workflow

## Production readiness checklist
- [ ] Build succeeds cleanly
- [ ] Required env vars documented in `backend/.env.example` and `frontend/.env.example` (no secrets committed)
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
npm run preflight
```

Preflight is not a deployed smoke test. Run `npm run check` for offline application checks, then
follow `database/README.md` for hosted RLS verification and `docs/DEPLOYMENT.md` for live acceptance.

Prompts: `prompts/deployment/`
