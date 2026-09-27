# API Conventions

## Design
- Resource-oriented paths; consistent naming with existing routes
- Version only if the project already versions
- Pagination for lists that can grow
- Partial success and bulk endpoints only when needed

## Contracts
- Request/response schemas are source of truth (OpenAPI, Zod, Pydantic, etc.)
- Breaking changes require explicit callout in the report/PR
- Prefer additive fields over renames during hackathons

## Compatibility
- Frontend and backend share types when monorepo tooling allows
- Document auth header/cookie expectations in one place

## Checklist for new endpoints
- [ ] Auth required?
- [ ] Authz rule defined?
- [ ] Validation defined?
- [ ] Error cases listed?
- [ ] Test or manual verification noted?
