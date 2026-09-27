# Web Fundamentals for AI-Assisted Hackathon Engineering

Goal: when an AI agent generates web/backend code, you can **read it, spot mistakes, debug boundaries, and change it** without needing a line-by-line explanation.

Companion program: `../debugging-recovery/` (incident response).  
This program builds the **map** that debugging runs on.

## How to study each concept

```text
WHAT → WHY → HOW → EXAMPLE → FAILURE MODE → DEBUGGING → AI-GENERATED CODE
```

Never accept a definition without a failure mode.

## Curriculum

| # | Module | File |
|---|---|---|
| 1 | Web mental model | `01-web-mental-model.md` |
| 2 | HTTP | `02-http.md` |
| 3 | REST APIs | `03-rest-apis.md` |
| 4 | JS async | `04-js-async.md` |
| 5 | React | `05-react.md` |
| 6 | FastAPI | `06-fastapi.md` |
| 7 | Pydantic | `07-pydantic.md` |
| 8 | Database fundamentals | `08-database.md` |
| 9 | SQL | `09-sql.md` |
| 10 | Indexes | `10-indexes.md` |
| 11 | Transactions | `11-transactions.md` |
| 12 | Authentication | `12-authentication.md` |
| 13 | Authorization | `13-authorization.md` |
| 14 | Webhooks | `14-webhooks.md` |
| 15 | FE↔BE trace | `15-frontend-backend-trace.md` |
| 16 | AI code reading | `16-ai-code-reading.md` |
| 17 | Symptoms → causes | `17-fundamentals-to-debugging.md` |
| 18 | Mini project + bugs | `18-project-mastery.md` |

Drills: `drills/` · Cheatsheets: `cheatsheets/` · Worked traces: `reference/`

## Mastery standard

Given AI-generated React + FastAPI + SQL for a feature, you can answer:

1. What request is sent and what returns?
2. Where validation / authn / authz happen?
3. What fails on 401 / 422 / 500 / empty 200?
4. What breaks under two concurrent users?
5. What is the smallest safe change?

## Start

Read `01-web-mental-model.md`, then answer **Beginner Drill 01** with your mentor (this chat).
