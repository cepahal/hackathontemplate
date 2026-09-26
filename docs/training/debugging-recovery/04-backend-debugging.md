# Backend Debugging (FastAPI-oriented)

## Stack traces are maps, not verdicts

Read bottom-up for causality, top for the throw site:

```text
File ".../auth.py", line 42, in require_user
    raise HTTPException(status_code=401, detail="Not authenticated")
```

Ask: which layer threw — transport, dependency, service, DB, HTTP client?

## Common FastAPI failure classes

| Class | Symptoms | Evidence |
|---|---|---|
| Validation | 422 | Response `detail` list; request body |
| Authn | 401 | Missing/invalid token; dependency `get_current_user` |
| Authz | 403 / wrong 404 | User id ≠ resource owner |
| Incorrect state | 200 wrong data | Logs + DB row vs serializer |
| Dependency failure | 500 | DB pool, Redis down |
| Serialization | 500 | Pydantic response model mismatch |
| External API | 502/500/timeout | HTTPX/log of upstream status |
| Race | Flaky 409/overwrites | Concurrent requests; missing transaction |
| Timeout | Client abort / 504 | Slow query or upstream |

## Method

1. Reproduce with one `curl`/httpie matching the browser request (headers!)
2. Enable/inspect server logs for that request id
3. Confirm: did the route handler run? did auth dependency pass?
4. Print/log **sanitized** inputs at boundary (never secrets)
5. Minimal fix at the layer that violated the invariant

## Example: auth failure

```python
# FACT: browser sends cookie session_id=...
# FACT: API returns 401
# HYPOTHESIS A: cookie not parsed (name/domain/path)
# HYPOTHESIS B: session expired / not in store
# HYPOTHESIS C: dependency looks at Bearer header only
# NEXT: log whether request.cookies contains session_id inside dependency
```

## Race conditions

- Two parallel "create" clicks → duplicate rows → unique violation
- Read-modify-write without transaction → lost update  
Experiment: serialize with unique constraint + proper upsert, or disable double-submit in UI

## Serialization problems

Response model expects `created_at: datetime` but you return a string — FastAPI 500.  
Evidence: exception `ResponseValidationError`. Fix model or adapter — don't catch-all.

## AI supervision rule

If AI proposes rewriting auth middleware + CORS + frontend client at once: **reject**.  
Demand one hypothesis and one experiment first.
