# Integration: <provider or service name>

Status: planning template; no provider is configured by this document.

Purpose: <the user workflow this integration enables>.

Official setup documentation: <verified provider documentation URL>.

## Environment contract

Replace this table before adding variables to an application's `.env.example`.

| Variable | Read by | Required when | Public or secret | Example/default | Validation |
| --- | --- | --- | --- | --- | --- |
| `<PROVIDER_API_KEY>` | <backend process> | <feature enabled> | Secret | Leave blank | <how presence/format is checked> |
| `<PROVIDER_BASE_URL>` | <backend process> | <rule> | <classification> | <documented URL> | <allowed scheme/host> |
| `<PUBLIC_CONFIGURATION>` | <frontend, if needed> | <rule> | Public | <non-secret example> | <rule> |

- Local configuration file: <path loaded by the application>.
- Hosted configuration location: <chosen service's environment settings>.
- Credential creation steps and minimum required permissions: <steps>.
- Rotation/revocation procedure: <steps>.
- Required callbacks, webhook URLs, or authorized origins: <exact values and where to configure them>.
- Behavior when unset: <clear configuration error or explicitly disabled feature>.

Only deliberately public values belong in browser code or `NEXT_PUBLIC_` variables. Keep credentials in ignored local environment files or hosted secrets. Commit variable names and setup instructions, never live values. Never log credentials, authorization headers, or unredacted provider error payloads.

## Request and failure behavior

| Concern | Decision |
| --- | --- |
| Timeout and cancellation | <bounded timeout; how an abandoned request is cancelled> |
| Retry | <retryable responses, attempt limit, delay; respect provider rate-limit guidance> |
| Duplicate effects | <idempotency strategy for writes, payments, or messages> |
| Provider response | <validated schema and normalized application result> |
| Rate limits/cost | <per-user and total bounds, usage reporting if applicable> |
| Pagination | <cursor/page convention and maximum result count> |
| Caching | <key, expiry, privacy boundary; or none> |
| Webhooks | <signature verification, replay/deduplication rules; or not used> |
| User-facing failure | <safe message and recovery action> |

## Local verification

1. <Create a sandbox/test credential, if the provider supports one.>
2. <Set the documented environment variables and restart the process that reads them.>
3. <Run one complete request through the application.>
4. <Exercise missing configuration, invalid input, timeout, and provider failure.>
5. <Verify access rules and duplicate-request behavior where applicable.>

Recorded result: <date, commands/workflow, observed outcome, and any unverified behavior>.

## Removing the integration

Disable behavior: <how the application responds when the feature is turned off>.

Cleanup: <credential revocation, callbacks/webhooks, stored data and retention, or none>.
