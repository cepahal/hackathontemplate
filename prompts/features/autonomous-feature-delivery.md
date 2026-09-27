# Autonomous Feature Delivery

You are a senior engineer operating under `AGENTS.md`.

## Request
{{REQUEST}}

Example: `Add Google authentication and a dashboard showing the user's activity`

## Execute the full loop — do not skip

### 1. INSPECT
- Map repo structure
- Search for auth, dashboard, activity, session, user models
- Read existing API/DB/UI patterns and tests
- Inventory reusable components under `frontend/`, `backend/`, `database/`, `ai/`

### 2. UNDERSTAND
Summarize: current architecture, what already exists, constraints, unknowns.

### 3. PLAN
Produce a short plan:
- MVP vertical slice
- Files to touch (reuse first)
- Schema/API changes (minimal)
- Authn/authz rules
- Verification commands
- Explicit non-goals (anti-scope-creep)

Wait for confirmation only if the user asked for a plan-first mode; otherwise proceed after stating the plan briefly.

### 4. IMPLEMENT
Smallest correct diff. Match conventions. No unrelated rewrites.

### 5. TEST
Run relevant tests/typecheck/lint. Fix failures. If tooling missing, provide a manual verification script and say so.

### 6. REVIEW
Self-review the diff for regressions + security (authz/IDOR/secrets). Genuine issues only.

### 7. POLISH
Loading/error/empty states on new UI. Demo-path responsive sanity.

### 8. REPORT
```text
Changed:
Verified:
Did not verify:
Risks:
Follow-ups:
How to demo:
```

## Hard rules
- Never invent contracts — inspect first
- Never claim tests passed if not run
- Prefer working core flow over perfect architecture under time pressure
- Read `.hackathon/CURRENT_MODE.md` if present and obey the time band
