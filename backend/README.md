# FastAPI foundation

Requires Python 3.11 or newer. From this directory on Windows:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --no-cache-dir -r requirements-dev.txt
Copy-Item .env.example .env
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Copy `.env.example` only when creating your configuration; keep an existing `.env` when reinstalling.
On macOS/Linux, replace `.\.venv\Scripts\python.exe` with `.venv/bin/python`.

- Health: <http://localhost:8000/health>
- Interactive API reference: <http://localhost:8000/docs>
- OpenAPI schema: <http://localhost:8000/openapi.json>

`GET /health` reports API liveness:

```json
{"status":"ok","service":"hackathon-api","environment":"development","version":"0.1.0"}
```

The feature modules connect to Supabase and optional external providers when configured. Health checks only process liveness, not those services. See the root README and `docs/DELIVERY.md` for the nine-area verification process.
Feature endpoints should be registered in `app/api/router.py`; `main.py` mounts that router under
`/api/v1`. Copy the inactive [feature template](templates/feature/README.md) when adding a feature.

## Configuration

`app/core/config.py` reads `backend/.env` using an absolute path and then applies process environment
overrides. Invalid values fail at startup.

| Variable | Default | Purpose |
| --- | --- | --- |
| `APP_ENV` | `development` | `development`, `test`, or `production` |
| `LOG_LEVEL` | `INFO` | `DEBUG`, `INFO`, `WARNING`, `ERROR`, or `CRITICAL` |
| `CORS_ORIGINS` | `localhost:3000` and `127.0.0.1:3000` HTTP origins | JSON array of exact HTTP(S) origins |

For example, `CORS_ORIGINS=["https://app.example.com"]`. Wildcards, credentials, and URL paths are
rejected. CORS controls browser access; authenticated routes separately validate bearer tokens through Supabase. Cross-origin cookies are disabled because the API uses explicit bearer authorization.

Responses carry `X-Request-ID`. API errors use
`{"error":{"code":"http_404","message":"Not Found","request_id":"..."}}`.
Validation failures additionally contain field locations, types, and messages, without echoing the
input body. Unexpected exceptions return a generic 500 response and are logged on the server with
their request ID. CORS preflight failures use the middleware's standard plain-text response.

## Checks and dependencies

```powershell
.\.venv\Scripts\python.exe -m pytest
.\.venv\Scripts\python.exe -m ruff check .
.\.venv\Scripts\python.exe -m ruff format --check .
.\.venv\Scripts\python.exe -m pip check
```

`pyproject.toml` declares supported dependency ranges. `requirements.lock` constrains the resolved
versions tested together on Windows/Python 3.12. `requirements-dev.txt` installs the editable app and
development tools; `requirements.txt` installs just the editable runtime dependencies. Platform-only
dependencies required on other operating systems are still resolved by pip.

After deliberately upgrading dependencies, rerun the checks and regenerate `requirements.lock` with
`python -m pip freeze --exclude-editable` from this virtual environment. Save the output as UTF-8 and
retain the header comment. Never commit virtual environments, `.env`, or `*.egg-info` build output.

Official references: [FastAPI CORS](https://fastapi.tiangolo.com/tutorial/cors/),
[error handlers](https://fastapi.tiangolo.com/tutorial/handling-errors/), and
[settings](https://fastapi.tiangolo.com/advanced/settings/).
