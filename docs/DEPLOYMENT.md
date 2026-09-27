# Deployment runbook

These are deployment files and instructions. No cloud resources have been created and no servers are running as part of generating them. Production credentials, project access, pricing choices, DNS, and OAuth consent must be configured in your accounts.

## 1. Supabase

Create/select a Supabase project. Apply the SQL migrations under `database/migrations/` in filename order using the SQL editor or your chosen migration runner. Review them before applying; do not rerun already applied migrations. Follow `database/README.md` for role isolation and verification. Store secrets in the backend host's secret settings, never in GitHub source or browser variables.

Enable email/password authentication. Configure Google under Authentication > Providers using your Google OAuth client. Configure the Supabase site URL and exact allowed frontend callback URLs. Avoid wildcard production redirect URLs. Copy the public URL and anon/publishable key to frontend and backend settings. The service-role key is backend-only, used for verified payment webhook processing; user CRUD uses the user's JWT and RLS.

## 2. Backend: choose Render OR Railway

**Render:** import `render.yaml` as a Blueprint, choose the desired region/plan, and fill the unset environment values. Automatic deploys are disabled by the template; trigger an initial deploy after configuration.

**Railway:** create a service from your repository, set its Root Directory to `backend`, and set its Config File path to `/backend/railway.toml`. The Dockerfile is relative to that service root. Add a public HTTPS domain in Railway settings and configure the backend environment.

Both build the non-root Python container, honor the platform's `PORT`, expose `/health`, and emit request IDs and timing logs. Binding `0.0.0.0` in the Dockerfile is for the cloud container; it does not start anything on your laptop. Configure proxy trust only for the deployment platform's proxies. Configure provider quotas/rate limits at the gateway before broad public access.

Minimum backend settings:

```dotenv
APP_ENV=production
CORS_ORIGINS=["https://YOUR_FRONTEND_DOMAIN"]
APP_PUBLIC_URL=https://YOUR_FRONTEND_DOMAIN
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=YOUR_PUBLIC_KEY
```

Add provider keys from `backend/.env.example` only for modules you use. Missing provider configuration intentionally returns a setup error. Keep test Stripe keys until the complete test flow has passed.

## 3. Frontend: Vercel

Import the same GitHub repository into Vercel. Set Root Directory to `frontend`, framework Next.js, install command `npm ci`, and build command `npm run build`. Configure:

```dotenv
NEXT_PUBLIC_API_URL=https://YOUR_BACKEND_DOMAIN
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLIC_KEY
```

Public environment variables are embedded at build time: redeploy after changing them. Configure your custom domain using the DNS records the host supplies, wait for its HTTPS certificate, and then update backend CORS and Supabase redirect settings to the final exact domain. Never upload `.env` files.

## 4. Billing and events

Create Stripe test Products/Prices and set `STRIPE_ALLOWED_PRICE_IDS` to the JSON array of approved price IDs. Configure `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, and `APP_PUBLIC_URL`. Register the deployed webhook URL `/api/v1/billing/webhook` for checkout completion/async success/failure and subscription created/updated/deleted events. The webhook validates the raw signature and timestamp, then stores the event receipt and billing state in one database transaction. Duplicate events are ignored. Failed database processing returns an error so Stripe can retry.

The browser's `checkout=success` URL is not proof of payment. Read verified billing state from `/api/v1/billing/status`. Subscription state is refreshed from Stripe before applying its event. Checkout requires authentication, an approved server-side price, and optionally an `Idempotency-Key` UUID. Live keys are rejected unless `ALLOW_LIVE_PAYMENTS=true` is deliberately configured.

## 5. Release checklist

- Run `npm.cmd run check` without preview servers running; Linux CI runs the corresponding checks.
- Verify migrations against an isolated Supabase project and test both owner and different-user access.
- Verify email confirmation, password sign-in, Google callback, logout, and session expiry.
- Test project CRUD and cross-account membership/permissions, then realtime in two authenticated browser sessions.
- Send a provider test request for each configured AI/API adapter; verify structured output, streaming, cancellation, and failures.
- Upload a document and verify citations refer to that user's stored chunks.
- Test Stripe checkout, delayed payment outcomes, duplicate webhook delivery, and cancellation using test mode.
- Confirm HTTPS, exact CORS, secret isolation, useful logs, and provider spending limits.

## Operations and recovery

Do migrations as a reviewed release step, not on every API worker startup. Take a database backup before destructive future schema changes. Prefer backward-compatible schema changes so the previous app release can be restored. Roll back app versions through the host; use a reviewed forward-fix migration or backup restoration for data, rather than blindly dropping tables. Investigate failures by `X-Request-ID`. Do not log bearer tokens, provider keys, payment payloads, or private documents.

The integration response cache and the optional WebSocket room example are process-local. For horizontal scaling use Supabase Realtime and durable database state, or add a Redis broker for custom rooms. The starter is not a substitute for running the account-specific release checks above.

Official references: [Vercel monorepos](https://vercel.com/docs/monorepos), [Render Blueprint](https://render.com/docs/blueprint-spec), [Railway config](https://docs.railway.com/reference/config-as-code), [Stripe webhooks](https://docs.stripe.com/webhooks), [Supabase auth](https://supabase.com/docs/guides/auth).
