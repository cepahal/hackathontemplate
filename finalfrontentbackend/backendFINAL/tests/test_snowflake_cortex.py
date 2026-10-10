"""Snowflake Cortex contract and safety checks; all HTTP uses an in-memory transport."""

import logging

import httpx
import pytest
from pydantic import SecretStr

from app.integrations.errors import (
    IntegrationAuthError,
    IntegrationInvalidResponseError,
    IntegrationNotConfiguredError,
    IntegrationRateLimitedError,
    IntegrationRequestError,
    IntegrationTimeoutError,
    IntegrationUnavailableError,
)
from app.integrations.snowflake import CortexClient, CortexTextResult
from tests.mock_api import MockApi

TOKEN = SecretStr("cortex-test-token-do-not-log")
HOST = "testorg-testaccount.snowflakecomputing.com"


def completion() -> httpx.Response:
    return httpx.Response(
        200,
        json={
            "id": "chatcmpl-test",
            "model": "claude-sonnet-4-5",
            "choices": [{"index": 0, "message": {"role": "assistant", "content": "API ready."}}],
            "usage": {"prompt_tokens": 4, "completion_tokens": 3},
        },
    )


async def test_generation_uses_snowflake_pat_and_current_bounded_chat_contract() -> None:
    api = MockApi(completion())
    client = CortexClient(api.client(), TOKEN, account_host=HOST.upper())
    assert client.configured
    assert not api.requests
    result = await client.generate_text("Check this API", system="Answer briefly.", max_tokens=128)
    assert result == CortexTextResult(text="API ready.", model="claude-sonnet-4-5")
    assert api.last.method == "POST"
    assert api.last.url.scheme == "https"
    assert api.last.url.host == HOST
    assert api.last.url.path == "/api/v2/cortex/v1/chat/completions"
    assert not api.last.url.query
    assert api.last.headers["Authorization"] == f"Bearer {TOKEN.get_secret_value()}"
    assert api.last.headers["X-Snowflake-Authorization-Token-Type"] == "PROGRAMMATIC_ACCESS_TOKEN"
    assert api.last.headers["Accept"] == "application/json"
    assert api.last.headers["Content-Type"] == "application/json"
    assert api.last.extensions["timeout"] == {"connect": 30.0, "read": 30.0, "write": 30.0, "pool": 30.0}
    assert api.body() == {
        "model": "claude-sonnet-4-5",
        "messages": [
            {"role": "system", "content": "Answer briefly."},
            {"role": "user", "content": "Check this API"},
        ],
        "max_completion_tokens": 128,
        "stream": False,
    }


async def test_model_override_oauth_and_default_generation_limit() -> None:
    api = MockApi(completion())
    client = CortexClient(api.client(), TOKEN, account_host=HOST, token_type="OAUTH", default_model="llama3.1-8b")
    await client.generate_text("Hello")
    assert api.body()["model"] == "llama3.1-8b"
    assert api.body()["messages"] == [{"role": "user", "content": "Hello"}]
    assert api.body()["max_completion_tokens"] == 1024
    assert api.last.headers["X-Snowflake-Authorization-Token-Type"] == "OAUTH"


@pytest.mark.parametrize("max_tokens", [1, 2048])
async def test_accepts_generation_boundaries(max_tokens: int) -> None:
    api = MockApi(completion())
    await CortexClient(api.client(), TOKEN, account_host=HOST).generate_text(
        "a" * 8000, system="s" * 2000, max_tokens=max_tokens
    )
    assert api.body()["max_completion_tokens"] == max_tokens


@pytest.mark.parametrize(
    "token,host,missing",
    [
        (None, HOST, "SNOWFLAKE_TOKEN"),
        (SecretStr(""), HOST, "SNOWFLAKE_TOKEN"),
        (SecretStr("   "), HOST, "SNOWFLAKE_TOKEN"),
        (TOKEN, None, "SNOWFLAKE_ACCOUNT_HOST"),
    ],
)
async def test_missing_configuration_sends_nothing(token: SecretStr | None, host: str | None, missing: str) -> None:
    api = MockApi()
    client = CortexClient(api.client(), token, account_host=host)
    assert not client.configured
    with pytest.raises(IntegrationNotConfiguredError, match=missing):
        await client.generate_text("Hello")
    assert not api.requests


@pytest.mark.parametrize(
    "host",
    [
        "https://test.snowflakecomputing.com",
        "test.snowflakecomputing.com.attacker.example",
        "test.snowflakecomputing.com/path",
        "user@test.snowflakecomputing.com",
        "127.0.0.1",
    ],
)
def test_host_validation_cannot_be_bypassed(host: str) -> None:
    api = MockApi()
    with pytest.raises(ValueError, match="account hostname"):
        CortexClient(api.client(), TOKEN, account_host=host)
    assert not api.requests


def test_redirect_enabled_client_is_rejected() -> None:
    with pytest.raises(ValueError, match="redirects disabled"):
        CortexClient(httpx.AsyncClient(follow_redirects=True), TOKEN, account_host=HOST)


@pytest.mark.parametrize("model", ["", " ", "unsafe\nmodel", "a" * 256, "https://attacker.example/model"])
def test_invalid_models_fail_before_any_request(model: str) -> None:
    api = MockApi()
    with pytest.raises(ValueError, match="SNOWFLAKE_CORTEX_MODEL"):
        CortexClient(api.client(), TOKEN, account_host=HOST, default_model=model)
    assert not api.requests


@pytest.mark.parametrize("prompt", ["", "   ", "a" * 8001])
async def test_invalid_prompts_send_nothing(prompt: str) -> None:
    api = MockApi()
    with pytest.raises(ValueError, match="prompt"):
        await CortexClient(api.client(), TOKEN, account_host=HOST).generate_text(prompt)
    assert not api.requests


@pytest.mark.parametrize("system", ["", "  ", "s" * 2001])
async def test_invalid_system_instructions_send_nothing(system: str) -> None:
    api = MockApi()
    with pytest.raises(ValueError, match="system"):
        await CortexClient(api.client(), TOKEN, account_host=HOST).generate_text("Hello", system=system)
    assert not api.requests


@pytest.mark.parametrize("max_tokens", [0, -1, 2049, True])
async def test_invalid_token_limits_send_nothing(max_tokens: int) -> None:
    api = MockApi()
    with pytest.raises(ValueError, match="max_tokens"):
        await CortexClient(api.client(), TOKEN, account_host=HOST).generate_text("Hello", max_tokens=max_tokens)
    assert not api.requests


@pytest.mark.parametrize(
    "status,error",
    [
        (401, IntegrationAuthError),
        (403, IntegrationAuthError),
        (402, IntegrationRequestError),
        (422, IntegrationRequestError),
        (429, IntegrationRateLimitedError),
        (503, IntegrationUnavailableError),
    ],
)
async def test_provider_errors_are_redacted_and_generation_is_never_retried(
    status: int, error: type[Exception], caplog: pytest.LogCaptureFixture
) -> None:
    sensitive = "private-prompt-and-arbitrary-provider-diagnostic"
    api = MockApi(httpx.Response(status, json={"message": sensitive + TOKEN.get_secret_value()}))
    with caplog.at_level(logging.DEBUG, logger="app.integrations.http"):
        with pytest.raises(error) as caught:
            await CortexClient(api.client(), TOKEN, account_host=HOST).generate_text(sensitive)
    assert len(api.requests) == 1
    assert sensitive not in str(caught.value) + caplog.text
    assert TOKEN.get_secret_value() not in str(caught.value) + caplog.text


@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(200, json={}),
        httpx.Response(200, json={"model": "m", "choices": []}),
        httpx.Response(200, json={"model": "m", "choices": [{"message": {"role": "assistant", "content": None}}]}),
        httpx.Response(200, json={"model": "m", "choices": [{"message": {"role": "user", "content": "x"}}]}),
        httpx.Response(200, json={"model": "m", "choices": [{"message": {"role": "assistant", "content": " "}}]}),
        httpx.Response(
            200, json={"model": "m", "choices": [{"message": {"role": "assistant", "content": "x" * 16001}}]}
        ),
        httpx.Response(200, json={"model": 123, "choices": [{"message": {"role": "assistant", "content": "x"}}]}),
        httpx.Response(200, text="data: private-response-diagnostic"),
        httpx.Response(202, json={"message": "private-response-diagnostic"}),
        httpx.Response(302, headers={"Location": "https://attacker.example/steal-token"}),
    ],
)
async def test_malformed_or_unexpected_responses_fail_safely(
    response: httpx.Response, caplog: pytest.LogCaptureFixture
) -> None:
    api = MockApi(response)
    with pytest.raises(IntegrationInvalidResponseError) as caught:
        await CortexClient(api.client(), TOKEN, account_host=HOST).generate_text("Hello")
    assert len(api.requests) == 1
    assert "private-response-diagnostic" not in str(caught.value) + caplog.text


async def test_ambiguous_timeout_is_redacted_and_does_not_retry(caplog: pytest.LogCaptureFixture) -> None:
    api = MockApi(httpx.ReadTimeout("private transport diagnostic"))
    with pytest.raises(IntegrationTimeoutError) as caught:
        await CortexClient(api.client(), TOKEN, account_host=HOST).generate_text("Hello")
    assert len(api.requests) == 1
    assert "private transport diagnostic" not in str(caught.value) + caplog.text
