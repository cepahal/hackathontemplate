# Backend feature template

These files are inactive copy-and-adapt templates. They are not imported or exposed by the app.

All paths below are relative to `backend/`. New feature code belongs together in
`app/modules/<name>/`, matching the existing identity, AI, integrations, and commerce modules.

1. Create `app/modules/example/` and an empty `__init__.py`.
2. Copy `schemas.py.template` to `app/modules/example/schemas.py`.
3. Copy `service.py.template` to `app/modules/example/service.py`.
4. Copy `router.py.template` to `app/modules/example/routes.py`.
5. Rename the `example` module, example types, imports, and route prefix for your feature.
6. In `app/api/router.py`, add `from app.modules.example.routes import router as example_router`
   and `api_router.include_router(example_router)` (using your renamed module).
7. Add endpoint and service tests under `tests/`, then run `npm run check` from the repository root.

The template route will then be `POST /api/v1/examples`. Keep `/api/v1` in `main.py` only.
Use Pydantic schemas for request/response validation, routes for HTTP, and services for application
logic. For private operations, reuse the identity dependencies and user-JWT database client under
`app/modules/identity/`; do not add a second auth system or bypass RLS. This inactive text example
is public and must gain the existing auth dependency before being adapted to private data.
The example merely trims text; it does not save data or call external providers.

Shared settings belong in `app/core/config.py`; feature-specific settings belong with the module.
Document server environment variables in `backend/.env.example` (repository-relative path).
Do not place secrets in source files, templates, responses, or frontend environment variables.
