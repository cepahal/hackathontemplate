"""Supabase (PostgREST) data access.

Every query is sent with the public anon key as `apikey` and the *caller's* access token as
`Authorization`, so Postgres evaluates Row Level Security as that user (see
databaseFINAL/migrations/006_rls.sql). The service-role key is never used here.
"""

import logging
from collections.abc import Mapping, Sequence
from typing import Literal, Protocol
from uuid import UUID

import httpx

from app.core.config import Settings
from app.core.errors import DatabaseError, UnauthorizedError

logger = logging.getLogger(__name__)

Row = dict[str, object]
FilterValue = str | int | bool | UUID | None
Filters = Mapping[str, FilterValue]
OrderBy = Sequence[tuple[str, Literal["asc", "desc"]]]
JsonValue = str | int | float | bool | None | list["JsonValue"] | dict[str, "JsonValue"]
Values = Mapping[str, JsonValue]


class UserDB(Protocol):
    """Table operations scoped to one authenticated user. Filters are equality checks."""

    async def select(
        self,
        table: str,
        *,
        filters: Filters | None = None,
        order: OrderBy | None = None,
        limit: int | None = None,
        offset: int | None = None,
    ) -> list[Row]: ...

    async def insert(self, table: str, values: Values) -> Row: ...

    async def update(self, table: str, *, filters: Filters, values: Values) -> list[Row]: ...

    async def delete(self, table: str, *, filters: Filters) -> list[Row]: ...


def _filter_param(value: FilterValue) -> str:
    if value is None:
        return "is.null"
    if isinstance(value, bool):
        return "is.true" if value else "is.false"
    return f"eq.{value}"


def database_error(status_code: int, payload: object) -> DatabaseError | UnauthorizedError:
    """Maps a PostgREST error response to an application error."""
    pg_code: str | None = None
    if isinstance(payload, dict) and isinstance(payload.get("code"), str):
        pg_code = payload["code"]

    if status_code == 401 or (pg_code or "").startswith("PGRST3"):
        return UnauthorizedError("Access token was rejected by the database", code="INVALID_TOKEN")
    if pg_code == "42501":
        return DatabaseError(status_code=403, code="FORBIDDEN", message="Not allowed by access policy", pg_code=pg_code)
    if pg_code in {"23505", "23503"}:
        return DatabaseError(status_code=409, code="CONFLICT", message="Conflicts with existing data", pg_code=pg_code)
    if pg_code in {"23502", "23514", "22001", "22007", "22008", "22P02"}:
        return DatabaseError(
            status_code=400, code="BAD_REQUEST", message="The database rejected the values", pg_code=pg_code
        )
    if pg_code in {"PGRST205", "PGRST204", "42P01", "42703"}:
        return DatabaseError(
            status_code=503,
            code="DATABASE_SCHEMA_MISSING",
            message="Database schema not found. Apply databaseFINAL/migrations to the Supabase project.",
            pg_code=pg_code,
        )
    return DatabaseError(status_code=502, code="DATABASE_ERROR", message="The database request failed", pg_code=pg_code)


class SupabaseRest:
    """Holds the shared HTTP client and builds per-user database handles."""

    def __init__(self, settings: Settings, http: httpx.AsyncClient) -> None:
        self._http = http
        self._rest_url = settings.rest_url
        self._anon_key = settings.supabase_anon_key.get_secret_value()

    def as_user(self, access_token: str) -> "PostgrestUserDB":
        return PostgrestUserDB(self._http, self._rest_url, self._anon_key, access_token)


class PostgrestUserDB:
    def __init__(self, http: httpx.AsyncClient, rest_url: str, anon_key: str, access_token: str) -> None:
        self._http = http
        self._rest_url = rest_url
        self._headers = {
            "apikey": anon_key,
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/json",
        }

    async def select(
        self,
        table: str,
        *,
        filters: Filters | None = None,
        order: OrderBy | None = None,
        limit: int | None = None,
        offset: int | None = None,
    ) -> list[Row]:
        params: list[tuple[str, str]] = [("select", "*")]
        params += [(column, _filter_param(value)) for column, value in (filters or {}).items()]
        if order:
            params.append(("order", ",".join(f"{column}.{direction}" for column, direction in order)))
        if limit is not None:
            params.append(("limit", str(limit)))
        if offset:
            params.append(("offset", str(offset)))
        return await self._send("GET", table, params=params)

    async def insert(self, table: str, values: Values) -> Row:
        rows = await self._send("POST", table, json=dict(values), representation=True)
        if len(rows) != 1:
            raise DatabaseError(status_code=502, code="DATABASE_ERROR", message="Insert returned no row", pg_code=None)
        return rows[0]

    async def update(self, table: str, *, filters: Filters, values: Values) -> list[Row]:
        if not filters:
            raise ValueError("update() requires at least one filter")
        params = [(column, _filter_param(value)) for column, value in filters.items()]
        return await self._send("PATCH", table, params=params, json=dict(values), representation=True)

    async def delete(self, table: str, *, filters: Filters) -> list[Row]:
        if not filters:
            raise ValueError("delete() requires at least one filter")
        params = [(column, _filter_param(value)) for column, value in filters.items()]
        return await self._send("DELETE", table, params=params, representation=True)

    async def _send(
        self,
        method: str,
        table: str,
        *,
        params: list[tuple[str, str]] | None = None,
        json: dict[str, JsonValue] | None = None,
        representation: bool = False,
    ) -> list[Row]:
        headers = dict(self._headers)
        if representation:
            headers["Prefer"] = "return=representation"
        try:
            response = await self._http.request(
                method,
                f"{self._rest_url}/{table}",
                params=tuple(params) if params else None,
                json=json,
                headers=headers,
            )
        except httpx.TimeoutException:
            logger.error("Supabase %s %s timed out", method, table)
            raise DatabaseError(
                status_code=503, code="DATABASE_UNAVAILABLE", message="Database request timed out", pg_code=None
            ) from None
        except httpx.TransportError as exc:
            logger.error("Supabase %s %s failed: %s", method, table, type(exc).__name__)
            raise DatabaseError(
                status_code=503, code="DATABASE_UNAVAILABLE", message="Database is unreachable", pg_code=None
            ) from None

        try:
            payload: object = response.json() if response.content else []
        except ValueError:
            payload = None

        if response.is_error:
            error = database_error(response.status_code, payload)
            pg_code = payload.get("code") if isinstance(payload, dict) else None
            pg_message = payload.get("message") if isinstance(payload, dict) else None
            logger.warning("Supabase %s %s -> %s %s: %s", method, table, response.status_code, pg_code, pg_message)
            raise error

        if not isinstance(payload, list) or not all(isinstance(row, dict) for row in payload):
            raise DatabaseError(
                status_code=502, code="DATABASE_ERROR", message="Unexpected database response", pg_code=None
            )
        return payload
