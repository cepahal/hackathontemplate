# Coding Conventions

## Goals
Consistency, minimal diffs, safe change.

## Rules
- Mirror existing naming and folder structure
- Search for a utility/component before writing a new one
- Prefer pure functions for transform logic; side effects at edges
- Explicit types at public boundaries
- Errors: typed/structured when the project already does so; never swallow
- Avoid drive-by refactors in feature PRs
- Dependencies: justify cost (size, license, maintenance)

## File hygiene
- One primary export concern per module when practical
- Colocate tests with code **or** mirror tree under `tests/` — follow the repo
- Delete dead code you introduced; do not delete unrelated dead code without asking

## Anti-patterns
- Parallel "v2" modules without migration plan
- Global mutable state for convenience
- Copy-pasted near-duplicates with tiny tweaks
