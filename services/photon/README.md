# Photon starter

A separate Node.js service using Photon's official `spectrum-ts` SDK, with optional Gemini text generation. It has no application tools, bank access, or FastAPI connection. Without a Gemini key it checks messaging transport with an explicit fixed reply. No account or API credentials were created by this implementation.

## Run locally

Requires Node.js 24 or later. From this folder:

```powershell
npm.cmd ci
npm.cmd start
```

Type a message to receive a Gemini answer when configured, or the transport-check reply otherwise. Terminal mode needs no credentials and does not configure iMessage. The SDK downloads its terminal helper on the first run. Press Ctrl+C to stop.

```powershell
npm.cmd run typecheck
npm.cmd test
'hello' | npm.cmd start
```

If npm reports `UNABLE_TO_VERIFY_LEAF_SIGNATURE`, use the Windows trusted certificate store for that PowerShell session, then retry:

```powershell
$env:NODE_OPTIONS='--use-system-ca'
```

## Optional Gemini text agent

Copy `.env.example` to `.env` only if `.env` does not already exist, then privately enter `GEMINI_API_KEY`. You can copy the same dedicated key configured in the backend; this service reads only its own `.env` and process environment. Leave `GEMINI_MODEL=gemini-3.8-flash` or select another available Gemini text model ID. No new SDK dependency is needed: the service uses Node's `fetch` with the fixed HTTPS `generateContent` endpoint and a header for the key.

With a key present, incoming text in either mode is sent to Gemini. For a credential-free local check, leave `GEMINI_API_KEY` absent. Requests time out after 20 seconds. Input is limited to 4,000 characters, output to 1,024 tokens and 2,000 returned characters. Only six completed user/assistant turns per conversation are retained; history expires after 30 idle minutes and at most 100 conversations are held in process memory. A restart clears all history. Failed turns are not added to memory. The current message loop handles one message at a time; `createTextAgent.reply` callers must preserve this serialization if reused elsewhere.

Conversation keys include platform, managed line, chat and sender. Gemini has no tools or action execution. Provider failures return a fixed safe message; raw errors, message content and keys are not logged. Tests use mocked `fetch` and test-only dummy credentials; they make no provider requests.

## Connect iMessage later

Enter `SPECTRUM_PROJECT_ID` and `SPECTRUM_PROJECT_SECRET` from your Photon project settings in the private `.env`. Preserve any existing values. The free project has been created; account phone setup remains incomplete. Complete that setup and confirm shared-pool access before connecting. Free/Pro plans use a shared pool; register the intended tester's exact iMessage phone/email handle under the project's Users tab. Business provides dedicated lines and group creation. The hackathon promo's actual entitlement must be confirmed in the dashboard.

```powershell
if (-not (Test-Path -LiteralPath .env)) { Copy-Item -LiteralPath .env.example -Destination .env }
npm.cmd start -- --imessage
```

Cloud mode replies automatically to incoming text messages on every line discovered for the project. Starting it is a live cloud connection and can send replies; it is not a no-send smoke test. Enable it only when ready to use those lines. No unsolicited message or recipient is configured. The cloud provider runs on Node.js or Bun; it does not require your own Mac. Do not deploy this service as browser code or a worker without Node APIs.

`src/index.ts` routes inbound text to `createTextAgent` in `src/agent.ts` and sends its returned string. Keep all provider credentials on the server. The starter does not print incoming message contents or raw caught errors, and SDK telemetry is disabled. There is no durable inbox/outbox or application-level delivery deduplication yet; do not attach transactions to this handler without those guarantees.

## Handoff

Setup and remaining account gates are recorded in [API setup](../../finalfrontentbackend/docs/API_SETUP.md). The Gemini changes passed typecheck, all 10 focused tests, and a credential-free terminal exchange on Windows with Node 24. The prior dependency audit found zero advisories. Actual Gemini generation and iMessage delivery remain unverified. This service is independent of the existing FastAPI app.

The lockfile pins the SDK. An override keeps transitive `@opentelemetry/core` at 2.12.0 to remove the W3C Baggage memory-allocation advisory in the SDK's older exporter dependency tree. `npm audit` reported zero vulnerabilities after this change; typecheck and the terminal exchange also passed afterward.

Sources: [Photon quickstart](https://photon.codes/docs/spectrum-ts/getting-started), [terminal provider](https://photon.codes/docs/spectrum-ts/providers/terminal/setup-and-usage), [managed iMessage provider](https://photon.codes/docs/spectrum-ts/providers/imessage), [line model](https://photon.codes/docs/spectrum-ts/providers/imessage/connection-and-routing), [shared-plan recipient allowlist](https://photon.codes/docs/spectrum-ts/troubleshooting/imessage), [Gemini models](https://ai.google.dev/gemini-api/docs/models), [Gemini generateContent](https://ai.google.dev/api/generate-content).
