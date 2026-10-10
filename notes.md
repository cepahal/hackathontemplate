# Hackathon API implementation notes

Target: the original `cepahal/hackathontemplate` GitHub repository, branch `codex/hacknc-setup`.
Scope: generic API infrastructure only. Winning strategy and event product features are separate.

## Changes

- Imported the existing template and installed the canonical frontend/backend dependencies.
- Kept Supabase auth and application storage; Gemini is the example environment's default AI provider.
- Added optional Snowflake SQL REST, Snowflake Cortex AI REST, and Tiger Data PostgreSQL adapters
  to the existing backend registry. Cortex follows the sponsor's LLM API emphasis and uses the
  existing Snowflake token; it does not require OpenAI/Gemini credentials or a new SDK.
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

- Gemini: activation resumed by the user, who is completing Google two-step verification.
  AI Studio requires Cloud-console project creation first; the account still shows the MFA gate
  at the latest refresh. No new key or live test is verified. Configure both backend and Photon
  environments and restart both after adding the key.
- Snowflake: SQL and Cortex adapters prepared. The 120-day/$400 student signup is open, pending
  the user's chosen email/country and verification. Cortex role, region/model access, token, and
  live connection remain unverified. A SQL-only warehouse is not the sponsor's full AI use case.
- Tiger Data: adapter prepared; account credentials and live connection remain pending.
- Photon: signed-in dashboard and dedicated project verified. After private checkout completion,
  Spectrum Pro became active. The agent canceled renewal immediately on the user's request;
  Stripe confirms **Plan canceled**, with access until **November 10, 2026**. Do not reactivate.
  Proof is saved only under ignored `.artifacts/`. Existing Spectrum credentials remain in the
  ignored local service environment. Account phone enrollment and live iMessage remain unverified.

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
- Live provider connections are not verified. No event strategy files or local account screenshots
  are included in this API change.
- Published branch `codex/hacknc-setup` to the original template and opened
  [PR #6](https://github.com/cepahal/hackathontemplate/pull/6). GitHub's private-email push rejection
  was resolved using this repository's local GitHub no-reply identity; global Git identity was preserved.
- GitHub CI exposed two Ruff formatting differences despite passing lint; these were corrected.
  Added 46 mocked Cortex cases; 78 combined SQL/Cortex tests and focused strict mypy/Ruff passed.
  After registry/status wiring, all 151 relevant backend tests passed, full Ruff lint and formatting
  passed, strict mypy passed for 94 files, and frontend typecheck/lint passed.
- The configuration doctor confirms Photon credentials are present but the canonical application's
  Supabase URL/public-key values remain missing/placeholders. Public previews do not establish a
  working authenticated backend. Snowflake/Tiger do not replace Supabase auth or migrations.
- All GitHub checks passed for published Cortex/API commit `6064a1e` on PR #6.
- Follow-up readiness checks now distinguish SQL from Cortex, verify Photon's Node 24/SDK
  prerequisites, report its separate Gemini environment, and check the installed psycopg import.
  All 10 setup/config tests and JavaScript syntax checks passed. Provider readiness remains
  separate from account enrollment, model authorization, and actual delivery.

## October 10 kickoff audit

The operational [start scope guide](finalfrontentbackend/docs/START_SCOPE.md) records the existing
API baseline, pending account setup, ownership, and acceptance criteria for the first complete
workflow. No product name or project concept has been selected by this API setup work.

- Official hacking runs Saturday 11:30 AM EDT to Sunday 10 AM EDT. At 10 AM, prioritize check-in
  (ends 10:30 AM), opening, account preparation, user interviews, and a demo plan. Preserve the
  imported template baseline `ac389e3015985dae0ae090bcf9bc9c9141cb7cd8` and this pre-start setup
  history. Ask organizers whether the personal template and generic preparation are eligible;
  do not assume MLH's framework allowance overrides event rules.
- Maximum four human teammates; confirm each person's registration, check-in, and prize eligibility.
  General or eligible Beginner is required. Beginner needs more than half the team to be first-time
  hackathon participants. Disclose AI assistance and be able to explain the actual code.
- Draft the submission on the actual 2026 Devpost, add all teammates, and plan the mandatory GitHub
  link and video of no more than two minutes. The Notion submission page's 2026-labelled link
  currently points to 2025. Confirm Photon/Nessie entry instructions and award stacking with an
  organizer; unlimited track entries do not prove unlimited award collection.
- Photon Free/Pro shared lines require exact recipient allowlisting; ask the sponsor how judges
  will test the project. Do not assume the Pro promo supplies a dedicated, publicly textable number
  or Business group-chat features. Spectrum needs a long-running Node/Bun runtime with gRPC.
- Before implementation, choose one user, one task, one stored outcome, and one failure/duplicate
  case. Prepare a two-minute demo outline and bounded file ownership. Validate one useful live
  interaction before adding more optional services. Keep the Photon model bridge and full
  authenticated application clearly marked as unfinished until implemented and live tested.

Sources: [official 2026 Devpost and rubric](https://hacknc-2026.devpost.com/),
[schedule](https://past-cushion-a6f.notion.site/Schedule-80b816442900839bb2cd014849f3410f),
[submission instructions](https://past-cushion-a6f.notion.site/IMPORTANT-Submission-Instructions-648816442900823890388190be1f899e),
[tracks](https://past-cushion-a6f.notion.site/HackNC-Tracks-756816442900834e900c016919f003e8),
[MLH standard rules](https://github.com/MLH/mlh-policies/blob/main/standard-hackathon-rules.md),
[Photon routing](https://photon.codes/docs/spectrum-ts/providers/imessage/connection-and-routing).
