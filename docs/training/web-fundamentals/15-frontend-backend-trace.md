# 15 — Frontend ↔ Backend Trace

Memorize this spine. Debug by testing each arrow.

```text
button click
  → React state (optional)
    → fetch()/client
      → HTTP request
        → FastAPI route
          → Pydantic validation
            → authn dependency
              → authz check
                → service logic
                  → SQL
                    → database
                  ← rows
                ← domain result
              ← ...
            ← ...
          ← response_model JSON
        ← HTTP response
      ← parse JSON
    → setState
  → UI render
```

## Boundary checklist
| Boundary | Failure looks like |
|---|---|
| click → fetch | no Network request |
| fetch → HTTP | wrong URL/method/CORS |
| HTTP → route | 404 |
| body → Pydantic | 422 |
| authn | 401 |
| authz | 403/404 |
| SQL | 500 + DB error log |
| response → state | 200 but wrong field mapping |
| state → UI | conditional render bug |

## AI reading exercise
For any generated feature, narrate this spine aloud once before merging.
