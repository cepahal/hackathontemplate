# HTTP / Network triage

```text
UI broken
 └─ Network: was a request sent?
    ├─ NO → frontend logic / wrong event / blocked JS error (Console)
    └─ YES → status?
       ├─ 2xx → check body shape vs UI (contract/render)
       ├─ 401/403 → Application cookies/headers + authz
       ├─ 404 → base URL / route / deploy path
       ├─ 4xx validation → request payload
       ├─ 429 → quota; stop hammering
       ├─ 5xx → server logs (browser is not enough)
       └─ CORS / failed → origins + preflight; may look like network error
```

Demo clock rule: find status + body before changing code.
