# Environment variables

For the optional Gemini, Snowflake, Tiger Data, and Photon setup, see
[API_SETUP.md](API_SETUP.md). Snowflake uses `SNOWFLAKE_ACCOUNT_HOST` and `SNOWFLAKE_TOKEN`
with optional warehouse/database/schema/role context. Tiger Data uses `TIGERDATA_DSN` and
optional `TIGERDATA_SSL_ROOT_CERT`. Actual Photon Spectrum credentials are
`SPECTRUM_PROJECT_ID` and `SPECTRUM_PROJECT_SECRET` in `services/photon/.env`;
the legacy backend `PHOTON_API_KEY` placeholder is not used by that service.

All configuration comes from environment variables. Real values never go in git, the Dockerfile,
or frontend code. Templates (no real values): [`../.env.example`](../.env.example) (everything, split
into public/secret), `frontendFINAL/.env.example`, `backendFINAL/.env.example`.

| Where | Local file (git-ignored) | Production |
|---|---|---|
| Frontend | `frontendFINAL/.env.local` | Vercel → Project → Settings → Environment Variables (then redeploy) |
| Backend | `backendFINAL/.env` | Railway → Variables, or Render → Environment (or `docker run -e` / `--env-file`) |
| CI | none | Hard-coded public placeholders in the workflow; no secrets |

## The one rule

**`NEXT_PUBLIC_*` = public.** Next.js inlines these into the JavaScript bundle at build time; anyone
can read them. Never put a service-role key, `sb_secret_…` key, AI key, token or webhook URL behind
that prefix. Guards: `frontendFINAL/src/lib/supabase/config.ts` refuses a secret key in the public
Supabase variable, the backend refuses a secret key in `SUPABASE_ANON_KEY`, and the CI `hygiene` job
fails if a secret-looking name gets the prefix.

## Frontend

FRONTEND PUBLIC VARIABLES (safe in the browser; RLS protects the data):

| Variable | Required | Example | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | `https://abcd.supabase.co` | Supabase → Project Settings → Data API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | `sb_publishable_…` | Publishable or legacy anon key. `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is accepted as an alias |
| `NEXT_PUBLIC_API_URL` | yes in prod | `https://api.up.railway.app` | Backend origin, no trailing slash. Default `http://localhost:8000` |

## Backend

BACKEND SECRET VARIABLES (server-side only). Validated at startup by `backendFINAL/app/core/config.py`;
the app refuses to start and lists every problem if something is wrong. Values are held as
`SecretStr` and never logged or returned by the API.

### Core

| Variable | Required | Default | Notes |
|---|---|---|---|
| `SUPABASE_URL` | **yes** | — | `https://<ref>.supabase.co` (https required except localhost) |
| `SUPABASE_ANON_KEY` | **yes** | — | Same public key as the frontend. Requests run with the caller's JWT, so RLS applies |
| `FRONTEND_URL` | yes in prod | `http://localhost:3000` | Exact allowed CORS origin, no path |
| `CORS_ORIGINS` | no | — | Extra origins, comma-separated. `*` is rejected |
| `ENVIRONMENT` | no | `development` (image: `production`) | `production` disables `/api/v1/docs` and the OpenAPI schema |
| `LOG_LEVEL` | no | `INFO` | |
| `SUPABASE_SERVICE_ROLE_KEY` | no | — | **Bypasses RLS.** Not used by any route; keep it unset unless you add an admin job |
| `SUPABASE_JWT_SECRET` | no | — | Only for legacy projects signing user JWTs with HS256 (others use the public JWKS) |

### AI providers

Any subset. Unconfigured providers return `503 INTEGRATION_NOT_CONFIGURED`.

| Variable | Default model variable |
|---|---|
| `OPENAI_API_KEY` | `OPENAI_MODEL=gpt-4.1-mini` |
| `GEMINI_API_KEY` | `GEMINI_MODEL=gemini-3.8-flash` |
| `ANTHROPIC_API_KEY` | `ANTHROPIC_MODEL=claude-haiku-4-5` |
| `GROK_API_KEY` (xAI; needs credits) | `GROK_MODEL=grok-4-fast-non-reasoning` |

| Limit | Default |
|---|---|
| `AI_DEFAULT_PROVIDER` | first configured provider |
| `AI_MAX_PROMPT_CHARS` | `20000` |
| `AI_MAX_CONTEXT_CHARS` | `50000` |
| `AI_MAX_OUTPUT_TOKENS` | `2048` |
| `AI_MAX_FILE_BYTES` | `5242880` (5 MB) |
| `AI_STREAM_TIMEOUT_SECONDS` | `120` |

### External integrations (all optional)

| Variable | Used for |
|---|---|
| `GITHUB_TOKEN` | GitHub repo/search endpoints (a token with no scopes is enough for public data) |
| `NESSIE_API_KEY` | Capital One Nessie mock-banking API (HackNC sponsor track) |
| `PHOTON_API_KEY` | Legacy placeholder; actual Spectrum credentials are `SPECTRUM_PROJECT_ID` and `SPECTRUM_PROJECT_SECRET` in `services/photon/.env` |
| `SNOWFLAKE_ACCOUNT_HOST`, `SNOWFLAKE_TOKEN`, `SNOWFLAKE_TOKEN_TYPE` | Snowflake SQL and Cortex REST; account hostname only; PAT by default, OAuth supported |
| `SNOWFLAKE_CORTEX_MODEL` | Cortex text-generation model, default `claude-sonnet-4-5`; default account role needs Cortex permissions |
| `SNOWFLAKE_WAREHOUSE`, `SNOWFLAKE_DATABASE`, `SNOWFLAKE_SCHEMA`, `SNOWFLAKE_ROLE` | Optional SQL execution context; does not select Cortex's default role |
| `TIGERDATA_DSN`, `TIGERDATA_SSL_ROOT_CERT` | Independent PostgreSQL/Timescale service with verify-full TLS; apply the explicit event schema before event methods |
| `MAPS_PROVIDER`, `MAPS_API_KEY` | Geocoding: `mapbox` (default) or `google` |
| `RESEND_API_KEY`, `EMAIL_FROM` | Test email via Resend; `EMAIL_FROM` must be on a verified domain |
| `SLACK_WEBHOOK_URL`, `DISCORD_WEBHOOK_URL` | Notifications; the URL is the secret and must match the official prefix |
| `INTEGRATIONS_RATE_LIMIT_PER_MINUTE` | Per-user limit for integration and AI generation calls (default `20`, per process) |

### Container

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `8000` | Injected by Railway and Render; the container binds to it |
| `WEB_CONCURRENCY` | `1` | Uvicorn workers. Rate limits are per worker |

## Rotating a leaked key

1. Revoke it at the provider (OpenAI, Google AI Studio, GitHub, Supabase → API Keys, …).
2. Put the new value in the platform's env settings and redeploy/restart.
3. If it was committed, rotating is mandatory: removing it from git history does not un-leak it.
