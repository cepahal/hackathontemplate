# Frontend Conventions

## Reuse first
Check the implemented Next.js app before adding new UI:

- `frontend/src/app/` for pages and layouts
- `frontend/src/components/` for shared UI and feature panels
- `frontend/src/lib/` for API, streaming, Supabase clients, and shared types

The original folders with `explanation.txt` are historical notes, not component source directories.

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
