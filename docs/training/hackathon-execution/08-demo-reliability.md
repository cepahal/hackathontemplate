# 08 — Demo Reliability

For every fragile hop:

| Failure | Primary | Fallback | Recovery |
|---|---|---|---|
| API timeout | Retry once | Cached response / fixture mode | Narrate + show screenshot |
| Model fail | Structured retry | Precomputed demo output | Toggle `DEMO_MODE=1` |
| DB fail | Health check | Read-only snapshot | Switch to backup deploy |
| Auth fail | Warm session | Magic demo bypass (gated) | Already logged-in window |
| Rate limit | Backoff | Local stub provider | Don't refresh spam |
| Network | Hotspot | Offline recording | Play backup video |
| Bad data | Reset seed script | Known-good DB dump | Re-seed in 30s |
| Deploy down | Rollback | Local + ngrok / prior URL | Video |

**Never** depend on a single fragile external service without a fallback.
Worksheet: `templates/demo-failure-matrix.md`
