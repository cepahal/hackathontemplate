# Database Debugging

Reason along the full path:

```text
application
  → SQL (ORM-generated or raw)
    → database engine
      → result set
        → application mapping
          → API JSON
            → UI
```

A bug can sit on **any** arrow.

## Mental checklist

| Symptom | Possible DB causes |
|---|---|
| Missing rows | Wrong `WHERE`, RLS, uncommitted txn, wrong DB/env |
| Duplicates | Missing unique constraint; double insert |
| NULL weirdness | `= NULL` vs `IS NULL`; outer join |
| FK failure | Insert child before parent; wrong id |
| 500 on write | Constraint/trigger; not null |
| Slow | Missing index; N+1; `SELECT *` large rows |
| Authz leak / empty | Forgot `user_id = current_user` filter |

## SQL error reading

- **unique_violation** → duplicate business key (409 territory)
- **foreign_key_violation** → referential order / bad id
- **not_null_violation** → app omitted field
- **undefined_column** → migration not applied in this env

## Joins

Incorrect join → duplicated rows (fan-out) or dropped rows.  
Verify with: count before join vs after; select keys only.

## Transactions

- Forgot commit → invisible to other connections
- Long transaction → locks / timeouts
- Error mid-way without rollback → confusing pool state (framework usually handles)

## N+1

ORM: 1 query for parents + N for children.  
Evidence: log SQL; 50 similar queries per request.  
Fix: join/eager load — after confirming it's on the demo path.

## Experiments

1. Run the exact SQL against the same DB the app uses  
2. Compare env `DATABASE_URL` host/name  
3. Check migrations applied (`alembic`, Supabase migration history)  
4. For RLS: test as the same role the API uses

## Never

Change schema "just in case" while debugging a SELECT filter bug.
