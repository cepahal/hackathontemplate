# Database Conventions

## Before changing schema
1. Read existing models/migrations under `database/` and app ORM folders
2. Search for queries that will break
3. Prefer additive changes (new nullable column, new table)

## Rules
- Primary keys and foreign keys explicit
- `user_id` / tenant columns for owned data
- Cascades intentional, not accidental
- Migrations checked into git; never "only applied locally" for shared DB

## Query safety
- Parameterized queries only
- Always filter by owner on user data (IDOR prevention)
- Avoid `SELECT *` in hot paths when the project already selects explicitly

## Hackathon tip
Ship the minimal schema for the demo path. Defer fancy normalization until after the core flow works.
