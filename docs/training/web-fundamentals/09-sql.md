# 09 — SQL

## WHAT
Declarative language to read/write relational data.

## WHY
ORMs hide SQL until something breaks — then you must read the generated query.

## HOW — core
```sql
SELECT col FROM t WHERE cond ORDER BY col LIMIT n;
INSERT INTO t (cols) VALUES (...);
UPDATE t SET col=val WHERE id=?;
DELETE FROM t WHERE id=?;
```

### JOINs visually
```text
users          projects
id | name      id | owner_id | title
1  | Ada       10 | 1        | Demo
2  | Bob       11 | 1        | Notes
               12 | 2        | Bob's
```
`FROM users u JOIN projects p ON p.owner_id = u.id`  
→ Ada+Demo, Ada+Notes, Bob+Bob's (3 rows)

`LEFT JOIN` keeps users with no projects (NULLs on right).

### GROUP BY / HAVING
Aggregate per group; `HAVING` filters groups.

### Subquery / CTE
```sql
WITH recent AS (
  SELECT * FROM activity WHERE created_at > now() - interval '7 days'
)
SELECT user_id, count(*) FROM recent GROUP BY user_id;
```

## EXAMPLE
Activity for one user:
```sql
SELECT * FROM activity WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50;
```

## FAILURE MODE
Missing `WHERE user_id` → data leak. Wrong JOIN → duplicated rows → inflated counts.

## DEBUGGING
Log SQL + params; run in SQL console; compare row counts.

## AI-GENERATED CODE
For every SELECT on user data, ask: where is the owner filter?
