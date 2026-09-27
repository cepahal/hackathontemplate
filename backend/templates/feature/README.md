# Backend feature template

These files are inactive copy-and-adapt templates. They are not imported or exposed by the app.

1. Copy `schemas.py.template` to `app/schemas/example.py`.
2. Copy `service.py.template` to `app/services/example.py`.
3. Copy `router.py.template` to `app/api/routes/example.py`.
4. Rename the example types, filenames, imports, and route prefix for your feature.
5. In `app/api/router.py`, import the new router and call `api_router.include_router(router)`.
6. Add endpoint and service tests, then run `python -m pytest` and `python -m ruff check .`.

The template route will then be `POST /api/v1/examples`. Keep `/api/v1` in `main.py` only.
Use Pydantic schemas for request/response validation, routes for HTTP, and services for application
logic. Add database access and authentication only when those features are implemented and tested.
The example merely trims text; it does not save data or call external providers.

Settings belong in `app/core/config.py`; document new environment variables in `.env.example`.
Do not place secrets in source files, templates, responses, or frontend environment variables.
