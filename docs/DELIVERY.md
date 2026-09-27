# Sequential delivery record

Work proceeds in numerical order. Each area has four gates: implementation review, offline behavior checks, reproducible setup, and live acceptance. Prior parallel implementation is retained, but does not automatically pass these gates.

The user has no Supabase project yet and requested setup/verification steps. Hosted checks remain pending credentials; they are not represented as locally proven. No preview server is started.

## 1. Full-stack platform and database

**Process:** install dependencies; configure frontend/API origins; create Supabase; apply `0001_core.sql`; create two Auth accounts; customize `seed.sql`; create/read/update/delete a project. The API bounds inputs, derives ownership from verified identity, preserves RLS, and redacts upstream failures.

**Offline gate:** core configuration/CORS/error/health tests and `test_identity.py`; frontend types/build; review SQL grants, constraints, immutable ownership, and transactions.

**Live gate:** follow `database/README.md` and run `database/tests/rls.sql` with two real test-account UUIDs. Require owner access, cross-owner denial, viewer read-only behavior, editor updates, owner-only membership management and revoked access. Refresh the UI to prove persistence. The verification rolls back its records.

## 2. Deployment and DevOps

**Process:** checks; source push preserving repository history; Supabase test project; backend Docker to Railway/Render; frontend to Vercel; exact HTTPS origins, secrets, Auth redirects, health checks. See `DEPLOYMENT.md`.

**Offline gate:** review build context, dependency constraints, CI commands, examples and host configuration; frontend production build. Docker execution requires a Docker runtime.

**Live gate:** green CI for release commit, HTTPS health and authenticated CRUD, disallowed-origin behavior, rollback rehearsal and redacted logs. Apply migrations before compatible code. No cloud deployment/domain has been created.

## 3. Authentication and security

**Process:** enable email/password and Google in Supabase; configure exact redirect allowlist; register/confirm, login, reload/renew session, logout. Backend validates tokens; only server-controlled app metadata grants admin.

**Offline gate:** missing/invalid tokens rejected; no client-supplied owner/role accepted; row access preserved; privileged public keys rejected; HTTPS provider origins and sanitized errors. Review callback handling and cleanup.

**Live gate:** independent accounts, expired/revoked tokens, Google success/cancel/error, email confirmation, admin denial and session renewal. No secrets in built client assets.

## 4. AI application infrastructure

**Process:** set a key and explicit text model; text request; structured JSON; stream; image analysis; inspect usage; switch providers through the same API. Configure prices for cost estimates.

**Offline gate:** `test_ai_providers.py`: payload mapping, three stream formats, SSE framing, retry/error handling, structured validation, embedding dimensions/numeric validity and usage. Bound payloads and images.

**Live gate:** exercise each configured provider/model; validate capabilities, quotas, cancellation, schemas and pricing. Anthropic embeddings are unsupported. Unknown prices remain null. Audio/video and structured streaming are extension work.

## 5. Agents and RAG

**Process:** ingest text/Markdown; embed chunks; retrieve with excerpts; create bounded agent run; inspect persisted steps; approve/reject proposed project creation; reopen history.

**Offline gate:** `test_ai_workflows.py` and `test_rag.py`: chunk bounds, retrieval filters, citations, scoped persistence, bounded history, allowlisted tools, invalid decisions, approval ownership and duplicate protection. Documents are untrusted input.

**Live gate:** prove two-account document isolation and embedding-model consistency; interrupted calls, rejected proposals, repeated approval. Durable background workers/crash recovery are not implemented. PDFs need an extraction adapter.

## 6. UI design system

**Process:** adapt landing (`/welcome`), workspace (`/`) or assistant (`/chat`). Reuse forms, cards, buttons, tables, dialogs, tabs, toasts, chat and upload controls.

**Offline gate:** lint/types/build and browser streaming-parser tests; inspect labels, focus, keyboard controls, mobile and reduced-motion styles; no fabricated service success. Command/Control+K navigation and a reusable accessible bar chart are included.

**Live gate:** keyboard/touch walkthrough, narrow/wide screens, dialog focus restoration, screen-reader labels, live workflows and disconnected states. Visual browser verification awaits a hosting choice.

## 7. External API framework

**Process:** public GitHub repositories with pagination; configure Maps, Slack, Discord, Twilio, Spotify or YouTube credentials. Shared-credential operations require admin; outgoing messages also require `confirm: true`.

**Offline gate:** `test_integrations.py`: fixed provider origins, bounds, admin/confirmation checks, normalization, GET retries, no automatic write retry, cache scope and OAuth state binding. Tests send no messages.

**Live gate:** least-privilege test credentials; read call for each enabled provider; explicitly approved test destinations for messaging; pagination/quotas. PKCE/state helpers are building blocks, not a full delegated OAuth callback/token vault. Spotify uses client credentials.

## 8. Payments and events

**Process:** Stripe test keys/allowed price; authenticated checkout; hosted payment; signed webhook; transactional event deduplication updates owner-scoped order/subscription state. Portal uses the user's recorded customer.

**Offline gate:** HMAC/timestamps, raw-body verification, malformed events, trusted metadata, price allowlist, live-mode opt-in, idempotency, RPC payload and database permissions. Apply `0002_billing.sql` after core.

**Live gate:** test success/cancel/failure, subscription lifecycle, duplicate/reordered events, owner-only status, portal and service-role-only RPC. Run `database/tests/billing.sql` with two configured test accounts. No actual payment is made during development. An event alone does not establish entitlement without checking its authoritative status.

## 9. Multimodal and realtime

**Process:** bounded image upload for vision/OCR prompts; text upload for RAG; private Supabase project presence and owner notifications. Optional WebSocket `/api/v1/realtime/projects/{uuid}` authenticates its first JSON frame and shares bounded state.

**Offline gate:** `test_realtime.py`: auth timeouts, malformed/binary frames, project access, viewer writes, state limits, revoked/slow/broken peers and disconnect presence. Vision tests are under area 4.

**Live gate:** two authorized sessions and an outsider; private-channel denial, join/leave, role enforcement, reconnect and revoked membership. Supabase permissions refresh on join/reauthorization. Python rooms are single-process and ephemeral; durable distributed rich-text collaboration is further work.

## Verification evidence

Sequential offline review completed on 2026-09-27. Final root command `npm.cmd run check` exited 0:

- Frontend: ESLint, TypeScript, 7 Node tests, and Next.js production build passed.
- Backend: Ruff lint/format, 145 pytest cases, and `pip check` passed.
- No listeners on ports 3000 or 8000 after verification.

| Area | Evidence completed | Remaining gate |
| --- | --- | --- |
| 1 | 57 core/identity tests; frontend types; schema/access review; setup/seed/RLS scripts | Run migrations and two-account RLS against Supabase |
| 2 | Production build; host config review against official docs; dependency constraints and CI | Docker build/runtime, cloud release and CI execution |
| 3 | Token/role/ownership tests; logout-race fix; public-secret build guards | Real signup, Google callbacks, session renewal and browser authorization |
| 4 | 15 provider tests | Each provider/model with actual credentials |
| 5 | 11 agent/RAG tests | Hosted vector retrieval, cross-account RLS and provider quality |
| 6 | Lint/types/build; 7 shared frontend tests; command menu/chart and component review | Hosted visual, keyboard and screen-reader walkthrough |
| 7 | 15 integration tests; malformed-response handling and access checks | Real provider credentials/permissions; delegated OAuth is an extension template |
| 8 | 28 billing tests; hosted duplicate/order/RLS SQL prepared | Execute SQL and Stripe test-mode lifecycle |
| 9 | 19 realtime/vision tests; cancellation-safe disconnect cleanup; private notification channels | Two-client hosted workflow, provider vision quality and channel authorization |

Counts overlap between areas 1/3 and shared frontend checks; total unique backend cases are 145, not a sum of repeated gates. Node emits a harmless module-type detection warning during frontend tests. Docker/PostgreSQL command-line runtimes were not available, and no Supabase account was configured. No hosted migrations, OAuth callbacks, real provider requests, payments, browser preview, or production release are marked verified. No Git commit or GitHub push has been made.

The interrupted parallel work was retained and reviewed one area at a time. This record is an acceptance boundary, not a production-readiness certificate. Use [deployment](DEPLOYMENT.md), [integrations](INTEGRATIONS.md), [realtime](REALTIME.md), and the database verification scripts for the remaining setup-dependent checks.
