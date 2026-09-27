# Supabase database

This directory contains versioned SQL for a **fresh Supabase project**. Files are ready to apply;
they have not been applied to a hosted project by this repository. Do not run these against an
existing production schema without reviewing name conflicts and taking a backup.

## Apply the migrations

1. Create a Supabase project and open its SQL editor using the project owner's account.
2. Run `migrations/0001_core.sql` once. It creates tables, RLS policies, triggers, vector search,
   and realtime permissions in one transaction. The `vector` extension must be in `extensions`;
   fresh Supabase projects use this layout. If you installed it elsewhere, review the schema
   before applying this migration instead of blindly moving a shared extension.
3. Run each later migration in filename order, including `0002_billing.sql` when using payments.
   Record applied filenames in your deployment notes; these SQL files deliberately fail on
   conflicting existing tables rather than silently accepting a different schema.
4. Enable email/password and optionally Google in Supabase Auth. Configure the frontend's exact
   redirect URLs and Google's OAuth credentials in the provider dashboard.
5. Configure the frontend with the project URL and **publishable/anon** key. Configure backend
   `SUPABASE_URL` and `SUPABASE_ANON_KEY` with the same values. User CRUD sends the user's bearer
   token to Supabase, so RLS stays in force.
6. Create real test accounts through Auth. `seed.sql` can add a starter project for one account:
   replace its `seed_owner` UUID first. It refuses the placeholder and never invents Auth users.

Migrations can also be copied into a Supabase CLI migration directory and managed through its
normal linked-project migration workflow. Keep one migration history for each deployed project.
The SQL editor steps above do not require a local database server.

## Tables and access

| Table | Purpose | Signed-in client access |
| --- | --- | --- |
| `profiles` | Display name, avatar, server-controlled role | Read own; update display name/avatar only |
| `projects` | Project CRUD and timestamps | Owner/viewer/editor read; owner/editor update; owner delete |
| `project_members` | Owner-managed viewer/editor membership | Read own membership or owned project members; owner manages |
| `documents` | Uploaded document source, optional project link | Own rows only |
| `document_chunks` | Text plus 1536-dimension embeddings | Own rows only |
| `agent_runs` | Agent goal, state and approval lifecycle | Own rows only |
| `notifications` | Server-created notifications | Read own; update `read_at` only |

All restricted updates have both `USING` and `WITH CHECK`. Project identity and ownership are
immutable at the trigger level; clients can update only the name and description columns.
Security-definer access helpers return booleans for `auth.uid()` and avoid recursive membership
policies. The project owner alone can invite/remove accounts or change viewer/editor roles.
Membership refers to existing Auth user UUIDs; it does not send email invitations or create users.
This implements shared project records and presence, not simultaneous rich-text editing.

Composite foreign keys prevent a document from linking to another owner's project, or a chunk
from linking to another owner's document. Deletes cascade from Auth users to their records, and
from projects to linked documents and chunks. Deleting a document deletes its chunks.

New Auth users get a profile through a database trigger. `profiles.role` mirrors the server-managed
`auth.users.raw_app_meta_data.role`; only exact `admin` grants that role. Mutable `user_metadata`
never authorizes anything. To grant an administrator role, a trusted operator must update the
user's **app metadata** through the Supabase Admin API/dashboard, then have the user refresh their
session. Profile clients cannot change the role column. Admin status does not bypass these owner
policies; add explicit reviewed policies if administrators later need access to other owners.

The `service_role` is for narrowly scoped trusted jobs/webhooks only. Never put it in a browser
environment variable. The backend identity module rejects service-role and secret keys in
`SUPABASE_ANON_KEY`.

## Vector retrieval

`match_document_chunks(query_embedding, match_count, filter_project_id, filter_embedding_model)`
runs as the caller, preserves RLS, and returns `id`, `document_id`, `content`, `metadata`, and
`similarity`. Embeddings have 1536 dimensions. Store the model identifier as
`metadata.embedding_model` (for example `openai:text-embedding-3-small`) and supply
`filter_embedding_model` when querying; equal dimensions do not make different models compatible.
Chunk metadata also stores `title` and `chunk_index` for citations.

The cosine HNSW index is a starting point. With many tenants or selective filters, measure recall
and query plans and tune iterative index scans or partitioning before scaling. Authentication and
RLS isolate data; they do not establish retrieval accuracy or document trustworthiness.

## Realtime

The migration adds `projects`, `project_members`, `notifications`, and `agent_runs` to `supabase_realtime` when that
publication exists. PostgreSQL changes use each table's SELECT RLS. A project creation emits a
notification in the same transaction.

Presence and broadcast use **private** channels with topics `project:<project UUID>` or
`user:<Auth user UUID>`. Project channels admit the owner and explicitly invited members; user
channels admit only their owner. The frontend must join with `config.private: true` and the current
Auth session. Document content and RAG results remain owner-private even inside a shared project;
membership shares only project records and presence. In Supabase Realtime Settings, disable
**Allow public access** to enforce private channels project-wide. Do not add a public-channel fallback.
Realtime authorization is evaluated on joining/refreshing a channel; membership removal blocks
new API/database requests immediately, but already joined sessions require reauthorization or
disconnect. Account for that provider behavior when designing immediate presence revocation.

## Verify before deployment

The backend has offline mocked tests for Auth validation, ownership propagation, CRUD contracts,
input validation, and upstream failures. Those tests cannot prove a remote database's RLS policy.

After applying the migrations to a test project, create two real test accounts, replace `user_a`
and `user_b` in `tests/rls.sql`, and run it as project owner. It checks owner reads, cross-owner
mutations, owner transfer, role escalation, cross-owner foreign keys, retrieval isolation, and
notification column permissions, viewer/editor rights, owner-only membership changes, and member
removal. The script rolls back all verification data.

Also test email/password signup, Google login, signout, session refresh, and two browser sessions
against the hosted project. Verify private channel joins fail for a different owner. This hosted
verification requires real credentials and has not been represented as completed locally.

After applying `0002_billing.sql`, configure the same two test-account UUIDs in `tests/billing.sql`
and run it as project owner. It verifies duplicate delivery, older-event rejection, immutable billing
ownership, cross-account read denial, and service-role-only writes. Its changes are rolled back.

Primary references: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[JWT validation](https://supabase.com/docs/guides/auth/jwts), and
[Realtime authorization](https://supabase.com/docs/guides/realtime/authorization).
