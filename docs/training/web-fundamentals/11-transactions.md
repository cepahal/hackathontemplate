# 11 — Transactions (ACID)

## WHAT
A transaction groups statements into one commit/rollback unit.

| Letter | Meaning |
|---|---|
| Atomicity | all succeed or none |
| Consistency | constraints hold after commit |
| Isolation | concurrent txns don't wreck each other (levels vary) |
| Durability | committed data survives crash |

## WHY
Payments, inventory, "create user + profile" must not half-apply.

## HOW examples
**Payment:** debit A + credit B — one txn.  
**Inventory:** check count + decrement — else oversell under concurrency.  
**Duplicate submit:** unique constraint + txn → second insert fails cleanly.

## FAILURE MODE
Read count 1, two requests both pass check, both decrement → −1 stock without txn/constraint.  
Autocommit each statement → partial user signup.

## DEBUGGING
Reproduce with parallel requests; check isolation; look for missing UNIQUE.

## AI-GENERATED CODE
Watch multi-step DB ops without `commit` boundaries or without unique constraints for idempotency.
