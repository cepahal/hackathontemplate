"""Fixed, parameterized PostgreSQL operations; no connection or migration at startup.

The DSN is operator configuration, never request input. TLS always verifies the server's
certificate and hostname. No provider payloads, message bodies or credentials are stored.
"""

import re
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Annotated, ClassVar, Literal
from uuid import UUID

import psycopg
from psycopg.conninfo import conninfo_to_dict
from psycopg.errors import ConnectionTimeout, QueryCanceled
from psycopg.rows import dict_row
from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, SecretStr, ValidationError

from app.integrations.errors import (
    IntegrationAuthError,
    IntegrationError,
    IntegrationInvalidResponseError,
    IntegrationNotConfiguredError,
    IntegrationRequestError,
    IntegrationTimeoutError,
    IntegrationUnavailableError,
)

_LABEL_PATTERN = r"[a-z][a-z0-9_]{0,63}"
_LABEL = re.compile(_LABEL_PATTERN)
Label = Annotated[str, Field(pattern=f"^{_LABEL_PATTERN}$")]

_INSERT_ID = """
INSERT INTO integration_metrics.event_ids (event_id, occurred_at)
VALUES (%s, %s)
ON CONFLICT (event_id) DO NOTHING
RETURNING event_id
"""
_INSERT_EVENT = """
INSERT INTO integration_metrics.events
    (event_id, occurred_at, source, kind, outcome, duration_ms)
VALUES (%s, %s, %s, %s, %s, %s)
"""
_LIST_EVENTS = """
SELECT event_id, occurred_at, source, kind, outcome, duration_ms
FROM integration_metrics.events
WHERE source = %s AND occurred_at >= %s
ORDER BY occurred_at, event_id
LIMIT %s
"""


class IntegrationEvent(BaseModel):
    """Bounded operational labels only; generate ID/time once and retain them for retries."""

    model_config = ConfigDict(extra="forbid", frozen=True, hide_input_in_errors=True)

    event_id: UUID
    occurred_at: AwareDatetime
    source: Label
    kind: Label
    outcome: Literal["success", "failure", "pending"]
    duration_ms: int | None = Field(default=None, ge=0, le=86_400_000, strict=True)


def _provider_error(exc: psycopg.Error) -> IntegrationError:
    """Do not expose database diagnostics: they may contain connection details or values."""
    if isinstance(exc, (ConnectionTimeout, QueryCanceled)):
        return IntegrationTimeoutError("tigerdata")
    if (exc.sqlstate or "").startswith("28") or exc.sqlstate == "42501":
        return IntegrationAuthError("tigerdata")
    if exc.sqlstate in {"42P01", "3F000"}:
        return IntegrationUnavailableError(
            "tigerdata",
            "Tiger Data event schema is missing. Apply app/integrations/tigerdata/schema.sql explicitly.",
            code="TIGERDATA_SCHEMA_MISSING",
        )
    if isinstance(exc, psycopg.OperationalError):
        return IntegrationUnavailableError("tigerdata")
    return IntegrationRequestError("tigerdata")


class TigerDataClient:
    service_name: ClassVar[str] = "tigerdata"
    env_var: ClassVar[str] = "TIGERDATA_DSN"

    def __init__(
        self,
        dsn: SecretStr | None,
        *,
        sslrootcert: str | None = None,
        connect_timeout_seconds: int = 5,
        statement_timeout_ms: int = 5000,
    ) -> None:
        if isinstance(connect_timeout_seconds, bool) or not 1 <= connect_timeout_seconds <= 60:
            raise ValueError("connect_timeout_seconds must be 1-60")
        if isinstance(statement_timeout_ms, bool) or not 100 <= statement_timeout_ms <= 120_000:
            raise ValueError("statement_timeout_ms must be 100-120000")
        self._dsn = dsn
        self._sslrootcert = sslrootcert
        self._connect_timeout_seconds = connect_timeout_seconds
        self._statement_timeout_ms = statement_timeout_ms
        if self.configured:
            try:
                options = conninfo_to_dict(self._credential())
            except psycopg.ProgrammingError:
                raise ValueError("TIGERDATA_DSN must be a valid PostgreSQL connection string") from None
            host = options.get("host", "")
            if (
                not isinstance(host, str)
                or not host
                or "/" in host
                or "\\" in host
                or "," in host
                or "service" in options
                or "hostaddr" in options
            ):
                raise ValueError("TIGERDATA_DSN requires one explicit TCP hostname, without service or hostaddr")

    @property
    def configured(self) -> bool:
        return self._dsn is not None and bool(self._dsn.get_secret_value().strip())

    def _credential(self) -> str:
        if not self.configured or self._dsn is None:
            raise IntegrationNotConfiguredError(self.service_name, self.env_var)
        return self._dsn.get_secret_value()

    @asynccontextmanager
    async def _connection(self) -> AsyncIterator[psycopg.AsyncConnection[dict[str, object]]]:
        dsn = self._credential()
        try:
            async with await psycopg.AsyncConnection.connect(
                dsn,
                row_factory=dict_row,
                sslmode="verify-full",
                sslrootcert=self._sslrootcert,
                gssencmode="disable",
                connect_timeout=self._connect_timeout_seconds,
                options=f"-c statement_timeout={self._statement_timeout_ms}",
            ) as connection:
                yield connection
        except psycopg.Error as exc:
            raise _provider_error(exc) from None

    async def health(self) -> bool:
        """Explicit connectivity probe; does not create or validate the event schema."""
        async with self._connection() as connection, connection.cursor() as cursor:
            await cursor.execute("SELECT 1 AS healthy")
            if await cursor.fetchone() != {"healthy": 1}:
                raise IntegrationInvalidResponseError(self.service_name)
        return True

    async def record_event(self, event: IntegrationEvent) -> bool:
        """Commit one immutable event; False means this UUID has already been recorded.

        Both inserts share a transaction. A failed event insert rolls back its ID reservation.
        No automatic retries: callers may repeat the same event ID after an ambiguous failure.
        """
        async with self._connection() as connection, connection.cursor() as cursor:
            await cursor.execute(_INSERT_ID, (event.event_id, event.occurred_at))
            if await cursor.fetchone() is None:
                return False
            await cursor.execute(
                _INSERT_EVENT,
                (event.event_id, event.occurred_at, event.source, event.kind, event.outcome, event.duration_ms),
            )
        return True

    async def list_events(self, *, source: str, since: datetime, limit: int = 100) -> list[IntegrationEvent]:
        """Read a bounded source/time window, ordered oldest first; backend operations only."""
        if not _LABEL.fullmatch(source):
            raise ValueError("source must be a lowercase integration label of 1-64 characters")
        if since.tzinfo is None or since.utcoffset() is None:
            raise ValueError("since must include a timezone")
        if isinstance(limit, bool) or not 1 <= limit <= 1000:
            raise ValueError("limit must be 1-1000")
        async with self._connection() as connection, connection.cursor() as cursor:
            await cursor.execute(_LIST_EVENTS, (source, since, limit))
            rows = await cursor.fetchall()
        try:
            return [IntegrationEvent.model_validate(row) for row in rows]
        except ValidationError:
            raise IntegrationInvalidResponseError(self.service_name) from None
