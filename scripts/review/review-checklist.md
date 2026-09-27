# Review Checklist (human + AI)

Use after significant changes. Check only what applies.

## Correctness
- [ ] Logic matches acceptance criteria
- [ ] Edge cases for empty/null/unauthorized handled

## Architecture
- [ ] Reused existing patterns (no parallel stack)
- [ ] Diff scoped to the task

## Security
- [ ] Authn/authz correct
- [ ] No secrets in diff
- [ ] No IDOR / injection / XSS introductions

## Performance
- [ ] No obvious N+1 or unbounded responses on demo path

## Testing
- [ ] Relevant tests added/updated OR manual verification listed

## API / DB
- [ ] Contracts compatible or breaking changes called out
- [ ] Migrations safe/additive

## UX / a11y
- [ ] Loading/error/empty on changed views
- [ ] Keyboard/labels OK for new controls

## Report
- [ ] Findings are real (or "No material findings")
- [ ] Residual risks listed
