# Testing Conventions

## Priority order (hackathon-aware)
1. Critical demo path (auth → main action → result)
2. Authz / ownership regressions
3. Pure unit tests for tricky logic
4. Broad coverage

## Practices
- Arrange / Act / Assert clarity
- Deterministic tests (no flaky time/network without fakes)
- Factories/fixtures over brittle literal dumps when patterns exist
- Name tests after behavior

## Verification honesty
Report exactly:
- commands run
- pass/fail
- what was **not** run

If the environment cannot run tests, say so and give a manual checklist instead of pretending.
