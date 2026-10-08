# Schema — databaseFINAL

Source of truth is the SQL in `migrations/`. TypeScript mirror: `../frontendFINAL/src/types/database.ts`.

## Relationships

```text
auth.users (Supabase Auth)
   │ 1:1  id  (on delete cascade, row created by trigger)
   ▼
public.profiles ──1:N── public.projects ──1:N── public.tasks
       │ owner_id (cascade)     │ project_id (cascade)
       │                        │
       ├──1:N── public.activity ┘ project_id (set null; nullable)
       │  user_id (cascade)
       └──1:N── public.ai_generations
          user_id (cascade)
```

Deleting an Auth user removes their profile, projects, tasks, activity and AI history. Deleting a project
removes its tasks; its activity rows survive with `project_id = null`, plus a `project_deleted` entry.

## Tables

### profiles

| Column | Type | Rules |
|---|---|---|
| id | uuid PK | = `auth.users.id`, FK on delete cascade |
| email | text null | copied from Auth, kept in sync; basic format check |
| display_name | text null | 1–100 chars after trim; from signup `full_name`/`display_name` |
| avatar_url | text null | must start with `https://`, ≤ 2048 chars |
| role | text | `user` (default) or `admin`; mirror of `app_metadata.role` |
| created_at / updated_at | timestamptz | `now()`; `updated_at` maintained by trigger |

Indexes: `profiles_email_idx (email)` — not unique (SSO + password identities may share an email).

### projects

| Column | Type | Rules |
|---|---|---|
| id | uuid PK | `gen_random_uuid()` |
| owner_id | uuid | FK → profiles, cascade; **defaults to `auth.uid()`** |
| name | text | 1–120 chars after trim; unique per owner (case-insensitive) |
| description | text | default `''`, ≤ 2000 |
| status | text | `active` (default), `paused`, `completed`, `archived` |
| created_at / updated_at | timestamptz | trigger-maintained `updated_at` |

Indexes: `projects_owner_id_name_key (owner_id, lower(name))` unique,
`projects_owner_id_created_at_idx (owner_id, created_at desc)`, `projects_created_at_idx (created_at desc)`.
`owner_id` lookups use either composite index (leading column), so no separate single-column index.

### tasks

| Column | Type | Rules |
|---|---|---|
| id | uuid PK | `gen_random_uuid()` |
| project_id | uuid | FK → projects, cascade |
| title | text | 1–200 chars after trim |
| description | text | default `''`, ≤ 5000 |
| completed | boolean | default `false` |
| priority | integer | 1 low, 2 medium (default), 3 high, 4 urgent |
| due_date | timestamptz null | |
| created_at / updated_at | timestamptz | trigger-maintained `updated_at` |

Indexes: `tasks_project_id_idx (project_id, created_at desc)`, `tasks_due_date_idx (due_date) where due_date is not null`.

### activity

| Column | Type | Rules |
|---|---|---|
| id | uuid PK | `gen_random_uuid()` |
| user_id | uuid | FK → profiles, cascade. Feed owner (= project owner) |
| project_id | uuid null | FK → projects, set null |
| type | text | `project_created`, `project_updated`, `project_status_changed`, `project_deleted`, `task_created`, `task_completed`, `task_reopened` |
| message | text | 1–500 chars |
| metadata | jsonb | object, default `{}`; includes `actor_id` (`auth.uid()` of who acted) |
| created_at | timestamptz | `now()` |

Indexes: `activity_user_id_created_at_idx (user_id, created_at desc)`,
`activity_project_id_idx (project_id) where project_id is not null`, `activity_created_at_idx (created_at desc)`.

Rows are written only by triggers (`private.log_project_activity`, `private.log_task_activity`).

### ai_generations

History of AI requests made through the FastAPI backend (`app/ai/history.py`), written with the
caller's JWT so RLS applies.

| Column | Type | Rules |
|---|---|---|
| id | uuid PK | `gen_random_uuid()` |
| user_id | uuid | FK → profiles, cascade; **defaults to `auth.uid()`** |
| provider | text | `openai`, `gemini`, `anthropic`, `grok` |
| model | text | 1–200 chars; the model the provider reported |
| type | text | `text`, `structured`, `stream`, `image`, `file` |
| status | text | `pending` (default), `completed`, `failed`, `cancelled` |
| input | jsonb | object, ≤ 1 MiB; prompt, prompt template id, context size/preview, file metadata (never file bytes) |
| output | jsonb null | object, ≤ 1 MiB; result (`text` or `data`) or `error` {code, message} |
| created_at | timestamptz | `now()` |

Indexes: `ai_generations_user_id_created_at_idx (user_id, created_at desc)`,
`ai_generations_user_id_type_created_at_idx (user_id, type, created_at desc)`.

Lifecycle: streams insert a `pending` row and finalise it once (`completed` / `failed` / `cancelled`);
other requests insert their final status directly. Finished rows are immutable (only delete).

## Functions and triggers

All functions live in the `private` schema, which is not exposed by the Supabase Data API and has
no grants for `anon`/`authenticated`. All use `set search_path = ''` with schema-qualified names.

| Trigger | On | Function | Purpose |
|---|---|---|---|
| `on_auth_user_created` | after insert `auth.users` | `handle_new_user()` (definer) | create profile (id, email, display_name, role) |
| `on_auth_user_updated` | after update of email / metadata on `auth.users` | `sync_profile_from_auth_user()` (definer) | keep email, role, display_name in sync |
| `*_set_updated_at` | before update on profiles/projects/tasks | `set_updated_at()` | bump `updated_at` |
| `projects_log_activity` | after insert/update/delete `projects` | `log_project_activity()` (definer) | feed entries |
| `tasks_log_activity` | after insert / update of `completed` on `tasks` | `log_task_activity()` (definer) | feed entries |

## Row Level Security

RLS is enabled on all five tables. Supabase's default `GRANT ALL` to `anon`/`authenticated` is
revoked and replaced with explicit grants, so **`anon` has no access at all**, and
`authenticated` can only touch the columns listed below. No policy uses `USING (true)`.

| Table | Privileges for `authenticated` | Policy (rows) |
|---|---|---|
| profiles | select; update(display_name, avatar_url) | `id = auth.uid()` |
| projects | select, delete; insert(owner_id, name, description, status); update(name, description, status) | `owner_id = auth.uid()` (insert/update `with check` too) |
| tasks | select, delete; insert/update(project_id, title, description, completed, priority, due_date) | parent project's `owner_id = auth.uid()` (insert/update `with check` too, so a task can't be moved into someone else's project) |
| activity | select | `user_id = auth.uid()`; no write policies |
| ai_generations | select, delete; insert(user_id, provider, model, type, status, input, output); update(status, model, output) | `user_id = auth.uid()`; update only while `status = 'pending'` |

Consequences:

- A user cannot change `role`, `email` or `id` on their profile (column privilege error 42501).
- A user cannot transfer a project (`owner_id` is not updatable) or create one for someone else (policy violation 42501).
- Cross-user `update`/`delete` silently affect 0 rows (rows are invisible).
- `service_role` (server-only key) bypasses RLS — never ship it to the browser.

## Roles

Source of truth: `auth.users.raw_app_meta_data ->> 'role'` (Supabase `app_metadata`), which only
the service role / SQL editor can change and which is embedded in the user's JWT. `profiles.role`
mirrors it via trigger. `raw_user_meta_data` is user-editable and is never used for roles.
The frontend reads the role from `app_metadata` (`src/lib/roles.ts`), so both agree.
