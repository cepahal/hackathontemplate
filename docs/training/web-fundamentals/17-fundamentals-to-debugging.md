# 17 — Fundamentals → Debugging

| Symptom | First concept | Likely layer |
|---|---|---|
| 401 | authentication | cookie/token/session |
| 403 | authorization | ownership/roles |
| 404 | routing / hide exist | path or authz mask |
| 422 | validation | Pydantic/schema |
| 429 | rate limit | upstream/gateway |
| 500 | unhandled server | exception/DB |
| CORS error | browser security | origins/preflight |
| SQL error in logs | database | schema/SQL |
| timeout | network/upstream | slow query/API |
| blank UI + 200 | contract/React | field names/state |
| flicker wrong data | async race | stale fetch |
| double charge | transactions/idempotency | POST retry |

Method: symptom → boundary → concept → evidence → fix.
