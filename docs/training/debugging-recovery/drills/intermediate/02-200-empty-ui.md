# Intermediate 02 — 200 but blank UI

## Evidence
- `GET /api/activity` → 200
- Body: `{"items":[{"id":1,"type":"login"}],"next_cursor":null}`
- React component maps `data.activities.map(...)`
- No console error (yet)

## Your job
1. Root-cause class?
2. What single log/breakpoint confirms it?
3. Minimal fix shape (don't write a rewrite)
