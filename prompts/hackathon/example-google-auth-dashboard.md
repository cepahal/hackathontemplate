# Example: Google Auth + Activity Dashboard

Use with `prompts/features/autonomous-feature-delivery.md`.

## Request
Add Google authentication and a dashboard showing the user's activity.

## Expected agent behavior
1. Inspect existing auth/session patterns and dashboard scaffolds
2. Prefer Supabase Auth / Auth.js / existing provider — do not roll custom OAuth crypto
3. Minimal schema: `profiles`, `activity_events` (or reuse equivalents)
4. Vertical slice: login → callback → session → dashboard list
5. Enforce ownership on activity queries
6. UI: loading/error/empty on dashboard
7. Verify: manual auth click-path + any existing tests
8. Report demo steps and residual risks (callback URLs, env vars)

## Non-goals (unless time band is 12+)
- Full admin analytics
- Perfect design system
- Multi-provider auth
