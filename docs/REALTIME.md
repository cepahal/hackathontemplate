# Image and realtime templates

The Image studio sends PNG/JPEG/WebP images up to 3 MiB to `/api/v1/ai/vision`. The provider returns a schema-validated summary, detected text, objects and uncertainties. Images are processed by the selected AI provider; they are not stored in this starter. OCR is model-based and must be checked for accuracy. Text/Markdown uploads are separate document-ingestion requests.

## Supabase workflow

Apply core SQL and enable private-only Realtime channels as documented in `database/README.md`. Sign in as owner A, create a project, add existing account B as viewer/editor, then join that project in both sessions. Open Live activity to see presence, project events and notifications. An unrelated account must fail to join. Remove B and verify new data requests are denied. Realtime channel authorization refreshes on join/reauthorization, so do not promise immediate revocation of an already joined presence channel.

Topics are `project:<uuid>` and `user:<uuid>`, always with `config.private: true`. Postgres changes use table RLS. A creation notification is written in the same database transaction as its project. Notifications belong only to their recipient.

## Optional custom WebSocket

Use the deployed API's WSS origin with `/api/v1/realtime/projects/<uuid>`. Obtain the current access token from your signed-in Supabase client, then send this first text frame within 10 seconds:

```json
{"type":"authenticate","token":"CURRENT_USER_ACCESS_TOKEN"}
```

Never place tokens in URLs or log them. A successful join receives `snapshot` with `data` and `peer_id`, followed by `presence` with `count`. Owners and editors may send:

```json
{"type":"state","data":{"title":"Shared board","cards":[]}}
```

The server broadcasts `state` with `data` and the verified `user_id`. Viewers receive updates but cannot write. Send `{"type":"ping"}` more frequently than the 60-second idle timeout; expect `pong`. Reconnect using a fresh session token after expiry and wait for the authoritative snapshot before editing.

State frames are limited to 8192 UTF-8 bytes; rooms to 16 peers and 100 active rooms. Close codes: 4400 malformed frame, 4401 missing authentication, 4403 access denied, 4408 timeout, 1013 capacity/slow connection. Authentication and membership are rechecked before writes and broadcasts. Do not automatically resend a stale state on reconnect.

This is a last-write-wins, single-process, ephemeral example. State disappears when the last peer leaves or the process restarts. It is not a durable document editor. Use Supabase tables as authoritative persisted state, or add a durable broker/versioned conflict-resolution protocol before scaling custom rooms across workers.

Offline TestClient WebSocket tests create no listening network server. Hosted acceptance requires two authorized clients plus an outsider, disconnect/rejoin, token expiry, membership removal, viewer denial and slow-peer behavior.
