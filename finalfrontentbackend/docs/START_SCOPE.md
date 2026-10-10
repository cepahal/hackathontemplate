# HackNC starting scope

Updated October 10, 2026. This is an operational checklist, not a selected product or a
prediction of winning. Ideas and track combinations in earlier strategy documents remain
proposals. No product name or user journey has been approved.

## What already exists

The canonical application is `finalfrontentbackend/`: Next.js frontend, FastAPI backend,
and Supabase Auth/application migrations. Generic API work is published to the original
`cepahal/hackathontemplate` in [PR #6](https://github.com/cepahal/hackathontemplate/pull/6).

- Root setup/dev/doctor commands preserve ignored environment files and report configuration
  without exposing secrets. Public previews work without Supabase; protected routes still
  require authentication.
- Optional Snowflake SQL and Cortex REST adapters are registered in the backend. Cortex uses
  Snowflake credentials and does not require an OpenAI or Gemini key.
- Tiger Data has a PostgreSQL adapter, explicit event schema, and optional Timescale conversion.
- `services/photon/` has the official Spectrum SDK, local terminal mode, managed iMessage mode,
  and optional Gemini text replies. It is separate from authenticated FastAPI routes.
- Shared Nessie mock-banking reads are preserved. They do not implement payments or refunds.

The lead's verification log records passing local backend tests, lint/typechecks, frontend
checks, and Photon terminal tests. These checks do not establish live provider access or a
working event product. See [notes.md](../../notes.md) and [API_SETUP.md](API_SETUP.md).

## Current account and runtime gates

| Service | Current evidence | Remaining work |
|---|---|---|
| Photon | Project credentials saved only in ignored local service env. Lead verified Stripe **Plan Canceled**, with Pro access continuing until **November 10, 2026**. | Genuine account phone enrollment/SMS verification, exact tester allowlisting, and a live iMessage round trip remain unverified. Renewal cancellation is complete; do not repeat checkout. |
| Snowflake | SQL/Cortex adapters and environment examples exist. Student signup was observed offering 120 days/$400 usage. | Complete signup with the user's chosen email/country and verification; obtain a scoped token; verify the default role and region/model access with one bounded Cortex request. No live request is established. |
| Tiger Data | Adapter and explicit SQL are prepared. | Create/connect the dedicated service, obtain the DSN/trust configuration, apply the event schema explicitly, and verify one insert/read. No live connection is established. |
| Supabase | Existing Auth integration and ordered migrations are retained. Doctor reported missing/placeholder configuration. | Configure the dedicated project, apply existing migrations, verify login and an authorized backend request, and test isolation between two users. |
| Gemini | Existing adapter remains; no dedicated key or live request. Google Cloud project creation encountered user-only two-step verification. | User must complete the Google security step before project/key creation can continue. Keep keys blank until actual activation; do not treat the example AI default as live access. |

Photon Free/Pro use shared lines and require the recipient's exact iMessage phone/email in the
project's Users list. Dedicated lines, group creation, and inbound group-change events require
Business. Confirm any special hackathon entitlement with the sponsor before promising a single
public number or group workflow. Cloud Spectrum requires a long-running Node/Bun runtime with
gRPC; a strict Edge/worker runtime is unsuitable. [Photon routing](https://photon.codes/docs/spectrum-ts/providers/imessage/connection-and-routing),
[allowlisting/runtime](https://photon.codes/docs/spectrum-ts/troubleshooting/imessage).

Snowflake Cortex uses the user's **default role**, with `SNOWFLAKE.CORTEX_USER` or
`SNOWFLAKE.CORTEX_REST_API_USER`; model availability varies by account/region. SQL-role settings
do not select Cortex's role. Live calls consume credits. [Cortex setup](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-rest-api).

## Before the official start

Published hacking starts Saturday **11:30 AM Eastern** and submission closes Sunday **10 AM
Eastern**. Before starting event-specific implementation, resolve the imported personal-template
and pre-start API-preparation eligibility question with organizers. Preserve baseline commit
`ac389e3015985dae0ae090bcf9bc9c9141cb7cd8` and the preparation history; do not erase provenance.
Permission to use ordinary frameworks does not itself settle this exception.

1. Confirm every human teammate's registration/check-in and prize eligibility; maximum four
   human teammates. Choose General, or Beginner only if the actual team qualifies.
2. Ask organizers how to opt into Photon/Nessie if missing from Devpost, whether awards can
   stack, and whether the disclosed template/pre-start preparation may be used.
3. Finish user-controlled account verification, prepare ignored env values, and agree on one
   user, one problem, one stored outcome, and one failure case. Interview prospective users.
4. Assign an integrator and bounded file ownership. Prepare the two-minute demo outline and
   current-2026 submission draft, including all teammates, GitHub link, and mandatory video.

Sources: [2026 Devpost](https://hacknc-2026.devpost.com/),
[schedule](https://past-cushion-a6f.notion.site/Schedule-80b816442900839bb2cd014849f3410f),
[submission instructions](https://past-cushion-a6f.notion.site/IMPORTANT-Submission-Instructions-648816442900823890388190be1f899e),
[tracks](https://past-cushion-a6f.notion.site/HackNC-Tracks-756816442900834e900c016919f003e8).

## First vertical slice after hacking opens

Product decision is pending. Use this acceptance contract for the chosen workflow:

1. A consenting, enrolled tester sends a real iMessage; Spectrum receives it and produces one
   useful response. Terminal mode remains a clearly labeled development fallback.
2. One selected live model proposes bounded task fields; application validation and explicit
   human confirmation control the action. The current Photon service is not connected to
   Snowflake Cortex; that bridge is still implementation work.
3. The confirmed action creates exactly one authorized application record. A phone identifier
   is not a Supabase JWT: define identity binding and actor permissions before bridging routes.
4. A minimal screen or follow-up message shows the stored result and the next human action.
   Reloading must retain the result; starter React sample state does not satisfy persistence.
5. Replay the same inbound event and verify no duplicate action. A provider timeout must show
   a recoverable pending/error state rather than invented success.

Keep Supabase as the current owner of authentication and application records. Snowflake can
supply Cortex inference without a second application database. Tiger Data can record a bounded
event timeline if the selected feature needs it. These are independent services, with no automatic
replication or cross-database transaction. Do not make optional event storage block the core action
without an explicit recovery design.

The slice is ready only after a real inbound/outbound exchange, authorized persistence, one
failure/duplicate check, and a reproducible two-minute demo have actually been observed. Record
configured, locally tested, live verified, and still blocked separately. Freeze optional additions
until this path works; installed packages and prize selections are not a completed product.
