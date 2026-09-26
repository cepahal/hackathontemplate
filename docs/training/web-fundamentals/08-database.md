# 08 — Database Fundamentals

## WHAT
Relational DB: **tables** of **rows**; **columns** typed; relationships via keys.

## WHY
AI invents schemas that can't enforce ownership or create N+1 nightmares.

## HOW
| Concept | Meaning |
|---|---|
| PK | uniquely identifies row |
| FK | references PK elsewhere |
| 1:1 | user ↔ profile |
| 1:N | user → many projects |
| M:N | students ↔ courses via join table |
| normalization | reduce duplicate facts (don't overdo in hackathon) |
| constraints | NOT NULL, UNIQUE, CHECK, FK |
| index | side structure for faster lookup (see module 10) |
| transaction | all-or-nothing unit (module 11) |

## EXAMPLE
`projects.owner_id → users.id`. Deleting user with projects → FK restrict/cascade choice matters.

## FAILURE MODE
No FK → orphan rows. No UNIQUE on email → duplicate accounts. Missing `owner_id` → IDOR paradise.

## DEBUGGING
Inspect schema; `\d table` / Supabase UI; compare API filter to columns.

## AI-GENERATED CODE
Demand ownership column on user data tables before shipping.
