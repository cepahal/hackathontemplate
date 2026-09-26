# 06 — Technical Feasibility

Score each dimension: Easy / Moderate / Hard / **Dangerous for hackathon**.

| Dimension | Easy signals | Dangerous signals |
|---|---|---|
| Frontend | 3–5 screens, existing template | Custom canvas editor, realtime CRDT |
| Backend | CRUD + 3 endpoints | Complex marketplace, billing |
| Database | 3–5 tables | Graph migrations, multi-tenant RLS perfection |
| AI | API calls + structured out | Fine-tune, training, high accuracy SLA |
| External APIs | 1–2 known SDKs | Unfamiliar hardware, approval-gated APIs |
| Infra | Vercel/Render/Fly one-click | K8s, VPC peering |
| Data | Seed + mock OK for demo | Needs partners' private data day-of |
| Latency | Async OK / streaming | Hard realtime <100ms |

**Dangerous** = likely to burn the team. Cut scope or kill.
