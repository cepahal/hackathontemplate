# 18 — Project-Based Mastery

## Target mini-app
```text
React/Next → FastAPI → Pydantic → PostgreSQL → Auth → External API → Webhook
```

Suggested feature set (hackathon-sized):
1. Google (or email magic) login
2. Create notes owned by user
3. List notes (authz filtered)
4. "Summarize note" via external LLM API
5. Webhook stub: provider notifies "summary.done" (or simulate)

## Deliberate bugs (mentor injects)
- IDOR on `GET /notes/{id}`
- Response field rename vs frontend
- Secure cookie on HTTP
- Missing ownership on summarize job
- Webhook without idempotency
- useEffect fetch race
- N+1 list endpoint

## Your job
Use mental model + debugging loop. No shotgun AI fixes.

See `drills/project/` for guided runs.
