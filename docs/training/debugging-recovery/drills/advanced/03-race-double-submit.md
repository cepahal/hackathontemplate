# Advanced 03 — Race / double submit

## Evidence
UniqueViolation on `email` intermittently when users click "Sign up" twice.
Sometimes two rows with different ids before constraint added.

## Your job
1. Failure boundary layers involved?
2. Experiments to confirm race vs deterministic bug
3. Minimal backend + UI mitigations for demo
