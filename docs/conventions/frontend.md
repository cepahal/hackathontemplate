# Frontend Conventions

## Reuse first
Check `frontend/` scaffolds and existing app components:

- `navbar/`, `forms/`, `buttons/`, `cards/`, `modals/`
- `dashboard/`, `landing page/`, `loading error states/`

## Patterns
- Composition over inheritance
- Shared design tokens / CSS variables when present
- Client components only when interactivity or browser APIs require it
- Data fetching through existing hooks/clients — do not invent a second data layer

## States (required for data views)
| State | Expectation |
|---|---|
| Loading | Skeleton or spinner; no layout jump if avoidable |
| Error | Human message + retry when safe |
| Empty | Explain next action |

## Quality bar
- Keyboard accessible
- Labels on inputs
- Works on a phone-width viewport for the demo path
