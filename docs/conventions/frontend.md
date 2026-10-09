# Frontend Conventions

## Reuse first
Check existing components in `finalfrontentbackend/frontendFINAL/src/components/`:

- `ui/` (Button, Input, Card, Modal, Badge, Alert, Spinner, Skeleton, EmptyState, ErrorState)
- `layout/` (Navbar, Sidebar, PageContainer), `dashboard/`, `auth/`, `ai/`

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
