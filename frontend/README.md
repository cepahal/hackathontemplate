# Frontend starter

Run commands from this directory with `npm.cmd`: `run lint`, `run typecheck`, `test`, `run build`. These checks start no preview. The root setup script installs dependencies and copies `.env.example` only if `.env.local` is missing.

Configure the HTTPS API origin, Supabase project URL and public anon/publishable key. Public variables are built into browser assets. The service-role and provider keys belong only on the backend. Missing Supabase configuration displays a setup state rather than fabricated data.

## Layouts

- `/welcome`: reusable landing page, feature grid and calls to action.
- `/`: authenticated workspace with projects, charts, AI, RAG, agents, integrations, billing, activity and membership.
- `/chat`: focused assistant layout using the same authenticated workspace components.
- `/login`: email/password, signup/confirmation and Google login.
- `/foundation`: API health diagnostic.
- `/ui`: public interactive UI library (no credentials required), with layout shells, cards and feedback examples.

`AuthGate` validates sessions through the backend. It invalidates pending verification on logout/unmount and rechecks refreshed user state. Backend authorization remains authoritative; rendering a page does not grant API access.

## Shared UI

The components under `src/components/ui/` include shadcn-style buttons/cards/badges, Radix dialogs/tabs, labeled fields, loading/error/empty feedback, toasts, a command menu and bar chart. Dialogs use Radix focus management. Navigate with Ctrl/Command+K, search, then Tab/arrows/Enter; Escape closes the menu. Charts include readable values and labels, with decorative bars hidden from assistive technologies.

`src/components/layout/` adds the reusable `AppShell`, navbar, sidebar/mobile drawer, footer and card grid. The authenticated workspace composes these same shells. See [UI library guide](../docs/UI_LIBRARY.md) for props, copyable examples and native mobile counterparts. `npm run test:ui` builds web/native browser previews and runs desktop/phone interaction and accessibility checks; install `mobile/` dependencies and Playwright Chromium first.

`BarChart` accepts `{title, data: [{label, value}]}`. Labels should be unique and values finite/nonnegative. The project chart explicitly describes its current-page scope; it does not claim a whole-account count. `CommandMenu` accepts items and an `onSelect` callback; reuse it with your own navigation.

Projects confirm deletion. Agent approval shows the saved action arguments before execution. Checkout reuses an idempotency key for a retried form and accepts only Stripe HTTPS redirect hosts. Uploads validate sizes/types; server validation remains authoritative. SSE parsing handles chunked UTF-8, CRLF framing and malformed data.

## Browser acceptance after hosting

Test narrow and wide layouts, keyboard navigation, dialog focus, toast announcements, form failures, revoked sessions, slow/disconnected services, cancellation, uploads and real provider responses. Run signed-in CRUD with two accounts and verify all role boundaries. Builds and parser tests are not a substitute for this browser walkthrough. No browser preview was started for the sequential verification.
