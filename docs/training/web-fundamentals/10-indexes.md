# 10 — Indexes

## WHAT
An index is an extra sorted structure (commonly B-tree) mapping key → row location.

## WHY
Without index on `user_id`, every dashboard load may **seq scan** the whole activity table.

## HOW
- Helps: `WHERE`, `JOIN`, `ORDER BY` matching leftmost prefix of index
- Hurts: slows writes; disk; unused indexes
- Composite `(user_id, created_at)` helps filter by user then sort by time
- Not selective? Index may be ignored

## EXAMPLE slow
```sql
SELECT * FROM activity WHERE user_id = 42 ORDER BY created_at DESC LIMIT 20;
-- seq scan on 5M rows without index
CREATE INDEX ON activity (user_id, created_at DESC);
```

## FAILURE MODE
Indexing every column "just in case"; function on column `WHERE LOWER(email)=` without matching index.

## DEBUGGING
`EXPLAIN ANALYZE` — look for Seq Scan vs Index Scan on large tables.

## AI-GENERATED CODE
AI rarely adds indexes. For demo-scale data OK; for seed scripts with 100k rows, add the obvious ones.
