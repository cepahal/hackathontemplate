# External integrations

Typed, server-side adapters for third-party APIs. Provider keys live only in the backend
environment; the browser talks to fixed `/api/v1/integrations/*` routes, never to providers.

```
app/integrations/
  errors.py              IntegrationError hierarchy → standard JSON error envelope
  http.py                HttpClient: timeouts, retries, SSRF guard, safe logging, validation
  base.py                ExternalService: authenticate → request → validate → typed result
  registry.py            Integrations: builds every adapter from Settings; status()
  ai/base.py             AIClient interface: generate_text(), generate_structured()
  ai/openai_client.py    OpenAI + Grok (xAI, OpenAI-compatible)
  ai/gemini_client.py    Google Gemini
  ai/anthropic_client.py Anthropic Claude
  github/client.py       GitHubClient: get_repository(), search_repositories()
  maps/client.py         MapsClient + Mapbox / Google geocoders
  email/client.py        EmailClient + Resend provider
  notifications/client.py Slack / Discord incoming webhooks
app/modules/integrations/ demo routes (router → service → registry)
```

## How adapters work

```
route ──► service (policy) ──► adapter method ──► ExternalService.call()
                                                    │ auth_headers() / auth_params()   ← credential from Settings
                                                    ▼
                                                  HttpClient.request_json()
                                                    │ fixed base URL + relative path only
                                                    │ timeout, retry/backoff, Retry-After
                                                    │ status → IntegrationError
                                                    ▼
                                                  Pydantic model.validate → typed result
```

**`HttpClient`** (`http.py`) wraps one shared `httpx.AsyncClient` (created in the app lifespan,
`follow_redirects=False`):

| Concern | Behaviour |
|---|---|
| Methods | `get/post/put/patch/delete`, `request`, `request_json(model=...)` |
| Inputs | headers, query params (`None` values dropped), JSON body, per-call timeout |
| SSRF | Base URL is fixed per adapter. Paths containing `://`, starting `//` or `\`, or with `..` segments raise `ValueError`. No route accepts a URL. |
| Retries | `RetryPolicy` (3 attempts, exponential backoff with jitter, honours `Retry-After`, capped) on 429/500/502/503/504 and transport errors |
| Unsafe methods | POST/PATCH are retried only if the connection never opened, on 429, or when the caller passes `idempotent=True` (AI generation; email only with an `Idempotency-Key`). GET/PUT/DELETE retry normally. |
| Validation | Non-JSON → `INTEGRATION_INVALID_RESPONSE`; wrong shape (Pydantic) → same; responses over 5 MB rejected |
| Logging | `service METHOD /path -> status (ms, attempt n)`. Never headers, query strings, bodies or keys. Provider error messages are logged after `redact()`. Adapters with secret URLs (webhooks) set `log_paths = False`. |

**Errors** (all use the standard `{"error": {code, message, details, request_id}}` envelope):

| Situation | HTTP | `code` |
|---|---|---|
| Key not set | 503 | `INTEGRATION_NOT_CONFIGURED` (`details.env_var` names the variable) |
| Provider rejected our key (401/403) | 502 | `INTEGRATION_AUTH_FAILED` — never 401, which the frontend treats as "session expired" |
| Provider rate limit (429, GitHub 403 + `x-ratelimit-remaining: 0`) | 503 | `INTEGRATION_RATE_LIMITED` |
| Provider 5xx / connection failure | 502 | `INTEGRATION_UNAVAILABLE` |
| Other provider 4xx | 502 | `INTEGRATION_REQUEST_FAILED` (`details.upstream_status`) |
| Timeout | 504 | `INTEGRATION_TIMEOUT` |
| Bad JSON / unexpected shape | 502 | `INTEGRATION_INVALID_RESPONSE` |
| AI-specific | 502 | `AI_INVALID_STRUCTURED_OUTPUT`, `AI_EMPTY_RESPONSE`, `AI_REFUSED`, `AI_BLOCKED` |

## Providers

| Integration | Class | Env var(s) | Notes |
|---|---|---|---|
| OpenAI | `OpenAIClient` | `OPENAI_API_KEY`, `OPENAI_MODEL` | Chat Completions; structured output via `response_format: json_schema` |
| Grok (xAI) | `GrokClient` | `GROK_API_KEY`, `GROK_MODEL` | Same adapter as OpenAI, base `https://api.x.ai/v1` |
| Gemini | `GeminiClient` | `GEMINI_API_KEY`, `GEMINI_MODEL` | `generateContent`; structured via `responseJsonSchema` |
| Anthropic | `AnthropicClient` | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Messages API; structured via a forced tool call |
| GitHub | `GitHubClient` | `GITHUB_TOKEN` | `get_repository`, `search_repositories` |
| Nessie | `NessieClient` | `NESSIE_API_KEY` | `list_customers`, `list_accounts`, `get_account`, `list_purchases`/`deposits`/`transfers`/`bills`, `list_merchants` |
| Snowflake | `SnowflakeClient` | `SNOWFLAKE_ACCOUNT_HOST`, `SNOWFLAKE_TOKEN`; optional token type/warehouse/database/schema/role | SQL REST API with bound parameters and bounded status polling; internal server use only |
| Snowflake Cortex | `CortexClient` | Same host/token; optional `SNOWFLAKE_CORTEX_MODEL` | Bounded text generation through Cortex REST; account default role needs Cortex permissions; internal server use only |
| Tiger Data | `TigerDataClient` | `TIGERDATA_DSN`, optional `TIGERDATA_SSL_ROOT_CERT` | Parameterized PostgreSQL event methods with verify-full TLS; apply explicit schema first |
| Maps | `MapsClient` | `MAPS_PROVIDER` (`mapbox`/`google`), `MAPS_API_KEY` | `geocode(query, limit=)` |
| Email | `EmailClient` | `RESEND_API_KEY`, `EMAIL_FROM` | `send_email(to, subject, html, ...)` |
| Slack / Discord | `NotificationClient` | `SLACK_WEBHOOK_URL`, `DISCORD_WEBHOOK_URL` | Webhook hosts are pinned in Settings |

All AI clients share one interface, so callers can switch provider without code changes:

```python
from pydantic import BaseModel


class Summary(BaseModel):
    title: str
    bullet_points: list[str]


ai = integrations.ai("openai")  # or "gemini" | "anthropic" | "grok"
result = await ai.generate_text(user_prompt, system=system_prompt, max_tokens=300)
summary = await ai.generate_structured(document_text, Summary, system="Summarise the document.")
```

Prompts are always supplied by the caller; none are hardcoded. Treat model output as untrusted
data: `generate_structured` validates it against your schema, and nothing should let it trigger
privileged actions.

`integrations.ai(name)` returns the `app.ai.providers` subclass of each client, which adds
streaming and image/PDF input. Application features should go through `AIService` (versioned
prompts, limits, history) — see [`app/ai/README.md`](../ai/README.md).

## Where credentials go

`backendFINAL/.env` (git-ignored; template in `.env.example`). Every key is optional — the
backend starts without any of them, `GET /api/v1/integrations/status` reports which are set, and
calling an unconfigured integration returns 503 `INTEGRATION_NOT_CONFIGURED` naming the variable.

Never put these keys in the frontend or in any `NEXT_PUBLIC_*` variable. Keys are `SecretStr` in
`Settings`, so they don't appear in reprs or logs.

## Adding a provider

1. Add `my_service_api_key: SecretStr | None = None` to `app/core/config.py` and the variable
   to `.env.example`.
2. Create `app/integrations/my_service/client.py`:

   ```python
   class Widget(BaseModel):
       id: str
       name: str


   class MyServiceClient(ExternalService):
       service_name: ClassVar[str] = "my_service"
       env_var: ClassVar[str] = "MY_SERVICE_API_KEY"
       base_url: ClassVar[str] = "https://api.my-service.com/v1"
       # Defaults: Bearer auth, 15 s timeout, RetryPolicy(). Override auth_headers()/auth_params()
       # for other auth schemes, or set timeout_seconds / retry.

       async def get_widget(self, widget_id: str) -> Widget:
           if not widget_id.isalnum():  # validate anything that goes into the path
               raise ValueError("invalid widget id")
           return await self.call("GET", f"/widgets/{widget_id}", model=Widget)
   ```

3. Construct it in `Integrations.__init__` (`registry.py`) and add it to `status()`.
4. If the frontend needs it, add a route in `app/modules/integrations/router.py` with a
   validated request schema, `RateLimitedUser` (or `AdminUser`) and any data-exposure policy in
   `service.py`. Never accept URLs or hostnames from the client.
5. Add tests with `MockApi` (below).

For a new AI provider subclass `AIClient` (or `OpenAICompatibleClient` if the API is
OpenAI-compatible — usually just three class attributes). For a new email or geocoding provider
subclass `EmailProvider` / `GeocodingProvider`; `EmailClient` / `MapsClient` and the routes stay
unchanged.

## How the frontend accesses integrations

Through the backend only, with the user's Supabase access token (sent automatically by
`frontendFINAL/src/lib/api.ts`):

```ts
import { backendApi } from "@/lib/api";

const status = await backendApi.integrations.status();
const repo = await backendApi.integrations.githubRepository("vercel", "next.js");
```

AI text generation for the frontend is `POST /api/v1/ai/generate` (`aiApi` in
`frontendFINAL/src/lib/ai.ts`), which adds prompt limits and history.

| Route | Auth | Notes |
|---|---|---|
| `GET /integrations/status` | user | Booleans only; no network calls |
| `GET /integrations/github/repos/{owner}/{repo}` | user, rate limited | Public repositories only (private → 404) |
| `GET /integrations/github/search?q=&sort=&per_page=&page=` | user, rate limited | Private results filtered out |
| `GET /integrations/maps/geocode?q=&limit=` | user, rate limited | |
| `POST /integrations/email/test` | user, rate limited | Sends only to the caller's own (JWT) address |
| `POST /integrations/notifications` | admin, rate limited | Slack/Discord; mentions disabled |

The rate limit is `INTEGRATIONS_RATE_LIMIT_PER_MINUTE` per user (default 20), in memory and per
process — enough to stop a runaway client burning paid credits; use Redis for anything stricter.

## Mocking integrations in tests

No test needs real keys or network. `tests/mock_api.py` provides `MockApi`, built on
`httpx.MockTransport`: it returns scripted replies (responses, exceptions, or callables; the last
one repeats) and records every request.

```python
from tests.mock_api import MockApi


async def test_get_widget() -> None:
    api = MockApi(httpx.Response(503), httpx.Response(200, json={"id": "w1", "name": "Widget"}))
    client = MyServiceClient(api.client(), SecretStr("test-key"))

    widget = await client.get_widget("w1")

    assert widget.name == "Widget"
    assert len(api.requests) == 2  # GET retried after 503
    assert api.last.headers["Authorization"] == "Bearer test-key"
```

- Use the `instant_retries` fixture (`pytestmark = pytest.mark.usefixtures("instant_retries")`)
  to skip backoff sleeps, or pass `sleep=` to `HttpClient` to record them.
- Route tests: build `Integrations(build_settings(openai_api_key="sk-test"), api.client())` and
  pass it as the third argument of `client_factory(db, settings, integrations)`.
- `build_settings()` ignores `os.environ` and `.env`, so real keys never leak into tests.

Test files: `test_integrations_http.py` (HTTP client + base adapter), `test_ai_clients.py`,
`test_integration_clients.py` (GitHub, maps, email, notifications, registry),
`test_integrations_routes.py`.
