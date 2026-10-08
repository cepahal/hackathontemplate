# frontendFINAL — Hackathon Frontend Foundation

A reusable, product-agnostic Next.js frontend: UI kit, app layout, Supabase authentication with role-based authorization, a dashboard with mock data, and a typed API client. Rename it, swap the mock data for real API calls, and build your product on top.

## Stack

- Next.js 16 (App Router, Turbopack) + React 19
- TypeScript (strict)
- Tailwind CSS v4
- ESLint 9 (flat config, `eslint-config-next`)
- Supabase Auth via `@supabase/ssr` + `@supabase/supabase-js`
- lucide-react icons

## Quick start

```bash
cd finalfrontentbackend/frontendFINAL
cp .env.example .env.local   # then fill in the Supabase values
npm install
npm run dev                  # http://localhost:3000
```

The app refuses to start pages without `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
and logs a `[Supabase config]` error explaining what is missing.

| Script              | What it does                         |
| ------------------- | ------------------------------------ |
| `npm run dev`       | Dev server on port 3000              |
| `npm run build`     | Production build                     |
| `npm run start`     | Serve the production build           |
| `npm run lint`      | ESLint                               |
| `npm run typecheck` | Generate route types + `tsc --noEmit` |

## Routes

| Route            | Access      | Purpose                                                    |
| ---------------- | ----------- | ---------------------------------------------------------- |
| `/`              | Public      | Landing page with CTA to the dashboard                     |
| `/login`         | Public      | Email/password login (signed-in users → dashboard)         |
| `/signup`        | Public      | Email/password signup with confirmation handling           |
| `/auth/callback` | Public      | Finishes email-link flows (`?code=` or `?token_hash=`)     |
| `/dashboard`     | Signed in   | Stats, projects, quick actions, activity, empty state      |
| `/settings`      | Signed in   | Profile (display name), backend connection check           |
| `/admin`         | Admin role  | Example admin-only page                                    |
| `/forbidden`     | Public      | Shown when a signed-in user lacks the required role        |
| `/api/health`    | Public      | `GET` → `{"status":"ok"}`                                  |

## Structure

```text
src/
├── proxy.ts             # Next 16 "middleware": refreshes sessions, guards protected routes
├── app/                 # Routes (layout, pages, loading/error/not-found, auth/callback, api/health)
├── components/
│   ├── ui/              # Button, Input, PasswordInput, Card, Modal, Badge, Alert, Spinner, Skeleton, EmptyState, ErrorState
│   ├── layout/          # Navbar (auth-aware), Sidebar (role-aware), PageContainer
│   ├── dashboard/       # StatCard, RecentActivity, QuickActions
│   ├── auth/            # LoginForm, SignupForm, LogoutButton, AuthGuard
│   └── settings/        # SettingsPanels
├── lib/
│   ├── supabase/
│   │   ├── config.ts      # Reads + validates public Supabase env vars
│   │   ├── browser.ts     # Client Component client
│   │   ├── server.ts      # Server Component / Route Handler client
│   │   └── middleware.ts  # updateSession() used by proxy.ts
│   ├── auth.ts          # getCurrentUser(), requireUser(), requireRole()  (server-only)
│   ├── auth-errors.ts   # Supabase error → user-facing message
│   ├── roles.ts         # parseRole(), hasRole()
│   ├── routes.ts        # Protected/auth route matching, safe `next` redirects
│   ├── api.ts           # Typed fetch wrapper
│   ├── constants.ts     # App name, routes, nav links, API config
│   ├── mock-data.ts     # Demo data used by the dashboard
│   └── utils.ts         # cn(), formatters, validation helpers
└── types/
    ├── index.ts         # Project, Task, Activity, ApiError, NavItem, ...
    └── auth.ts          # Role, AuthUser
```

## Authentication & authorization

**Flow**

1. `SignupForm` / `LoginForm` call `supabase.auth.signUp` / `signInWithPassword` with the browser client.
   `@supabase/ssr` stores the session in cookies (not just React state), so it survives refreshes and is
   readable on the server.
2. `src/proxy.ts` runs on every page request: `updateSession()` refreshes expired tokens, verifies the JWT
   with `getClaims()`, and redirects signed-out users away from `/dashboard`, `/settings`, `/admin` to
   `/login?next=…`. Signed-in users visiting `/login` or `/signup` are sent to the dashboard.
3. Pages re-check on the server with `requireUser()` / `requireRole()` / `<AuthGuard>` (defence in depth).
4. `LogoutButton` calls `supabase.auth.signOut()`, then redirects to `/login`.
5. The Navbar subscribes to `onAuthStateChange` and refreshes server data when the session changes in
   this or another tab.

**Server helpers** (`src/lib/auth.ts`)

```ts
const user = await getCurrentUser();          // AuthUser | null (verified with Supabase)
const user = await requireUser("/settings");  // or redirect to /login?next=/settings
const admin = await requireRole("admin");     // or redirect to /forbidden
```

```tsx
<AuthGuard role="admin" redirectTo="/admin">
  {(user) => <AdminPanel user={user} />}
</AuthGuard>
```

**Roles** are `user` (default) and `admin`, read from `app_metadata.role`. Only the service role can write
`app_metadata`, so users cannot promote themselves (`user_metadata` is user-editable and is never used for
roles). This matches `../databaseFINAL/migrations/002_profiles.sql`. To make someone an admin, run in the Supabase SQL
editor:

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'
where email = 'you@example.com';
```

The user must log out and back in (or wait for the next token refresh) to receive the new role.

> **Authentication is not authorization.** Hiding a link (`requiredRole` on a `NavItem`) is only a UI hint.
> `requireRole()` protects page rendering; every backend endpoint and RLS policy must enforce the same rule.

**Supabase dashboard configuration**

- *Authentication → URL Configuration*: set **Site URL** (e.g. `http://localhost:3000`) and add
  `http://localhost:3000/auth/callback` (plus your production URL's `/auth/callback`) to **Redirect URLs**.
- *Authentication → Sign In / Providers → Email*: enable Email; choose whether **Confirm email** is on.
  - On: signup shows "Check your email"; the link lands on `/auth/callback` and signs the user in. The link
    must be opened in the same browser (PKCE).
  - Off: signup signs the user in immediately and redirects to the dashboard.
- The built-in email service only delivers to project team members and is heavily rate limited. Configure
  custom SMTP before real users sign up.

## Calling the backend as the signed-in user

The FastAPI backend lives in `../backendFINAL` (routes under `/api/v1`). Use the typed `backendApi`:

```ts
import { backendApi } from "@/lib/api";

// Client Components: the signed-in user's access token is attached automatically.
const projects = await backendApi.projects.list({ status: "active" });
const task = await backendApi.tasks.create(projects[0].id, { title: "Ship it", priority: 3 });

// Server Components / Route Handlers: pass the token explicitly.
import { getAccessToken } from "@/lib/auth";
const mine = await backendApi.projects.list({}, { token: await getAccessToken() });
```

Response types are `Project`, `Task` and `Profile` from `src/types/database.ts`. The backend
verifies the JWT and derives the user from it; never send user IDs in request bodies.

## Customising

- **App name / description:** `APP_NAME`, `APP_DESCRIPTION` in `src/lib/constants.ts`.
- **Navigation:** edit `NAVBAR_LINKS`, `AUTH_LINKS`, `SIDEBAR_LINKS` in `src/lib/constants.ts`.
- **Colours:** CSS variables at the top of `src/app/globals.css` (`--primary` is the accent).
- **Logo / favicon:** replace `public/logo.svg`.

## Using the API client

`backendApi` is built on the lower-level `api` helper, which you can use for new endpoints:

```ts
import { api, isApiRequestError } from "@/lib/api";
import type { Project } from "@/types/database";

const projects = await api.get<Project[]>("/api/v1/projects");
const created = await api.post<Project>("/api/v1/projects", { name: "New project" });
await api.patch<Project>(`/api/v1/projects/${created.id}`, { status: "paused" });
await api.get("/api/v1/health", { auth: false });

try {
  await api.get("/api/v1/projects", { query: { limit: 10 }, timeoutMs: 5000 });
} catch (error) {
  if (isApiRequestError(error)) {
    console.error(error.status, error.code, error.message);
  }
}
```

- Base URL: `NEXT_PUBLIC_API_URL` (inlined at build time; restart `npm run dev` after changing it).
- Objects are JSON-encoded with `Content-Type: application/json`; `FormData`, `Blob`, `URLSearchParams` and strings are sent as-is.
- Auth header: in the browser, the current Supabase session's access token is sent as `Authorization: Bearer …` automatically. Pass `token` to override (`null` = none), or `auth: false` for public endpoints. On the server nothing is attached unless you pass `token`. Tokens are never stored by the client.
- Only relative paths are accepted, so tokens can't leak to other origins.
- Errors are thrown as `ApiRequestError` with `status`, `code` (`TIMEOUT`, `NETWORK_ERROR`, `ABORTED`, `INVALID_JSON`, `SESSION_ERROR`, or the server's `code` such as `PROJECT_NOT_FOUND`) and a readable `message`. The backend's `{"error": {"code", "message"}}` envelope and FastAPI `detail` are both understood.
- Responses are not validated at runtime; add schema validation if the API is untrusted.

## Replacing mock data

The dashboard reads projects, tasks and activity from `src/lib/mock-data.ts`. To go live, replace those imports with `api` calls (in a Server Component, or in a Client Component with loading/error states using `Spinner`/`Skeleton`/`ErrorState`). Authentication and the profile name are real (Supabase); project creation, invites and account deletion are still **demo-only** and persist nothing.

## Backend connection check

`/settings` calls `GET ${NEXT_PUBLIC_API_URL}/api/v1/health` (path set by `API_HEALTH_PATH` in `constants.ts`) and expects `{"status":"ok"}`. It shows "Unreachable" until the backend is running (`uvicorn app.main:app --reload --port 8000` in `../backendFINAL`) **and** its `FRONTEND_URL` matches this app's origin (`http://localhost:3000`).

## Security notes

- Never put secrets in `NEXT_PUBLIC_*` variables or client components — they ship to the browser.
- Never add `SUPABASE_SERVICE_ROLE_KEY` here. `config.ts` throws if a secret/service-role key is placed in
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Post-login `next` redirects only accept same-origin paths (`src/lib/routes.ts`).
- `.env*` files are git-ignored except `.env.example`.
- `next.config.ts` sets basic security headers and disables `X-Powered-By`.
