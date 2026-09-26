# AI-Assisted Debugging Protocol

You supervise the AI. The AI does not supervise reality.

## Mandatory loop (paste into every debug chat)

```text
REPRODUCE → COLLECT EVIDENCE → FORM HYPOTHESES → TEST → ROOT CAUSE → FIX → VERIFY
```

## Labels the AI must use

| Label | Meaning |
|---|---|
| **FACT** | Observed from repo, runtime, logs, network, SQL |
| **HYPOTHESIS** | Plausible explanation, unproven |
| **CONFIRMED** | Hypothesis tested and supported |
| **REJECTED** | Hypothesis falsified |

If the AI cannot produce a FACT list, it must ask for evidence — not edit files.

## Hard rules

1. No multi-file "shotgun" fixes without a confirmed root cause  
2. One experiment at a time  
3. Prefer `git diff` review of AI patches before keep  
4. If AI made it worse: stash/branch/restore — see `02-git-recovery-scenarios.md`  
5. Verification commands must be run or explicitly marked unverified  

## Good AI prompt shape

See `prompts/debugging/evidence-first-debug.md`.

## Bad AI behavior to interrupt

- "I fixed CORS, auth, and the database" in one turn  
- "Should work now" without reproduction  
- Rewriting working teammate code during an incident  
- Inventing env vars that don't exist in `.env.example`
