# 12 — Authentication

## WHAT
Proving **who** the client is. Not what they're allowed to do (that's authz).

## WHY
Hackathon demos die on callback URLs and cookies. AI mixes session and JWT carelessly.

## HOW — building blocks
| Piece | Role |
|---|---|
| password | secret; never store plaintext |
| hash | one-way (bcrypt/argon2) store |
| session | server-side id → user; browser holds session cookie |
| cookie | transport for session id (HttpOnly, Secure, SameSite) |
| JWT | signed claims client stores/sends; server verifies signature |
| access token | short-lived API credential |
| refresh token | longer-lived; rotate carefully |
| OAuth | "login with Google" — tokens from provider; you still create a local session/user |

### Password login (simplified)
1. POST email+password  
2. Lookup user; verify hash  
3. Create session row / sign JWT  
4. `Set-Cookie` or return token  
5. Later requests present cookie/token → resolve user

### Google OAuth (simplified)
1. Browser → Google consent  
2. Google redirects to your callback with `code`  
3. Server exchanges code for profile (server-side secret)  
4. Upsert local user; set your session cookie  
5. Redirect to app

## FAILURE MODE
Secure cookie on HTTP localhost mismatch; wrong callback URL; JWT in localStorage + XSS; accepting `user_id` from client as auth.

## DEBUGGING
Application panel cookies; `/api/me` 401; server log whether session resolved; compare prod vs local scheme.

## AI-GENERATED CODE
Reject auth that trusts body `user_id`. Prefer established libraries (Auth.js, Supabase Auth, etc.).
