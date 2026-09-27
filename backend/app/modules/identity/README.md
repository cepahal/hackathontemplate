# Identity and project API

Mount the exported `router` under `/api/v1`. Set `SUPABASE_URL` to the HTTPS project origin and
`SUPABASE_ANON_KEY` to its publishable/legacy anon key in `backend/.env`. Configuration is loaded
only when used, so an unconfigured provider does not stop `/health`.

Frontend Supabase Auth owns signup, email/password login, Google OAuth, token refresh, and signout.
For every protected API call, send `Authorization: Bearer <current user access token>`.
`get_current_user` validates that token through Supabase's `/auth/v1/user` endpoint and returns
`AuthenticatedUser(id: UUID, email: str | None, role: 'user' | 'admin')`. It never takes a user ID
from the request body or trusts unverified JWT decoding or `user_metadata` roles.

| Endpoint | Request | Success |
| --- | --- | --- |
| `GET /auth/me` | Bearer token | Current user |
| `GET /projects` | `limit=1..100`, `offset=0..100000` | `{items, limit, offset}` |
| `POST /projects` | `{name, description?}` | Project, 201 |
| `GET /projects/{UUID}` | Valid project UUID | Project |
| `PATCH /projects/{UUID}` | Nonempty `{name?, description?}` | Project |
| `DELETE /projects/{UUID}` | Valid project UUID | Empty 204 |
| `GET /projects/{UUID}/members` | Owner; optional limit/offset | `{items, limit, offset}` |
| `POST /projects/{UUID}/members` | Owner; `{user_id, role: 'viewer' or 'editor'}` | Member, 201 |
| `DELETE /projects/{UUID}/members/{user UUID}` | Owner | Empty 204 |
| `GET /notifications` | Optional limit/offset | `{items, limit, offset}` |
| `PATCH /notifications/{UUID}` | `{read: true or false}` | Notification |

A Project has `id`, `owner_id`, `name`, `description`, `created_at`, and `updated_at`. Names are
trimmed and limited to 120 characters; descriptions to 5000. Unknown fields, caller-supplied
ownership, null updates, and empty patches are rejected. An empty description clears it.

REST calls use the publishable/anon API key **and the validated user's original access token**.
Project reads include rows owned by the caller or explicitly shared with them. Database RLS allows
editors to change name/description; viewers can read only. Deletion remains owner-filtered and
owner-only. Project ownership and IDs are immutable. Missing/invisible project IDs, or updates
that do not match an editable row, return 404. Membership APIs check the validated project owner
and RLS independently enforces that restriction. Invites require an existing account UUID and
send no external messages. Members cannot change roles or add other members. To change a role
through this API, the owner removes and re-adds the membership.

Notifications are owner-filtered. A database trigger emits a notification when a project is
created; clients can mark it read/unread but cannot alter its trusted content. Sharing a project
does not grant access to its owner's document content or RAG results.

Missing provider configuration returns 503, invalid/expired tokens 401, denied access 403,
rate limiting 429, timeouts 504, and other provider failures 502. Provider response bodies are
never included in client errors. Redirects are disabled and calls have a 10-second timeout.
Mutations are not automatically retried, avoiding duplicate writes after ambiguous failures.

Future modules can import `get_current_user` or `require_admin` from `dependencies.py`.
`require_admin` trusts only server-validated `app_metadata.role == 'admin'`. It does not silently
grant database access to another user's rows.

Run offline tests from `backend` with `.venv/Scripts/python.exe -m pytest tests/test_identity.py`.
SQL setup and real two-user RLS verification are documented in `database/README.md`; real provider
authentication has not been tested without user-supplied credentials.
