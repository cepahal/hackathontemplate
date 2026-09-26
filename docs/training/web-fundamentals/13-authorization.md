# 13 — Authorization

## WHAT
**Authentication ≠ authorization.**  
Authn: "you are Ada." Authz: "Ada may edit project 10."

## WHY
IDOR is the #1 AI/backend footgun: `GET /projects/{id}` with no ownership check.

## HOW
| Model | Example |
|---|---|
| roles | admin / member |
| permissions | `project:write` |
| ownership | `project.owner_id == user.id` |
| resource-level | check on every read/write |

```python
project = db.get(Project, id)
if not project or project.owner_id != user.id:
    raise HTTPException(404)  # or 403
```

## EXAMPLE IDOR
Attacker changes `/api/projects/10` → `/api/projects/11` and sees Bob's project because AI only checked "logged in".

## FAILURE MODE
UI hides buttons but API allows. Authz only on GET list, not on GET by id.

## DEBUGGING
Call API as user A with user B's ids. Expect 403/404.

## AI-GENERATED CODE
For every `{id}` route: where is the ownership/role check?
