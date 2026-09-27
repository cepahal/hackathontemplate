# The Debugging Mental Model

Debugging is **controlled reduction of uncertainty**, not typing commands until something works.

## The loop

```text
Symptom
  → Reproduction
    → Failure boundary
      → Evidence
        → Hypotheses (ranked)
          → Experiment (one variable)
            → Root cause
              → Fix (minimal)
                → Regression guard
```

| Stage | Question you must answer |
|---|---|
| Symptom | What did the user/demo observe? |
| Reproduction | Exact steps, env, account, data? Can *you* make it fail again? |
| Failure boundary | Frontend / network / API / auth / DB / env / upstream? |
| Evidence | Status codes, payloads, logs, diffs, SQL — not vibes |
| Hypotheses | 2–3 ranked explanations consistent with evidence |
| Experiment | Change or inspect **one** thing that would falsify a hypothesis |
| Root cause | The invariant that was violated |
| Fix | Smallest change that restores the invariant |
| Regression | How we prevent the same break (test, assert, checklist) |

## Critical distinctions

| Trap | Reality |
|---|---|
| Symptom ≠ cause | "Blank dashboard" is a symptom; missing auth cookie may be the cause |
| Error message ≠ root cause | `500 Internal Server Error` is a symptom class; the stack trace / log line is closer |
| Correlation ≠ causation | "Broke after AI commit" may be true *and* the real bug may be missing env on deploy |
| AI hypothesis ≠ evidence | "Probably CORS" without an OPTIONS/preflight failure is storytelling |

## Failure boundary (find this first)

Ask: **What is the last component that behaved correctly?**

```text
UI render OK?
  → Network request sent?
    → Response received?
      → Status expected?
        → Body shape expected?
          → Server log shows handler entry?
            → Auth passed?
              → DB query returned expected rows?
                → Upstream API OK?
```

The bug lives at the **first failed hop**.

## Evidence grades

| Grade | Examples | Trust |
|---|---|---|
| Hard | Status code, response body, stack frame, `git diff`, SQL result | High |
| Soft | "It worked on my machine", AI suggestion, timing coincidence | Low until confirmed |
| Noise | Unrelated warnings, stale console errors from prior page | Discard |

## Under time pressure (hackathon)

1. Reproduce on the **demo path** only
2. Locate failure boundary in ≤3 checks (Network tab, one server log, `git diff`)
3. Prefer **revert/restore** over clever fixes if AI churned many files
4. Protect the demo; park non-blockers in `FOLLOWUPS.md`

## Self-check before changing code

- [ ] I can reproduce it
- [ ] I know which layer fails
- [ ] I have at least one hard evidence artifact
- [ ] My next action tests a hypothesis (or safely undoes AI damage)
- [ ] I know how I will verify success
