"""Generic HTTP client + base adapter: success, timeouts, error mapping, validation, retries,
SSRF guard, missing credentials and log hygiene. All HTTP is mocked."""

import logging
from typing import ClassVar

import httpx
import pytest
from pydantic import BaseModel, SecretStr

from app.integrations.base import ExternalService
from app.integrations.errors import (
    IntegrationAuthError,
    IntegrationError,
    IntegrationInvalidResponseError,
    IntegrationNotConfiguredError,
    IntegrationRateLimitedError,
    IntegrationRequestError,
    IntegrationTimeoutError,
    IntegrationUnavailableError,
)
from app.integrations.http import NO_RETRY, HttpClient, RetryPolicy, redact
from tests.mock_api import MockApi

BASE = "https://api.example.test/v1"
SECRET = "sk-test-SECRET-value-1234567890"


class Item(BaseModel):
    id: int
    name: str


class Sleeps:
    def __init__(self) -> None:
        self.calls: list[float] = []

    async def __call__(self, seconds: float) -> None:
        self.calls.append(seconds)


def make_client(
    api: MockApi,
    sleeps: Sleeps | None = None,
    *,
    headers: dict[str, str] | None = None,
    retry: RetryPolicy | None = None,
    log_paths: bool = True,
    max_response_bytes: int = 5_000_000,
) -> HttpClient:
    return HttpClient(
        api.client(),
        service="example",
        base_url=BASE,
        headers=headers,
        retry=retry,
        log_paths=log_paths,
        max_response_bytes=max_response_bytes,
        sleep=sleeps or Sleeps(),
    )


@pytest.fixture
def app_logs(caplog: pytest.LogCaptureFixture, monkeypatch: pytest.MonkeyPatch) -> pytest.LogCaptureFixture:
    # configure_logging() stops the "app" logger propagating; re-enable it so caplog sees records.
    monkeypatch.setattr(logging.getLogger("app"), "propagate", True)
    caplog.set_level(logging.INFO, logger="app.integrations.http")
    return caplog


# --- success + validation ----------------------------------------------------------------


async def test_successful_response_is_validated_into_model() -> None:
    api = MockApi(httpx.Response(200, json={"id": 1, "name": "widget", "extra": True}))
    client = make_client(api, headers={"X-Default": "1"})

    item = await client.request_json(
        "GET", "/items/1", model=Item, params={"expand": "owner", "skip": None}, headers={"X-Call": "2"}
    )

    assert item == Item(id=1, name="widget")
    request = api.last
    assert str(request.url) == f"{BASE}/items/1?expand=owner"
    assert request.headers["X-Default"] == "1"
    assert request.headers["X-Call"] == "2"
    assert request.headers["Accept"] == "application/json"


async def test_json_body_is_sent() -> None:
    api = MockApi(httpx.Response(201, json={"id": 2, "name": "new"}))
    await make_client(api).request_json("POST", "/items", model=Item, json={"name": "new"})
    assert api.last.method == "POST"
    assert api.body() == {"name": "new"}


@pytest.mark.parametrize("method", ["get", "post", "put", "patch", "delete"])
async def test_verb_helpers(method: str) -> None:
    api = MockApi(httpx.Response(204))
    response = await getattr(make_client(api), method)("/things/1")
    assert response.status_code == 204
    assert api.last.method == method.upper()


async def test_invalid_json_raises_invalid_response() -> None:
    api = MockApi(httpx.Response(200, text="<html>oops</html>"))
    with pytest.raises(IntegrationInvalidResponseError, match="not valid JSON"):
        await make_client(api).request_json("GET", "/items/1", model=Item)


async def test_wrong_shape_raises_invalid_response() -> None:
    api = MockApi(httpx.Response(200, json={"id": "not-a-number"}))
    with pytest.raises(IntegrationInvalidResponseError, match="expected shape") as exc_info:
        await make_client(api).request_json("GET", "/items/1", model=Item)
    assert exc_info.value.status_code == 502
    assert exc_info.value.code == "INTEGRATION_INVALID_RESPONSE"


async def test_oversized_response_is_rejected() -> None:
    api = MockApi(httpx.Response(200, content=b"x" * 101))
    with pytest.raises(IntegrationInvalidResponseError, match="larger than allowed"):
        await make_client(api, max_response_bytes=100).get("/big")


# --- API errors --------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("status", "headers", "error_type", "http_status", "code"),
    [
        (400, {}, IntegrationRequestError, 502, "INTEGRATION_REQUEST_FAILED"),
        (401, {}, IntegrationAuthError, 502, "INTEGRATION_AUTH_FAILED"),
        (403, {}, IntegrationAuthError, 502, "INTEGRATION_AUTH_FAILED"),
        (403, {"x-ratelimit-remaining": "0"}, IntegrationRateLimitedError, 503, "INTEGRATION_RATE_LIMITED"),
        (404, {}, IntegrationRequestError, 502, "INTEGRATION_REQUEST_FAILED"),
        (429, {}, IntegrationRateLimitedError, 503, "INTEGRATION_RATE_LIMITED"),
        (500, {}, IntegrationUnavailableError, 502, "INTEGRATION_UNAVAILABLE"),
    ],
)
async def test_api_errors_map_to_structured_errors(
    status: int, headers: dict[str, str], error_type: type[IntegrationError], http_status: int, code: str
) -> None:
    api = MockApi(httpx.Response(status, headers=headers, json={"error": {"message": "nope"}}))
    with pytest.raises(error_type) as exc_info:
        await make_client(api, retry=NO_RETRY).get("/items")
    error = exc_info.value
    assert (error.status_code, error.code) == (http_status, code)
    assert error.details == {"service": "example", "upstream_status": status}
    # Provider auth failures must never surface as 401, which the frontend treats as "session expired".
    assert error.status_code != 401


# --- timeouts + retries ------------------------------------------------------------------


async def test_timeout_is_retried_for_get_then_raises_timeout_error() -> None:
    api = MockApi(httpx.ReadTimeout("slow"))
    sleeps = Sleeps()
    with pytest.raises(IntegrationTimeoutError) as exc_info:
        await make_client(api, sleeps).get("/slow")
    assert exc_info.value.status_code == 504
    assert len(api.requests) == 3
    assert len(sleeps.calls) == 2


async def test_post_timeout_is_not_retried() -> None:
    """The request may have reached the server; retrying could duplicate a side effect."""
    api = MockApi(httpx.ReadTimeout("slow"))
    with pytest.raises(IntegrationTimeoutError):
        await make_client(api).post("/payments", json={"amount": 1})
    assert len(api.requests) == 1


async def test_post_is_retried_when_connection_never_opened() -> None:
    api = MockApi(httpx.ConnectError("refused"), httpx.Response(200, json={"id": 1, "name": "a"}))
    item = await make_client(api).request_json("POST", "/items", model=Item, json={})
    assert item.id == 1
    assert len(api.requests) == 2


async def test_get_is_retried_on_503_then_succeeds() -> None:
    api = MockApi(httpx.Response(503), httpx.Response(502), httpx.Response(200, json={"id": 1, "name": "a"}))
    item = await make_client(api).request_json("GET", "/items/1", model=Item)
    assert item.name == "a"
    assert len(api.requests) == 3


async def test_post_is_not_retried_on_503() -> None:
    api = MockApi(httpx.Response(503), httpx.Response(200, json={}))
    with pytest.raises(IntegrationUnavailableError):
        await make_client(api).post("/emails", json={})
    assert len(api.requests) == 1


async def test_post_marked_idempotent_is_retried_on_503() -> None:
    api = MockApi(httpx.Response(503), httpx.Response(200, json={"id": 1, "name": "a"}))
    await make_client(api).request_json("POST", "/generate", model=Item, json={}, idempotent=True)
    assert len(api.requests) == 2


async def test_429_is_retried_for_post_and_honours_retry_after() -> None:
    api = MockApi(httpx.Response(429, headers={"Retry-After": "2"}), httpx.Response(200, json={"id": 1, "name": "a"}))
    sleeps = Sleeps()
    await make_client(api, sleeps).request_json("POST", "/items", model=Item, json={})
    assert len(api.requests) == 2
    assert sleeps.calls == [2.0]


async def test_retry_after_is_capped() -> None:
    api = MockApi(httpx.Response(429, headers={"Retry-After": "3600"}), httpx.Response(204))
    sleeps = Sleeps()
    await make_client(api, sleeps, retry=RetryPolicy(max_delay_seconds=5)).get("/x")
    assert sleeps.calls == [5.0]


async def test_gives_up_after_max_attempts() -> None:
    api = MockApi(httpx.Response(503))
    with pytest.raises(IntegrationUnavailableError) as exc_info:
        await make_client(api, retry=RetryPolicy(max_attempts=4)).get("/flaky")
    assert len(api.requests) == 4
    assert exc_info.value.upstream_status == 503


async def test_non_retryable_status_is_not_retried() -> None:
    api = MockApi(httpx.Response(400, json={}))
    with pytest.raises(IntegrationRequestError):
        await make_client(api).get("/bad")
    assert len(api.requests) == 1


def test_backoff_grows_exponentially_and_is_capped() -> None:
    policy = RetryPolicy(base_delay_seconds=1, max_delay_seconds=4)
    for attempt, ceiling in [(1, 1), (2, 2), (3, 4), (6, 4)]:
        assert all(0 <= policy.delay(attempt) <= ceiling for _ in range(50))


# --- SSRF guard --------------------------------------------------------------------------


@pytest.mark.parametrize(
    "path",
    ["https://evil.test/x", "http://169.254.169.254/latest", "//evil.test/x", "\\\\evil", "../admin", "a/../../b"],
)
async def test_only_relative_paths_under_base_url_are_allowed(path: str) -> None:
    api = MockApi()
    with pytest.raises(ValueError, match="only paths relative"):
        await make_client(api).get(path)
    assert api.requests == []


# --- base adapter: credentials -----------------------------------------------------------


class ExampleService(ExternalService):
    service_name: ClassVar[str] = "example"
    env_var: ClassVar[str] = "EXAMPLE_API_KEY"
    base_url: ClassVar[str] = BASE
    retry: ClassVar[RetryPolicy] = NO_RETRY

    def auth_params(self) -> dict[str, str]:
        return {"key": self.credential()}

    async def get_item(self, item_id: int) -> Item:
        return await self.call("GET", f"/items/{item_id}", model=Item)


async def test_adapter_authenticates_requests_and_returns_typed_result() -> None:
    api = MockApi(httpx.Response(200, json={"id": 7, "name": "seven"}))
    service = ExampleService(api.client(), SecretStr(SECRET))

    assert await service.get_item(7) == Item(id=7, name="seven")
    assert api.last.headers["Authorization"] == f"Bearer {SECRET}"
    assert api.last.url.params["key"] == SECRET
    assert api.last.headers["User-Agent"] == "hackathon-backend/1.0"


@pytest.mark.parametrize("credential", [None, SecretStr("")])
async def test_missing_credentials_fail_clearly_without_any_request(credential: SecretStr | None) -> None:
    api = MockApi()
    service = ExampleService(api.client(), credential)

    assert service.configured is False
    with pytest.raises(IntegrationNotConfiguredError) as exc_info:
        await service.get_item(1)
    error = exc_info.value
    assert error.status_code == 503
    assert error.code == "INTEGRATION_NOT_CONFIGURED"
    assert error.details == {"service": "example", "env_var": "EXAMPLE_API_KEY"}
    assert "EXAMPLE_API_KEY" in error.message
    assert api.requests == []


# --- logging -----------------------------------------------------------------------------


async def test_logs_never_contain_credentials_query_or_body(app_logs: pytest.LogCaptureFixture) -> None:
    error_body = {"error": {"message": f"Incorrect API key provided: {SECRET}"}}
    api = MockApi(httpx.Response(200, json={"id": 1, "name": "a"}), httpx.Response(401, json=error_body))
    service = ExampleService(api.client(), SecretStr(SECRET))

    await service.get_item(1)
    with pytest.raises(IntegrationAuthError):
        await service.get_item(2)

    assert "example GET /items/1 -> 200" in app_logs.text
    assert "example GET /items/2 -> 401: Incorrect API key provided: [REDACTED]" in app_logs.text
    assert SECRET not in app_logs.text
    assert "key=" not in app_logs.text
    assert "Authorization" not in app_logs.text


async def test_secret_paths_are_not_logged(app_logs: pytest.LogCaptureFixture) -> None:
    api = MockApi(httpx.Response(200))
    await make_client(api, log_paths=False).post("/T000/B000/hook-secret", json={"text": "hi"})
    assert "hook-secret" not in app_logs.text
    assert "example POST <redacted> -> 200" in app_logs.text


async def test_transport_failures_log_only_the_error_type(app_logs: pytest.LogCaptureFixture) -> None:
    api = MockApi(httpx.ConnectError(f"failed for https://user:{SECRET}@host"))
    with pytest.raises(IntegrationUnavailableError):
        await make_client(api, retry=NO_RETRY).get("/x")
    assert "ConnectError" in app_logs.text
    assert SECRET not in app_logs.text


@pytest.mark.parametrize(
    "secret",
    [
        "sk-proj-abcdefghijklmnop",
        "xai-abcdefghijklmnop",
        "ghp_abcdefghijklmnop",
        "github_pat_abcdefghijk",
        "AIzaSyAbcdefghijklmnop",
        "re_abcdefghijklmnop",
        "Bearer abc.def.ghi",
    ],
)
def test_redact_masks_known_secret_formats(secret: str) -> None:
    assert redact(f"bad key {secret} here") == "bad key [REDACTED] here"
