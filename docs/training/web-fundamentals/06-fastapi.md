# 06 — FastAPI

## WHAT
FastAPI maps HTTP → Python callables with **typed parameters** and automatic OpenAPI. Runs on ASGI (uvicorn).

## WHY
AI generates FastAPI quickly. You must see: routing, validation, deps, where DB is called.

## HOW
```python
@app.get("/items/{item_id}")
async def read_item(
    item_id: int,                    # path
    q: str | None = None,            # query
    body: ItemCreate | None = None,  # for POST — example
    user: User = Depends(get_user),  # DI / auth
) -> ItemOut:
    ...
```

| Piece | Role |
|---|---|
| routing | method + path → function |
| path params | `{id}` in URL |
| query params | `?q=` |
| body | JSON → Pydantic model |
| Pydantic | validate/coerce |
| Depends | reusable auth, DB session |
| middleware | cross-cutting (CORS, logging) |
| HTTPException | controlled error + status |
| async def | non-blocking waits (await DB/HTTP) |
| sync def | runs in threadpool — careful with blocking |

Error handling: unhandled Exception → 500; `HTTPException` → your status; validation → 422.

## EXAMPLE
AI code:
```python
@app.post("/projects", response_model=ProjectOut)
def create(project: ProjectIn, db: Session = Depends(get_db), user=Depends(current_user)):
    row = Project(**project.dict(), owner_id=user.id)
    db.add(row); db.commit(); db.refresh(row)
    return row
```
Meaning: validate body → require user → insert with **server-set** owner_id → return serialized row.

## FAILURE MODE
- Using `user_id` from body instead of session
- Forgetting `commit`
- Returning ORM object without response_model (lazy load errors)
- `async def` calling blocking SQLAlchemy sync without care

## DEBUGGING
Hit route with curl; read 422 detail; print dependency results; check SQL echo.

## AI-GENERATED CODE
Ask: Where is authz? Who sets owner_id? What status on not found?
