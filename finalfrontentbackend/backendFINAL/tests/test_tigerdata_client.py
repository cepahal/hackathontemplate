"""Tiger Data uses mocked PostgreSQL connections; these tests never contact a database."""

from datetime import UTC, datetime, timedelta
from types import TracebackType
from unittest.mock import AsyncMock
from uuid import UUID

import psycopg
import pytest
from psycopg.errors import ConnectionTimeout, InsufficientPrivilege, QueryCanceled, UndefinedTable
from pydantic import SecretStr, ValidationError

from app.integrations.errors import (
    IntegrationAuthError,
    IntegrationInvalidResponseError,
    IntegrationNotConfiguredError,
    IntegrationRequestError,
    IntegrationTimeoutError,
    IntegrationUnavailableError,
)
from app.integrations.tigerdata.client import IntegrationEvent, TigerDataClient

DSN = SecretStr("postgresql://app:test_password@metrics.example.com:5432/metrics?sslmode=disable")
EVENT_ID = UUID("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
WHEN = datetime(2026, 10, 10, 14, 0, tzinfo=UTC)


def event(**changes: object) -> IntegrationEvent:
    return IntegrationEvent.model_validate(
        {
            "event_id": EVENT_ID,
            "occurred_at": WHEN,
            "source": "photon",
            "kind": "delivery",
            "outcome": "success",
            "duration_ms": 12,
            **changes,
        }
    )


class FakeCursor:
    def __init__(self) -> None:
        self.calls: list[tuple[str, tuple[object, ...] | None]] = []
        self.one: dict[str, object] | None = {"healthy": 1}
        self.rows: list[dict[str, object]] = []
        self.error_on_call: tuple[int, psycopg.Error] | None = None

    async def __aenter__(self) -> "FakeCursor":
        return self

    async def __aexit__(
        self, exc_type: type[BaseException] | None, exc: BaseException | None, tb: TracebackType | None
    ) -> None:
        pass

    async def execute(self, query: str, params: tuple[object, ...] | None = None) -> None:
        self.calls.append((query, params))
        if self.error_on_call is not None and len(self.calls) == self.error_on_call[0]:
            raise self.error_on_call[1]

    async def fetchone(self) -> dict[str, object] | None:
        return self.one

    async def fetchall(self) -> list[dict[str, object]]:
        return self.rows


class FakeConnection:
    def __init__(self) -> None:
        self.query_cursor = FakeCursor()
        self.committed = False
        self.rolled_back = False
        self.commit_error: psycopg.Error | None = None

    async def __aenter__(self) -> "FakeConnection":
        return self

    async def __aexit__(
        self, exc_type: type[BaseException] | None, exc: BaseException | None, tb: TracebackType | None
    ) -> None:
        self.rolled_back = exc is not None
        if exc is None and self.commit_error is not None:
            raise self.commit_error
        self.committed = exc is None

    def cursor(self) -> FakeCursor:
        return self.query_cursor


@pytest.fixture
def database(monkeypatch: pytest.MonkeyPatch) -> tuple[AsyncMock, FakeConnection]:
    connection = FakeConnection()
    connect = AsyncMock(return_value=connection)
    monkeypatch.setattr("app.integrations.tigerdata.client.psycopg.AsyncConnection.connect", connect)
    return connect, connection


def test_optional_client_never_connects_on_construction(database: tuple[AsyncMock, FakeConnection]) -> None:
    connect, _ = database
    assert TigerDataClient(None).configured is False
    assert TigerDataClient(SecretStr("  ")).configured is False
    assert TigerDataClient(DSN).configured is True
    connect.assert_not_called()


@pytest.mark.parametrize("method", ["health", "record", "list"])
async def test_missing_dsn_fails_without_connecting(database: tuple[AsyncMock, FakeConnection], method: str) -> None:
    connect, _ = database
    client = TigerDataClient(None)
    with pytest.raises(IntegrationNotConfiguredError, match="TIGERDATA_DSN"):
        if method == "health":
            await client.health()
        elif method == "record":
            await client.record_event(event())
        else:
            await client.list_events(source="photon", since=WHEN)
    connect.assert_not_called()


@pytest.mark.parametrize(
    "dsn",
    [
        "not a valid connection string secret_password",
        "dbname=metrics",
        "host=/tmp dbname=metrics",
        "host=one.example.com,two.example.com dbname=metrics",
        "service=metrics host=metrics.example.com",
        "host=metrics.example.com hostaddr=127.0.0.1",
    ],
)
def test_dsn_requires_a_single_tcp_hostname(dsn: str) -> None:
    with pytest.raises(ValueError) as exc:
        TigerDataClient(SecretStr(dsn))
    assert "secret_password" not in str(exc.value)


async def test_health_enforces_verified_tls_and_timeouts(database: tuple[AsyncMock, FakeConnection]) -> None:
    connect, connection = database
    client = TigerDataClient(DSN, sslrootcert="C:/certificates/root.pem")
    assert await client.health() is True
    connect.assert_awaited_once()
    assert connect.call_args.args == (DSN.get_secret_value(),)
    options = connect.call_args.kwargs
    assert options["sslmode"] == "verify-full"
    assert options["gssencmode"] == "disable"
    assert options["sslrootcert"] == "C:/certificates/root.pem"
    assert options["connect_timeout"] == 5
    assert options["options"] == "-c statement_timeout=5000"
    assert connection.query_cursor.calls == [("SELECT 1 AS healthy", None)]
    assert connection.committed


async def test_health_rejects_unexpected_result(database: tuple[AsyncMock, FakeConnection]) -> None:
    _, connection = database
    connection.query_cursor.one = None
    with pytest.raises(IntegrationInvalidResponseError):
        await TigerDataClient(DSN).health()
    assert connection.rolled_back


async def test_record_commits_id_and_event_in_one_transaction(database: tuple[AsyncMock, FakeConnection]) -> None:
    _, connection = database
    connection.query_cursor.one = {"event_id": EVENT_ID}
    assert await TigerDataClient(DSN).record_event(event()) is True
    calls = connection.query_cursor.calls
    assert len(calls) == 2
    assert calls[0][1] == (EVENT_ID, WHEN)
    assert "ON CONFLICT (event_id) DO NOTHING" in calls[0][0]
    assert calls[1][1] == (EVENT_ID, WHEN, "photon", "delivery", "success", 12)
    assert "photon" not in calls[1][0]
    assert connection.committed


async def test_duplicate_uuid_skips_event_even_if_timestamp_changed(
    database: tuple[AsyncMock, FakeConnection],
) -> None:
    _, connection = database
    connection.query_cursor.one = None
    assert await TigerDataClient(DSN).record_event(event(occurred_at=WHEN + timedelta(seconds=1))) is False
    assert len(connection.query_cursor.calls) == 1
    assert connection.query_cursor.calls[0][1] == (EVENT_ID, WHEN + timedelta(seconds=1))


async def test_failed_event_insert_rolls_back_id_reservation(database: tuple[AsyncMock, FakeConnection]) -> None:
    connect, connection = database
    connection.query_cursor.one = {"event_id": EVENT_ID}
    connection.query_cursor.error_on_call = (2, psycopg.OperationalError("secret_password in provider diagnostics"))
    with pytest.raises(IntegrationUnavailableError) as exc:
        await TigerDataClient(DSN).record_event(event())
    assert connection.rolled_back
    assert not connection.committed
    assert "secret_password" not in str(exc.value)
    connect.assert_awaited_once()


async def test_commit_failure_is_sanitized_and_not_retried(database: tuple[AsyncMock, FakeConnection]) -> None:
    connect, connection = database
    connection.commit_error = psycopg.OperationalError("secret_password")
    with pytest.raises(IntegrationUnavailableError) as exc:
        await TigerDataClient(DSN).record_event(event())
    assert "secret_password" not in str(exc.value)
    connect.assert_awaited_once()


async def test_list_returns_typed_events_and_binds_filters(database: tuple[AsyncMock, FakeConnection]) -> None:
    _, connection = database
    connection.query_cursor.rows = [event().model_dump()]
    rows = await TigerDataClient(DSN).list_events(source="photon", since=WHEN, limit=23)
    assert rows == [event()]
    sql, params = connection.query_cursor.calls[0]
    assert params == ("photon", WHEN, 23)
    assert "photon" not in sql


async def test_list_rejects_invalid_provider_rows(database: tuple[AsyncMock, FakeConnection]) -> None:
    _, connection = database
    connection.query_cursor.rows = [{"event_id": "bad", "message_body": "private"}]
    with pytest.raises(IntegrationInvalidResponseError) as exc:
        await TigerDataClient(DSN).list_events(source="photon", since=WHEN)
    assert "private" not in str(exc.value)


@pytest.mark.parametrize(
    ("source", "since", "limit"),
    [("photon'; DROP TABLE events;--", WHEN, 10), ("photon", WHEN.replace(tzinfo=None), 10), ("photon", WHEN, 0)],
)
async def test_invalid_filters_fail_before_connecting(
    database: tuple[AsyncMock, FakeConnection], source: str, since: datetime, limit: int
) -> None:
    connect, _ = database
    with pytest.raises(ValueError):
        await TigerDataClient(DSN).list_events(source=source, since=since, limit=limit)
    connect.assert_not_called()


@pytest.mark.parametrize(
    "changes",
    [
        {"message_body": "private"},
        {"source": "private message"},
        {"occurred_at": WHEN.replace(tzinfo=None)},
        {"duration_ms": -1},
        {"duration_ms": True},
        {"duration_ms": 86_400_001},
        {"outcome": "anything"},
    ],
)
def test_event_rejects_payloads_and_invalid_metrics(changes: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        event(**changes)


@pytest.mark.parametrize(
    ("error", "expected"),
    [
        (ConnectionTimeout("private diagnostics"), IntegrationTimeoutError),
        (QueryCanceled("private diagnostics"), IntegrationTimeoutError),
        (psycopg.errors.InvalidPassword("private diagnostics"), IntegrationAuthError),
        (InsufficientPrivilege("private diagnostics"), IntegrationAuthError),
        (UndefinedTable("private diagnostics"), IntegrationUnavailableError),
        (psycopg.OperationalError("private diagnostics"), IntegrationUnavailableError),
        (psycopg.ProgrammingError("private diagnostics"), IntegrationRequestError),
    ],
)
async def test_provider_errors_are_sanitized_without_retry(
    database: tuple[AsyncMock, FakeConnection], error: psycopg.Error, expected: type[Exception]
) -> None:
    connect, _ = database
    connect.side_effect = error
    with pytest.raises(expected) as exc:
        await TigerDataClient(DSN).health()
    assert "private diagnostics" not in str(exc.value)
    assert DSN.get_secret_value() not in str(exc.value)
    connect.assert_awaited_once()
