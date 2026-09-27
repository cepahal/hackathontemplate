# Architecture Decision Log

Record only decisions that affect structure, contracts, or stack.

## Template

```text
### YYYY-MM-DD — Title
Status: proposed | accepted | superseded
Context:
Decision:
Consequences:
```

## Decisions

### Bootstrap — AI Agent Operating System
Status: accepted  
Context: Need reusable instructions so coding agents behave like senior engineers across hackathons.  
Decision: Ship `AGENTS.md`, `.cursor/rules/`, `docs/`, `prompts/`, and `scripts/` as the permanent OS layer; keep `frontend/`, `backend/`, `database/`, `ai/` as product scaffolds.  
Consequences: Agents start from shared rules; product code can vary per event without rewriting process.
