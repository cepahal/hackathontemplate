# 03 — REST APIs

## WHAT
REST-ish APIs expose **resources** via URLs and HTTP methods. Hackathons rarely need pure REST dogma — they need **consistent contracts**.

## WHY
Frontend and backend agree on shapes. AI breaks contracts silently (rename field, wrap in `{data:}`).

## HOW
**Resource:** noun (`/users`, `/users/{id}/activity`)  
**Collection vs item:** list vs one  
**Schema:** request validation + response serialization  
**Authn** who you are · **Authz** what you may do

### Good
```http
GET    /api/projects
POST   /api/projects
GET    /api/projects/{id}
PATCH  /api/projects/{id}
DELETE /api/projects/{id}
GET    /api/projects/{id}/tasks
```
Errors:
```json
{"detail":[{"loc":["body","title"],"msg":"field required","type":"missing"}]}
```
Pagination: `?limit=20&cursor=...` or `?page=&page_size=`

### Bad
```http
GET /api/getUserData?userId=1&action=delete
POST /api/doStuff
```
- Verbs in URLs inconsistently
- Delete via GET (caches/prefetch danger)
- No validation; raw dicts
- 200 with `{success:false}` instead of status codes

## EXAMPLE
Create project: `POST /api/projects` body `{"title":"Demo"}` → `201` `{"id":"...","title":"Demo","owner_id":"..."}`

## FAILURE MODE
Breaking change: `title` → `name` without versioning → UI blank or undefined.

## DEBUGGING
Compare Network response JSON to TypeScript/Pydantic types field-by-field.

## AI-GENERATED CODE
Watch for: unauthenticated destructive routes; trusting `user_id` in body for ownership; missing pagination on lists that grow.
