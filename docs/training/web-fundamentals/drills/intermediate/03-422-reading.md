# Intermediate 03 — Read a 422

```json
{"detail":[{"type":"missing","loc":["body","title"],"msg":"Field required","input":{"name":"Demo"}}]}
```

Frontend sends `{name, description}`. Backend expects `{title, description}`.

1. Failure boundary?
2. Who is wrong — or both?
3. Hackathon-safe fix options?
