"""/api/v1/integrations/* routes: auth, policies (rate limit, public-only GitHub, email to self,
admin-only notifications) and error envelopes. External HTTP is mocked."""

from collections.abc import Callable

import httpx
import pytest
from fastapi.testclient import TestClient

from app.core.errors import TooManyRequestsError
from app.core.rate_limit import RateLimiter
from app.integrations.registry import Integrations
from tests.conftest import TokenFactory, build_settings
from tests.fakes import InMemoryDB
from tests.mock_api import MockApi
from tests.test_integration_clients import DISCORD_URL, repo_json

pytestmark = pytest.mark.usefixtures("instant_retries")

ClientFactory = Callable[..., TestClient]
OPENAI_KEY = "sk-test-route-key-123456"


def make_client(client_factory: ClientFactory, api: MockApi, **settings: object) -> TestClient:
    config = build_settings(**settings)
    return client_factory(InMemoryDB(), config, Integrations(config, api.client()))


# --- status ------------------------------------------------------------------------------


def test_status_requires_auth(client: TestClient) -> None:
    assert client.get("/api/v1/integrations/status").status_code == 401


def test_status_reports_booleans_only(client_factory: ClientFactory, alice: dict[str, str]) -> None:
    api = MockApi()
    client = make_client(client_factory, api, openai_api_key=OPENAI_KEY, github_token="ghp_route_token_123")

    response = client.get("/api/v1/integrations/status", headers=alice)

    assert response.status_code == 200
    body = response.json()
    assert body["openai"] is True and body["github"] is True
    assert body["gemini"] is False and body["maps"] is False and body["email"] is False
    assert all(isinstance(value, bool) for value in body.values())
    assert OPENAI_KEY not in response.text and "ghp_" not in response.text
    assert api.requests == []


def test_backend_runs_with_no_integration_keys(client: TestClient, alice: dict[str, str]) -> None:
    body = client.get("/api/v1/integrations/status", headers=alice).json()
    assert not any(body.values())
    assert client.get("/api/v1/health").status_code == 200


# --- rate limiter (shared by integration and AI generation routes) ------------------------


def test_rate_limiter_window_slides() -> None:
    now = [0.0]
    limiter = RateLimiter(2, 60, clock=lambda: now[0])
    limiter.check("u")
    now[0] = 30
    limiter.check("u")
    with pytest.raises(TooManyRequestsError) as exc_info:
        limiter.check("u")
    assert exc_info.value.headers == {"Retry-After": "30"}
    limiter.check("other-user")
    now[0] = 60.5
    limiter.check("u")


# --- GitHub ------------------------------------------------------------------------------


def test_get_public_repository(client_factory: ClientFactory, alice: dict[str, str]) -> None:
    api = MockApi(httpx.Response(200, json=repo_json()))
    client = make_client(client_factory, api, github_token="ghp_route_token_123")

    response = client.get("/api/v1/integrations/github/repos/fastapi/fastapi", headers=alice)

    assert response.status_code == 200
    assert response.json()["full_name"] == "fastapi/fastapi"


def test_private_repository_visible_to_server_token_is_hidden(
    client_factory: ClientFactory, alice: dict[str, str]
) -> None:
    api = MockApi(httpx.Response(200, json=repo_json("secret-repo", private=True)))
    client = make_client(client_factory, api, github_token="ghp_route_token_123")

    response = client.get("/api/v1/integrations/github/repos/fastapi/secret-repo", headers=alice)

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "GITHUB_REPOSITORY_NOT_FOUND"
    assert "secret-repo" not in response.text


def test_search_filters_private_repositories(client_factory: ClientFactory, alice: dict[str, str]) -> None:
    items = [repo_json(), repo_json("hidden", private=True)]
    api = MockApi(httpx.Response(200, json={"total_count": 2, "incomplete_results": False, "items": items}))
    client = make_client(client_factory, api, github_token="ghp_route_token_123")

    response = client.get(
        "/api/v1/integrations/github/search", headers=alice, params={"q": "fastapi", "sort": "stars", "per_page": 5}
    )

    assert response.status_code == 200
    assert [item["name"] for item in response.json()["items"]] == ["fastapi"]
    assert api.last.url.params["per_page"] == "5"


@pytest.mark.parametrize(
    "path",
    [
        "/api/v1/integrations/github/repos/-bad/repo",
        "/api/v1/integrations/github/repos/owner/re%20po",
        "/api/v1/integrations/github/search?q=",
        "/api/v1/integrations/github/search?q=x&per_page=500",
        "/api/v1/integrations/github/search?q=x&sort=evil",
    ],
)
def test_github_input_validation(client: TestClient, alice: dict[str, str], path: str) -> None:
    assert client.get(path, headers=alice).status_code == 422


# --- Maps --------------------------------------------------------------------------------


def test_geocode(client_factory: ClientFactory, alice: dict[str, str]) -> None:
    feature = {"geometry": {"coordinates": [2.35, 48.85]}, "properties": {"full_address": "Paris, France"}}
    api = MockApi(httpx.Response(200, json={"features": [feature]}))
    client = make_client(client_factory, api, maps_api_key="pk.route_token_123")

    response = client.get("/api/v1/integrations/maps/geocode", headers=alice, params={"q": "Paris", "limit": 1})

    assert response.status_code == 200
    assert response.json() == [{"name": "Paris, France", "latitude": 48.85, "longitude": 2.35, "kind": None}]


def test_geocode_unconfigured(client: TestClient, alice: dict[str, str]) -> None:
    response = client.get("/api/v1/integrations/maps/geocode", headers=alice, params={"q": "Paris"})
    assert response.status_code == 503
    assert response.json()["error"]["details"]["env_var"] == "MAPS_API_KEY"


# --- Email -------------------------------------------------------------------------------


def test_test_email_goes_only_to_the_callers_own_address(client_factory: ClientFactory, alice: dict[str, str]) -> None:
    api = MockApi(httpx.Response(200, json={"id": "email_1"}))
    client = make_client(client_factory, api, resend_api_key="re_route_key_123", email_from="App <hi@app.test>")

    response = client.post(
        "/api/v1/integrations/email/test", headers=alice, json={"subject": "Hi", "html": "<p>Hi</p>"}
    )

    assert response.status_code == 200
    assert response.json() == {"id": "email_1", "provider": "resend"}
    assert api.body()["to"] == ["alice@example.com"]
    assert api.last.headers["Idempotency-Key"].startswith("test-email-")


def test_test_email_cannot_choose_recipient(client: TestClient, alice: dict[str, str]) -> None:
    response = client.post(
        "/api/v1/integrations/email/test",
        headers=alice,
        json={"subject": "Hi", "html": "<p>x</p>", "to": "victim@example.com"},
    )
    assert response.status_code == 422


def test_test_email_rejects_header_injection(client: TestClient, alice: dict[str, str]) -> None:
    response = client.post(
        "/api/v1/integrations/email/test", headers=alice, json={"subject": "Hi\nBcc: x@example.com", "html": "<p>x</p>"}
    )
    assert response.status_code == 422


def test_test_email_requires_an_address(client_factory: ClientFactory, make_token: TokenFactory) -> None:
    api = MockApi()
    client = make_client(client_factory, api, resend_api_key="re_route_key_123", email_from="hi@app.test")
    no_email = {"Authorization": f"Bearer {make_token(email=None)}"}

    response = client.post(
        "/api/v1/integrations/email/test", headers=no_email, json={"subject": "Hi", "html": "<p>x</p>"}
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "NO_EMAIL_ADDRESS"
    assert api.requests == []


# --- Notifications -----------------------------------------------------------------------


def test_notifications_are_admin_only(
    client_factory: ClientFactory, alice: dict[str, str], make_token: TokenFactory
) -> None:
    api = MockApi(httpx.Response(204))
    client = make_client(client_factory, api, discord_webhook_url=DISCORD_URL)
    body = {"channel": "discord", "text": "Deployed!"}

    assert client.post("/api/v1/integrations/notifications", headers=alice, json=body).status_code == 403
    assert api.requests == []

    admin = {"Authorization": f"Bearer {make_token(app_metadata={'role': 'admin'})}"}
    response = client.post("/api/v1/integrations/notifications", headers=admin, json=body)
    assert response.status_code == 204
    assert str(api.last.url) == DISCORD_URL


def test_notification_route_cannot_target_arbitrary_urls(
    client_factory: ClientFactory, make_token: TokenFactory
) -> None:
    api = MockApi(httpx.Response(204))
    client = make_client(client_factory, api, discord_webhook_url=DISCORD_URL)
    admin = {"Authorization": f"Bearer {make_token(app_metadata={'role': 'admin'})}"}

    response = client.post(
        "/api/v1/integrations/notifications",
        headers=admin,
        json={"channel": "discord", "text": "x", "url": "http://169.254.169.254/"},
    )

    assert response.status_code == 422
    assert api.requests == []
