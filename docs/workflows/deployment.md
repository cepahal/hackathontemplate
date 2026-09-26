# Deployment Workflow

## Production readiness checklist
- [ ] Build succeeds cleanly
- [ ] Required env vars documented in `.env.example` (no secrets committed)
- [ ] Health check / ping route works
- [ ] Auth callback URLs match deployed domains
- [ ] DB migrations applied (or noted as manual step)
- [ ] CORS origins correct
- [ ] Logging does not print secrets
- [ ] Error pages do not leak internals
- [ ] Smoke test of demo path on deployed URL

## Debugging deploys
1. Read build + runtime logs
2. Diff env vars vs local `.env.example`
3. Confirm migration/version
4. Hit health endpoint
5. Reproduce with same API base URL as the client

## Smoke test script idea
```bash
./scripts/validate/preflight.sh
```

Prompts: `prompts/deployment/`
