# External API starter

Use a bearer token from Supabase for every endpoint. `GET /api/v1/integrations/catalog` reports configuration, not live connectivity. Public GitHub browsing is available to any signed-in user at `GET /api/v1/integrations/github/repos?username=octocat&page=1`; follow `next_page` until null.

Shared server-credential operations require an administrator whose role comes from trusted Supabase app metadata. Send `POST /api/v1/integrations/{provider}/execute` with `{ "operation": "...", "params": {...} }`.

| Provider | Operation | Parameters | Backend environment |
| --- | --- | --- | --- |
| github | repositories | username | GITHUB_TOKEN optional for public reads |
| google_maps | geocode | address | GOOGLE_MAPS_API_KEY |
| discord | send_message | channel (numeric ID), text | DISCORD_BOT_TOKEN |
| slack | send_message | channel, text | SLACK_BOT_TOKEN |
| twilio | send_sms | to (E.164), text | TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER |
| spotify | search | query | SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET |
| youtube | search | query, optional page_token | YOUTUBE_API_KEY |

Messaging also requires `confirm: true` after the caller reviews the exact message and destination. This is an application boundary, not proof of consent from an external recipient. Test only with an approved destination. POST failures are not automatically retried because a provider may have accepted an uncertain request. GETs have bounded retries, sanitized errors and a bounded 60-second process-local cache.

Adapters use fixed provider origins and do not accept arbitrary request URLs. Spotify uses application client credentials. `backend/app/modules/integrations/oauth.py` supplies signed user/provider-bound OAuth state and PKCE helpers for future delegated flows. A complete consent callback, one-time nonce store, token vault and refresh scheduler are not implemented; add these for integrations that need access to each user's private account.

For a new adapter, copy `templates/integration-config.md`, define one narrow operation, validate its parameters, normalize its response, mock its success/failure behavior, then verify with least-privilege provider credentials. Webhook signature helpers live in the commerce signatures module; Stripe has the complete persisted event-processing example. Other providers need their own event schemas and subscriptions.
