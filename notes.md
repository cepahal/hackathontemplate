# Hackathon API implementation notes

Target: the original `cepahal/hackathontemplate` GitHub repository, branch `codex/hacknc-setup`.
Scope: generic API infrastructure only. Winning strategy and event product features are separate.

## Changes

- Imported the existing template and installed the canonical frontend/backend dependencies.
- Kept Supabase auth and application storage; Gemini is the example environment's default AI provider.
- Added optional Snowflake SQL REST and Tiger Data PostgreSQL adapters to the existing backend registry.
- Added the official Photon Spectrum Node service with local terminal and managed iMessage modes,
  plus optional Gemini replies. It remains separate from Supabase-authenticated web routes.
- Added root setup, dev, doctor, guarded Gemini smoke, and configuration-test commands.
- Public frontend previews work without Supabase credentials; protected routes still require login.
- Preserved the existing shared Nessie adapter work. No real banking or production data is used.

## Environment and architecture

See [API_SETUP.md](finalfrontentbackend/docs/API_SETUP.md) for exact account steps, variables,
package installation, run commands, and architecture. Backend values belong in
`finalfrontentbackend/backendFINAL/.env`; Photon values belong in `services/photon/.env`.
Only blank/example values are committed. Snowflake and Tiger Data are independent databases;
this starter does not replace Supabase or automatically replicate between them.

## Account status

- Gemini: dedicated project creation attempted; Google Cloud requires the user to enable two-step
  verification. No new Gemini key has been created or live tested.
- Snowflake and Tiger Data: adapters prepared; account credentials and live connections remain pending.
- Photon: signed-in dashboard checked and a dedicated free project created. `HACKWITHPHOTON` was accepted at checkout, with $0 today
  and $25/month renewal next month. Subscription was not activated; user completion and Link
  verification and account phone enrollment remain required. No Spectrum secrets saved or live iMessage test yet.

## Verification log

- Before the new database adapters: backend 349 pytest tests, Ruff, and strict mypy passed.
- Frontend lint, typecheck, and production build passed; public routes returned HTTP 200 and
  protected routes redirected to login.
- Setup checks passed; review added coverage for the supported Supabase publishable-key alias.
- Photon SDK terminal exchange and missing-credential guard passed before Gemini reply support.
- Final merged checks: 416 backend tests passed; strict mypy passed for 92 files; pip check passed;
  7 setup/config tests and 10 Photon tests passed; Photon and frontend typechecking passed.
- Ruff found a false positive treating the Snowflake authentication-mode string as a hardcoded
  credential. Its Pydantic Field declaration was adjusted; final Ruff passed, targeted strict
  mypy passed, and the affected configuration/integration suites passed all 98 tests.
- Live provider connections are not verified. The branch is ready for publication to the original
  template; no event strategy files or local account screenshots are included in this API change.
