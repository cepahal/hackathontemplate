# 07 — Pydantic

## WHAT
Schemas that **validate and coerce** data at API boundaries (and serialize outbound).

## WHY
422s are your friend. AI that uses raw `dict` skips the safety rail.

## HOW
```python
class ProjectIn(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    description: str | None = None

class ProjectOut(ProjectIn):
    id: UUID
    owner_id: UUID
```
- Optional vs required: `x: str | None = None` vs `x: str`
- Nested: `items: list[ItemIn]`
- Constraints: `EmailStr`, `conint(gt=0)`, enums
- `response_model` strips private fields / shapes output
- v2: `model_dump()` vs v1 `dict()` — AI mixes versions

## EXAMPLE
Input `"price": "9.99"` → coerced to `Decimal` if typed — or fails if strict.

## FAILURE MODE / AI mistakes
- Same model for create and DB row (password hash leaked in response)
- `Optional` everything → silent nulls in DB
- Mutating shared default `list`/`dict` defaults incorrectly (`Field(default_factory=list)`)
- Using ORM model as request schema (mass assignment)

## DEBUGGING
Read 422 `loc` + `msg`. Log `model_dump()` after parse.

## AI-GENERATED CODE
Check response models never include `hashed_password`, secrets, or internal flags.
