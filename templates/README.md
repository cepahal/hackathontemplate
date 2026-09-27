# Reusable templates

Use these files to add a feature and follow its acceptance process in [the delivery record](../docs/DELIVERY.md).

| Template | Purpose | Destination |
| --- | --- | --- |
| [feature-plan.md](feature-plan.md) | Contracts, ownership and acceptance | `docs/features/<name>.md` |
| [feature-page.tsx.example](feature-page.tsx.example) | Labeled form and shared components | `frontend/src/app/<name>/page.tsx` |
| [integration-config.md](integration-config.md) | Credentials, limits and failures | `docs/integrations/<name>.md` |
| [migration.sql.example](migration.sql.example) | Schema and access rules | `database/migrations/<next>_<name>.sql` |
| [backend feature](../backend/templates/feature/README.md) | Schemas and router | `backend/app/modules/<name>/` |

Page layouts are `/welcome` (landing), `/` (workspace), and `/chat` (assistant). `/foundation` retains the health demonstration. Copy a layout's composition, customize its labels/navigation, and connect your data adapters. The standalone page template previews text locally until you connect its submit handler.

For each feature: define contract/access policy, implement one workflow, test unauthorized and failed requests, document setup, and run `npm.cmd run check`. Keep secrets on the backend. Hosted integration acceptance requires real-service verification.
