# 02 — HTTP

## WHAT

HTTP is a **request/response protocol**. One request message in; one response message out (with streaming/chunking variants). HTTPS = HTTP over TLS (encrypted + authenticated channel).

## WHY

Status codes, methods, and headers are the **shared language** of frontend, backend, proxies, and browsers. AI misuses them constantly (`200` for create, `500` for validation, etc.).

## HOW — what travels on the wire

```http
POST /api/items?dry_run=false HTTP/1.1
Host: api.example.com
Content-Type: application/json
Authorization: Bearer eyJ...
Cookie: session=abc
Content-Length: 27

{"title":"Ship demo slides"}
```

| Part | Role |
|---|---|
| **Method** | Verb / intent (semantics + safety) |
| **Path** | Resource location (`/api/items`) |
| **Query** | Optional filters (`?dry_run=false`) — visible in logs/URLs |
| **Headers** | Metadata (auth, content type, cookies) |
| **Body** | Payload (often JSON) |

Response:

```http
HTTP/1.1 201 Created
Content-Type: application/json
Set-Cookie: session=abc; HttpOnly; Secure; SameSite=Lax

{"id":42,"title":"Ship demo slides"}
```

### Methods (hackathon intuition)

| Method | Safe? | Idempotent? | Typical use |
|---|---|---|---|
| GET | Yes | Yes | Read |
| POST | No | No* | Create / actions |
| PUT | No | Yes | Replace resource |
| PATCH | No | Usually | Partial update |
| DELETE | No | Yes | Remove |

\*Retries of POST can duplicate — need idempotency keys for payments.

### Status codes you must feel

| Code | Meaning for you |
|---|---|
| 200 | OK with body |
| 201 | Created |
| 204 | OK no body |
| 301/302 | Redirect (auth/login flows) |
| 400 | Malformed / general client error |
| 401 | Not authenticated |
| 403 | Authenticated but not allowed |
| 404 | Missing resource (or hide existence) |
| 409 | Conflict |
| 422 | Validation (FastAPI/Pydantic default) |
| 429 | Rate limit |
| 500 | Unhandled server error |
| 502/503 | Upstream / unavailable |

### Cookies vs Authorization header

- **Cookie**: browser auto-sends for matching domain/path; `HttpOnly` hides from JS
- **Bearer token**: JS must attach header; XSS can steal if in localStorage

### Content types

- `application/json` — APIs
- `application/x-www-form-urlencoded` / `multipart/form-data` — forms/uploads
- Wrong `Content-Type` → body parse fails → 422/400

### Caching / redirects

- `Cache-Control`, `ETag` — mostly CDN/static; APIs often `no-store` for private data
- Redirects change URL; `fetch` may follow; OAuth depends on redirect URIs matching exactly

## EXAMPLE

Login POST → `201`/`200` + `Set-Cookie` → next GET includes Cookie automatically.

## FAILURE MODE

- Putting secrets in query strings (logged everywhere)
- POST without idempotency → double charge
- Frontend treats all non-OK as "Network Error" and loses status

## DEBUGGING

Network panel: method, URL, status, request payload, response body, Set-Cookie.

## AI-GENERATED CODE

Red flags: GET with body; POST for pure reads; returning 200 for auth failure; putting JWT in query.
