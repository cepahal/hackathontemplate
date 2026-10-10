# Tiger Data / PostgreSQL telemetry

Optional backend-only adapter. Constructor and `configured` perform no network requests.
`health()` checks connectivity explicitly; `record_event()` and `list_events()` require the
operator-created schema. No automatic migration, extension install, startup probe, or retry.

Configuration: backend `TIGERDATA_DSN` (secret) and optional `TIGERDATA_SSL_ROOT_CERT` (trusted
CA file path). The adapter always forces `sslmode=verify-full` and disables GSS encryption so
TLS validates the server certificate and hostname. Provide valid CA trust; never weaken TLS to
work around an error. Credentials belong in ignored backend environment configuration only.
[PostgreSQL TLS documentation](https://www.postgresql.org/docs/current/libpq-ssl.html).

## Explicit database setup

1. Review and explicitly execute [schema.sql](schema.sql) on a dedicated database as its migration
   owner. This creates `integration_metrics.event_ids` and `integration_metrics.events`.
2. Use the commented grants to give the backend role schema USAGE and table SELECT/INSERT.
   Keep this schema private and do not expose it through a public API.
3. Standard PostgreSQL needs no further file. For TimescaleDB only, optionally execute
   [hypertable.sql](hypertable.sql) **after schema.sql** to convert the events table. These are
   sequential files, not mutually exclusive alternatives. Conversion needs compatible TimescaleDB
   and appropriate extension/conversion privileges; review conversion of populated tables.

The regular ID ledger enforces global UUID uniqueness; the events table's composite foreign key
pins each UUID to its first timestamp. Keep ledger rows when retaining/pruning time-series data.
The ledger stays regular because a hypertable's unique indexes must include its time column.
[Timescale reference](https://github.com/timescale/Tiger-Data-Docs/blob/main/src/content/docs/reference/timescaledb/hypertables/create_hypertable.mdx).

## Operations and retries

`IntegrationEvent` accepts UUID, timezone-aware time, bounded `source`/`kind` operational labels,
`success`/`failure`/`pending` outcome, and optional duration in milliseconds. No message body,
provider payload, customer identifier, or arbitrary metadata field is accepted. Do not encode
personal data into labels.

- `await client.health()` returns `True` for an explicit connectivity check; it does not validate
  schema readiness.
- `await client.record_event(event)` returns `True` after commit and `False` for an existing UUID.
  The first write wins. Keep the original UUID/time when retrying an uncertain commit outcome.
- `await client.list_events(source="photon", since=aware_datetime, limit=100)` reads an inclusive
  source/time window oldest first, limited to 1–1000 rows.

All table names/queries are fixed and values are parameterized. Errors use sanitized existing
integration error types. Provider diagnostics and connection strings are not returned or logged.

## Windows runtime

Psycopg requires SelectorEventLoop on Windows. The installed Uvicorn 0.54.0 selects it when
reload/workers cause subprocess mode; `scripts/hacknc/dev.mjs` starts the backend with `--reload`,
so the standard local dev command selects a compatible loop. Verified the installed loop factories
without connecting to a provider. Direct Windows Uvicorn with no reload and one worker chooses
ProactorEventLoop and needs an explicit compatible server loop before live Tiger Data calls.
Standalone probes can use `asyncio.Runner(loop_factory=asyncio.SelectorEventLoop)`.
[Psycopg async documentation](https://www.psycopg.org/psycopg3/docs/advanced/async.html).

## Verification limits

35 mocked connection tests, Ruff and strict mypy passed. No live database/SQL migration was run.
Before claiming live readiness, authorize and run a synthetic write, duplicate retry, bounded read,
and simultaneous same-UUID writes against the actual schema; test optional conversion separately.
