# Backend Conventions

## Layout
Follow whatever exists under `backend/` (`FastAPI/`, `API routes/`, `authentication/`, `database/`).

## Request lifecycle
1. Authenticate
2. Authorize (ownership/role)
3. Validate input
4. Execute domain logic
5. Persist / call out
6. Return typed response / map errors

## Errors
- Consistent JSON (or project-standard) error body
- Correct HTTP status codes
- No stack traces to clients in production

## Auth
- Derive identity from verified session/token — never from a raw client `user_id` field alone
- Check resource ownership on read/update/delete

## Observability
- Structured logs with request ids when available
- Never log passwords, tokens, or full card/PII payloads
