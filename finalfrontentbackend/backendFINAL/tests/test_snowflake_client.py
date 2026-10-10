"""Snowflake SQL REST contract checks; every request uses an in-memory transport."""

import asyncio
import logging

import httpx
import pytest
from pydantic import SecretStr, ValidationError

from app.integrations.errors import (
    IntegrationAuthError,
    IntegrationInvalidResponseError,
    IntegrationNotConfiguredError,
    IntegrationRateLimitedError,
    IntegrationRequestError,
    IntegrationTimeoutError,
    IntegrationUnavailableError,
)
from app.integrations.snowflake.client import SnowflakeBinding, SnowflakeClient
from tests.mock_api import MockApi

TOKEN = SecretStr("snowflake-test-token-do-not-log")
HOST = "testorg-testaccount.snowflakecomputing.com"
HANDLE = "e4ce975e-f7ff-4b5e-b15e-bf25f59371ae"


def result_response(*, rows: int = 1) -> httpx.Response:
    return httpx.Response(
        200,
        json={
            "code": "090001",
            "statementHandle": HANDLE,
            "resultSetMetaData": {"numRows": rows, "rowType": [{"name": "API_READY", "type": "text"}]},
            "data": [["OK"]],
        },
    )


def pending_response() -> httpx.Response:
    return httpx.Response(
        202,
        json={"statementHandle": HANDLE, "statementStatusUrl": "https://untrusted.example/steal-token"},
    )


async def test_read_demo_uses_pat_bindings_and_configured_context() -> None:
    api = MockApi(result_response())
    client = SnowflakeClient(
        api.client(), TOKEN, account_host=HOST, warehouse="DEMO_WH", database="DEMO", schema="PUBLIC", role="DEMO_ROLE"
    )
    result = await client.read_demo()
    assert client.configured
    assert result.data == [["OK"]]
    assert result.metadata.columns[0].name == "API_READY"
    assert not result.has_more_rows
    assert api.last.url.host == HOST
    assert api.last.url.path == "/api/v2/statements"
    assert api.last.url.params["async"] == "true"
    assert api.last.url.params["requestId"]
    assert api.last.headers["Authorization"] == f"Bearer {TOKEN.get_secret_value()}"
    assert api.last.headers["X-Snowflake-Authorization-Token-Type"] == "PROGRAMMATIC_ACCESS_TOKEN"
    assert api.body() == {
        "statement": "SELECT ? AS API_READY",
        "timeout": 30,
        "parameters": {"MULTI_STATEMENT_COUNT": "1"},
        "warehouse": "DEMO_WH",
        "database": "DEMO",
        "schema": "PUBLIC",
        "role": "DEMO_ROLE",
        "bindings": {"1": {"type": "TEXT", "value": "OK"}},
    }


async def test_oauth_and_binding_values_are_not_interpolated() -> None:
    api = MockApi(result_response())
    client = SnowflakeClient(api.client(), TOKEN, account_host=HOST, token_type="OAUTH")
    value = "'; DROP TABLE demo; --"
    await client.execute("SELECT ?", bindings={"1": SnowflakeBinding(type="TEXT", value=value)})
    assert api.body()["statement"] == "SELECT ?"
    assert api.body()["bindings"]["1"]["value"] == value
    assert api.last.headers["X-Snowflake-Authorization-Token-Type"] == "OAUTH"


async def test_202_polls_only_validated_handle_on_configured_host() -> None:
    api = MockApi(pending_response(), pending_response(), result_response(rows=2))
    client = SnowflakeClient(api.client(), TOKEN, account_host=HOST, poll_interval_seconds=0)
    result = await client.read_demo()
    assert result.has_more_rows
    assert len(api.requests) == 3
    assert [request.method for request in api.requests] == ["POST", "GET", "GET"]
    assert all(request.url.host == HOST for request in api.requests)
    assert api.last.url.path == f"/api/v2/statements/{HANDLE}"


async def test_429_during_polling_counts_toward_same_budget() -> None:
    api = MockApi(pending_response(), httpx.Response(429, json={"statementHandle": HANDLE}), result_response())
    result = await SnowflakeClient(api.client(), TOKEN, account_host=HOST, poll_interval_seconds=0).read_demo()
    assert result.data == [["OK"]]
    assert len(api.requests) == 3


async def test_poll_budget_stops_without_resubmitting_or_claiming_completion() -> None:
    api = MockApi(pending_response())
    client = SnowflakeClient(api.client(), TOKEN, account_host=HOST, max_poll_attempts=2, poll_interval_seconds=0)
    with pytest.raises(IntegrationTimeoutError):
        await client.read_demo()
    assert len(api.requests) == 3
    assert sum(request.method == "POST" for request in api.requests) == 1


async def test_overall_deadline_bounds_submission_and_polls(monkeypatch: pytest.MonkeyPatch) -> None:
    api = MockApi(pending_response())
    client = SnowflakeClient(api.client(), TOKEN, account_host=HOST, poll_timeout_seconds=0.01)
    original_sleep = asyncio.sleep

    async def slow_sleep(_: float) -> None:
        await original_sleep(1)

    monkeypatch.setattr("app.integrations.snowflake.client.asyncio.sleep", slow_sleep)
    with pytest.raises(IntegrationTimeoutError):
        await client.read_demo()
    assert len(api.requests) == 1


@pytest.mark.parametrize(
    "token,host,missing", [(None, HOST, "SNOWFLAKE_TOKEN"), (TOKEN, None, "SNOWFLAKE_ACCOUNT_HOST")]
)
async def test_missing_config_sends_nothing(token: SecretStr | None, host: str | None, missing: str) -> None:
    api = MockApi()
    client = SnowflakeClient(api.client(), token, account_host=host)
    assert not client.configured
    with pytest.raises(IntegrationNotConfiguredError, match=missing):
        await client.read_demo()
    assert not api.requests


@pytest.mark.parametrize(
    "host",
    [
        "https://test.snowflakecomputing.com",
        "test.snowflakecomputing.com.attacker.example",
        "test.snowflakecomputing.com:443",
        "test.snowflakecomputing.com/path",
        "test.snowflakecomputing.com?key=x",
        "user@test.snowflakecomputing.com",
        "snowflakecomputing.com",
        "127.0.0.1",
        "-test.snowflakecomputing.com",
    ],
)
def test_unsafe_hosts_are_rejected(host: str) -> None:
    api = MockApi()
    with pytest.raises(ValueError, match="account hostname"):
        SnowflakeClient(api.client(), TOKEN, account_host=host)
    assert not api.requests


def test_redirect_enabled_client_is_rejected() -> None:
    with pytest.raises(ValueError, match="redirects disabled"):
        SnowflakeClient(httpx.AsyncClient(follow_redirects=True), TOKEN, account_host=HOST)


@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(202, json={"statementHandle": "../../secret"}),
        httpx.Response(202, json={"statementHandle": f"../../{HANDLE}"}),
        httpx.Response(202, json={"statementHandle": f"{HANDLE}?redirect=secret"}),
        httpx.Response(202, json={}),
        httpx.Response(200, json={"message": "secret data"}),
        httpx.Response(200, text="not JSON; secret data"),
        httpx.Response(302, headers={"Location": "https://untrusted.example/"}),
    ],
)
async def test_invalid_provider_responses_fail_closed(
    response: httpx.Response, caplog: pytest.LogCaptureFixture
) -> None:
    api = MockApi(response)
    with pytest.raises(IntegrationInvalidResponseError) as caught:
        await SnowflakeClient(api.client(), TOKEN, account_host=HOST, poll_interval_seconds=0).read_demo()
    assert len(api.requests) == 1
    assert "secret data" not in str(caught.value)
    assert "secret data" not in caplog.text


@pytest.mark.parametrize(
    "status,error",
    [
        (401, IntegrationAuthError),
        (403, IntegrationAuthError),
        (422, IntegrationRequestError),
        (429, IntegrationRateLimitedError),
        (503, IntegrationUnavailableError),
    ],
)
async def test_errors_are_redacted_and_submissions_never_retry(
    status: int, error: type[Exception], caplog: pytest.LogCaptureFixture
) -> None:
    sensitive = "sql-value-private-and-arbitrary-pat"
    api = MockApi(httpx.Response(status, json={"message": f"{sensitive} {TOKEN.get_secret_value()}"}))
    with caplog.at_level(logging.DEBUG, logger="app.integrations.http"):
        with pytest.raises(error) as caught:
            await SnowflakeClient(api.client(), TOKEN, account_host=HOST).execute("SELECT ?")
    assert len(api.requests) == 1
    assert sensitive not in str(caught.value) + caplog.text
    assert TOKEN.get_secret_value() not in str(caught.value) + caplog.text


async def test_ambiguous_transport_failure_does_not_resubmit() -> None:
    api = MockApi(httpx.ReadTimeout("private SQL response"))
    with pytest.raises(IntegrationTimeoutError):
        await SnowflakeClient(api.client(), TOKEN, account_host=HOST).read_demo()
    assert len(api.requests) == 1


async def test_invalid_statement_and_bindings_send_nothing() -> None:
    api = MockApi()
    client = SnowflakeClient(api.client(), TOKEN, account_host=HOST)
    with pytest.raises(ValueError, match="statement"):
        await client.execute(" ")
    with pytest.raises(ValueError, match="statement"):
        await client.execute(" " * 100_000 + "SELECT 1")
    with pytest.raises(ValueError, match="bindings"):
        await client.execute("SELECT ?", bindings={"../x": SnowflakeBinding(type="TEXT", value="OK")})
    with pytest.raises(ValidationError):
        SnowflakeBinding.model_validate({"type": "TEXT", "value": 123})
    assert not api.requests
