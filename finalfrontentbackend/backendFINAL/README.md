# backendFINAL — FastAPI backend

FastAPI + Pydantic API for the `frontendFINAL` app, backed by the Supabase schema in
`../databaseFINAL`. Python 3.11+ (tested on 3.12 and 3.14).

## Run locally

```bash
cd finalfrontentbackend/backendFINAL
python3 -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt  # runtime (requirements.txt) + pytest/mypy/ruff
cp .env.example .env                 # then fill in SUPABASE_URL and SUPABASE_ANON_KEY
uvicorn app.main:app --reload --port 8000
```

- Health: <http://localhost:8000/api/v1/health>
- Interactive docs (disabled when `ENVIRONMENT=production`): <http://localhost:8000/api/v1/docs>

Production runs the `Dockerfile` (non-root user, `$PORT`, `ENVIRONMENT=production`); see
[`../docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md).

The database tables must exist first: apply `../databaseFINAL/migrations/001–007` (see that README).
Until then, data endpoints return `503 DATABASE_SCHEMA_MISSING`.

## Architecture

```text
app/
├── main.py                 create_app(): lifespan (shared httpx client), middleware, routers
├── core/
│   ├── config.py           Pydantic settings from env/.env; rejects unsafe key/CORS config
│   ├── security.py         Supabase JWT verification (JWKS / HS256), roles
│   ├── errors.py           AppError hierarchy + handlers → {"error": {...}}
│   ├── logging.py          log format with request IDs
│   ├── middleware.py       request ID, access log, last-resort JSON 500, AI body-size limit
│   └── rate_limit.py       per-user in-memory limiter (integration + AI routes)
├── ai/                     AI service, provider adapters, streaming, files, history — see its README
├── integrations/           external API adapters (AI, GitHub, maps, email, webhooks) — see its README
├── api/
│   ├── router.py           mounts every module under /api/v1
│   └── deps.py             get_current_user, require_role/require_user, user-scoped DB
├── modules/<name>/
│   ├── router.py           HTTP only: parse, call service, return model
│   ├── schemas.py          Pydantic request/response models
│   └── service.py          business rules + ownership checks
└── db/supabase.py          PostgREST client (httpx), error mapping
```

Request flow: `router → service → db`. Routes contain no business logic; services never see
HTTP objects; the db layer knows nothing about projects or tasks.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `SUPABASE_URL` | yes | `https://<ref>.supabase.co` |
| `SUPABASE_ANON_KEY` | yes | Publishable (`sb_publishable_…`) or legacy anon key. Same value as the frontend's. |
| `SUPABASE_SERVICE_ROLE_KEY` | no | **Backend only**, bypasses RLS. Not used by any route today. |
| `SUPABASE_JWT_SECRET` | no | Only for legacy projects that sign user tokens with HS256. |
| `FRONTEND_URL` | yes (default `http://localhost:3000`) | Allowed CORS origin |
| `CORS_ORIGINS` | no | Extra allowed origins, comma-separated |
| `OPENAI_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `GROK_API_KEY` (+ `*_MODEL`), `GITHUB_TOKEN`, `MAPS_PROVIDER`, `MAPS_API_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, `SLACK_WEBHOOK_URL`, `DISCORD_WEBHOOK_URL`, `INTEGRATIONS_RATE_LIMIT_PER_MINUTE` | no | External integrations. All optional; see [`app/integrations/README.md`](app/integrations/README.md) |
| `AI_DEFAULT_PROVIDER`, `AI_MAX_PROMPT_CHARS`, `AI_MAX_CONTEXT_CHARS`, `AI_MAX_OUTPUT_TOKENS`, `AI_MAX_FILE_BYTES`, `AI_STREAM_TIMEOUT_SECONDS` | no | AI layer limits; see [`app/ai/README.md`](app/ai/README.md) |
| `ENVIRONMENT` | no | `development` (default), `test`, `production` |
| `LOG_LEVEL` | no | `INFO` (default) |

Startup fails with a clear list of problems if a required value is missing, if a secret key is
put in `SUPABASE_ANON_KEY` (or the public key in `SUPABASE_SERVICE_ROLE_KEY`), or if a CORS origin
contains `*`. Secrets are `SecretStr` and never appear in logs or reprs.

**Never** expose the service-role key to the browser or name it `NEXT_PUBLIC_*`.

## API endpoints

All under `/api/v1`. Everything except `health` requires `Authorization: Bearer <supabase access token>`.

| Method | Path | Success | Notes |
|---|---|---|---|
| GET, HEAD | `/health` | 200 `{"status":"ok"}` | Liveness only; does not claim Supabase is healthy |
| GET | `/me` | 200 profile | `role` from the token's `app_metadata` |
| GET | `/projects?status=&limit=50&offset=0` | 200 `Project[]` | Caller's projects, newest first |
| POST | `/projects` | 201 `Project` | Body `{name, description?, status?}` |
| GET | `/projects/{project_id}` | 200 `Project` | |
| PATCH | `/projects/{project_id}` | 200 `Project` | Any of `name`, `description`, `status` |
| DELETE | `/projects/{project_id}` | 204 | Deletes its tasks too |
| GET | `/projects/{project_id}/tasks?completed=&limit=100&offset=0` | 200 `Task[]` | |
| POST | `/projects/{project_id}/tasks` | 201 `Task` | Body `{title, description?, completed?, priority? 1–4, due_date?}` |
| PATCH | `/tasks/{task_id}` | 200 `Task` | Any of the task fields; `due_date: null` clears it |
| DELETE | `/tasks/{task_id}` | 204 | |
| GET | `/integrations/status` | 200 booleans | Which integrations have keys; no secrets, no network calls |
| * | `/integrations/...` | | GitHub, geocoding, test email, notifications — see [`app/integrations/README.md`](app/integrations/README.md) |
| GET | `/ai/providers` | 200 `ProviderInfo[]` | Configured flag, default, model, accepted attachment types (no secrets) |
| POST | `/ai/generate` | 200 `TextGeneration` | Body `{prompt, context?, provider?}`; no `model` field |
| POST | `/ai/structured` | 200 `StructuredGeneration` | Body adds `output_schema: "generated_plan"`; Pydantic-validated |
| POST | `/ai/stream` | 200 `text/event-stream` | `start`, `delta`*, then `done` or `error` |
| POST | `/ai/analyze-image` | 200 `TextGeneration` | multipart `file` (png/jpeg/webp/gif), `prompt`, `provider?` |
| POST | `/ai/analyze-file` | 200 `TextGeneration` | multipart `file` (txt/md, pdf, image), `prompt`, `provider?` |
| GET | `/ai/history?limit=20&offset=0&type=` | 200 `GenerationRecord[]` | Caller's own generations only (needs migration 007) |

Request bodies reject unknown fields (`extra="forbid"`), so `owner_id`/`project_id` cannot be
injected. `due_date` must include a timezone. Responses use the same field names as the database
(`snake_case`), matching `frontendFINAL/src/types/database.ts`.

### Errors

```json
{ "error": { "code": "PROJECT_NOT_FOUND", "message": "Project not found", "request_id": "…" } }
```

| Status | Codes |
|---|---|
| 400 | `INVALID_JSON`, `EMPTY_UPDATE`, `BAD_REQUEST`, `FILE_*` (invalid name, empty, type mismatch, not text, invalid PDF) |
| 401 | `UNAUTHORIZED` (no token), `INVALID_TOKEN`, `TOKEN_EXPIRED` — with `WWW-Authenticate: Bearer` |
| 403 | `FORBIDDEN` (role check / database policy) |
| 404 | `PROJECT_NOT_FOUND`, `TASK_NOT_FOUND`, `PROFILE_NOT_FOUND`, `NOT_FOUND` (route) |
| 405 | `METHOD_NOT_ALLOWED` |
| 411 / 413 / 415 | `LENGTH_REQUIRED`; `PAYLOAD_TOO_LARGE`, `PROMPT_TOO_LARGE`, `CONTEXT_TOO_LARGE`, `FILE_TOO_LARGE`; `FILE_TYPE_UNSUPPORTED`, `FILE_PDF_ENCRYPTED`, `PROVIDER_UNSUPPORTED_INPUT` (AI routes) |
| 409 | `PROJECT_NAME_TAKEN`, `CONFLICT` |
| 422 | `VALIDATION_ERROR` with `details: [{field, message, type}]` (input values are never echoed) |
| 500 | `INTERNAL_ERROR` (details only in server logs, correlated by `request_id`) |
| 429 | `RATE_LIMITED` (integration and AI routes, with `Retry-After`) |
| 502 / 503 / 504 | `INTEGRATION_*` / `AI_*` provider errors (502 auth/unavailable/invalid response, 503 not configured/rate limited, 504 timeout) |
| 503 | `AUTH_UNAVAILABLE`, `DATABASE_UNAVAILABLE`, `DATABASE_SCHEMA_MISSING` |

Every response carries `X-Request-ID` (an incoming safe `X-Request-ID` is reused).

## Authentication

`get_current_user` (in `app/api/deps.py`):

1. Reads `Authorization: Bearer <token>`; missing or non-Bearer → 401.
2. Verifies the JWT in `TokenVerifier` (`app/core/security.py`):
   - `ES256`/`RS256` (Supabase JWT signing keys, the default for new projects): public key from
     `<SUPABASE_URL>/auth/v1/.well-known/jwks.json`, cached 10 min, refreshed on key rotation
     (rate-limited). JWKS outage → 503, not "invalid token".
   - `HS256`: only if `SUPABASE_JWT_SECRET` is set. `alg: none` and anything else → 401.
   - Checks signature, `exp` (10 s leeway), `aud = authenticated`, `iss = <SUPABASE_URL>/auth/v1`.
3. Requires `role = authenticated` and a UUID `sub`, so anon/service keys are never accepted as users.
4. Returns `AuthenticatedUser(id, email, role, session_id, access_token)`. `role` is
   `app_metadata.role` (`user` default, `admin`), which users cannot edit.

Identity is **only** taken from the verified token, never from request bodies or query strings.

Role checks: `require_role("admin")` is a dependency factory (`user` < `admin`).
`CurrentUser` = `require_user` (any signed-in user), `AdminUser` = `require_admin`:

```python
@router.get("/admin/stats")
async def stats(user: AdminUser) -> StatsOut: ...
```

## Authorization

Two independent layers:

1. **Service layer:** every project query filters `owner_id = <token user id>`; task operations first
   load the parent project the same way. Someone else's project/task returns 404 (not 403), so
   IDs cannot be probed.
2. **Database (RLS):** the backend calls Supabase with the *anon key + the user's own JWT*, so the
   Row Level Security policies from `databaseFINAL/migrations/006_rls.sql` apply to every query.
   The service-role key is never used on user requests.

To give admins wider access later: extend `_owned()` in `modules/projects/service.py`
**and** add matching RLS policies (or use a separate service-role client for admin-only routes
guarded by `AdminUser`).

## CORS

Only `FRONTEND_URL` plus `CORS_ORIGINS` are allowed; wildcards are rejected at startup.
`allow_credentials=False` because auth uses the `Authorization` header, not cookies (which also
means CSRF does not apply). Allowed methods: GET, POST, PATCH, DELETE, OPTIONS. Allowed headers:
`Authorization`, `Content-Type`, `X-Request-ID`. CORS headers are also present on error responses.

## Frontend integration

`frontendFINAL/src/lib/api.ts` exports `backendApi`:

```ts
import { backendApi } from "@/lib/api";

const projects = await backendApi.projects.list({ status: "active" }); // browser: token attached automatically
const task = await backendApi.tasks.create(projects[0].id, { title: "Ship it", priority: 3 });
```

In Server Components pass the token explicitly:

```ts
import { getAccessToken } from "@/lib/auth";
const projects = await backendApi.projects.list({}, { token: await getAccessToken() });
```

Errors are thrown as `ApiRequestError` with `status`, `code` and `message` from the envelope above.

## Testing

```bash
source .venv/bin/activate
python -m pytest          # 356 tests, no network, real Supabase or API keys needed
ruff check app tests && ruff format --check app tests
mypy                      # strict
```

- `tests/conftest.py` signs real ES256 tokens with a throwaway key and serves its public key
  from a mocked JWKS endpoint, so the real verification code runs.
- `tests/fakes.py` replaces the database with an in-memory store that **does not** emulate RLS,
  so ownership tests prove the service layer itself scopes every query.
- `tests/test_supabase_client.py` checks the real PostgREST client against a mocked transport
  (headers, filters, error mapping, timeouts).

| File | Covers |
|---|---|
| `test_health.py` | health, request IDs, 404/405 shape, CORS allow/deny, JSON 500, docs off in prod |
| `test_projects.py` | 401s, creation, owner from token, listing/pagination, ownership, 404, 409, validation |
| `test_tasks.py` | task CRUD, ownership via parent project, cascade, 404, validation |
| `test_auth.py` | expired/forged/tampered/`alg:none`/wrong aud/iss/role tokens, JWKS caching/outage, roles |
| `test_config.py` | unsafe keys, wildcard CORS, bad URLs, missing config message, secret redaction |
| `test_supabase_client.py` | PostgREST requests and error mapping |
| `test_integrations_*.py`, `test_ai_clients.py`, `test_integration_clients.py` | external adapters with mocked HTTP: success, timeout, errors, invalid responses, missing keys, retries, SSRF, log redaction, route policies |
| `test_ai_files.py`, `test_ai_providers.py`, `test_ai_routes.py` | AI layer: file validation, per-provider streaming (malformed/truncated/error events), image/PDF payloads, structured-output retry, `/ai/*` auth, limits, SSE, persistence, history isolation |

### Manual end-to-end check (real Supabase)

After applying the migrations and creating a test user (see `../databaseFINAL/README.md`), get a
real access token from Supabase Auth and call the backend with it:

```bash
URL=https://<ref>.supabase.co; KEY=sb_publishable_...
TOKEN=$(curl -s "$URL/auth/v1/token?grant_type=password" -H "apikey: $KEY" \
  -H "Content-Type: application/json" -d '{"email":"alice@example.com","password":"<password>"}' |
  python3 -c 'import json,sys; print(json.load(sys.stdin)["access_token"])')

curl -s localhost:8000/api/v1/me -H "Authorization: Bearer $TOKEN"
curl -s -X POST localhost:8000/api/v1/projects -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"name":"From curl"}'
curl -s localhost:8000/api/v1/projects -H "Authorization: Bearer $TOKEN"
```

## Security rules

- Service-role key: backend only, optional, unused by user routes; never `NEXT_PUBLIC_*`.
- Identity from the verified JWT only; client-sent `owner_id`/`project_id` in bodies are rejected.
- Every data query runs under RLS as the calling user, plus explicit owner filters in services.
- Path IDs are typed `UUID`; filters are sent as PostgREST query params (no SQL is built).
- Logs contain method, path, status, duration and request ID — never tokens, headers or bodies.
- Validation errors never echo input; 500s never expose exception details.
- No wildcard CORS; no cookies, so no CSRF surface.
- `python-jose` was replaced by `PyJWT[crypto]` (actively maintained; jose has had algorithm-confusion CVEs).
  The `supabase` SDK is not used: PostgREST over the already-required `httpx` keeps the dependency
  tree small and makes the data layer easy to mock.
