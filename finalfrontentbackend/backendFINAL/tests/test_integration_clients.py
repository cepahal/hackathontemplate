"""GitHub, maps, email and notification adapters plus the registry. All HTTP is mocked."""

import httpx
import pytest
from pydantic import SecretStr

from app.core.errors import NotFoundError
from app.integrations.email.client import EmailClient, ResendEmailProvider
from app.integrations.errors import (
    IntegrationAuthError,
    IntegrationNotConfiguredError,
    IntegrationRateLimitedError,
    IntegrationRequestError,
    IntegrationUnavailableError,
)
from app.integrations.github.client import GitHubClient
from app.integrations.maps.client import GoogleGeocoder, MapboxGeocoder, MapsClient
from app.integrations.notifications.client import NotificationClient
from app.integrations.registry import Integrations
from tests.conftest import build_settings
from tests.mock_api import MockApi

pytestmark = pytest.mark.usefixtures("instant_retries")

TOKEN = SecretStr("ghp_testtoken1234567890")
SLACK_URL = "https://hooks.slack.com/services/T000/B000/secretpart"
DISCORD_URL = "https://discord.com/api/webhooks/123/secretpart"


def repo_json(name: str = "fastapi", *, private: bool = False) -> dict[str, object]:
    return {
        "id": 1,
        "name": name,
        "full_name": f"fastapi/{name}",
        "owner": {"login": "fastapi", "html_url": "https://github.com/fastapi"},
        "private": private,
        "html_url": f"https://github.com/fastapi/{name}",
        "description": "FastAPI framework",
        "language": "Python",
        "topics": ["python", "api"],
        "stargazers_count": 100,
        "forks_count": 10,
        "open_issues_count": 5,
        "default_branch": "main",
        "archived": False,
        "updated_at": "2026-10-01T12:00:00Z",
        "node_id": "ignored-extra-field",
    }


# --- GitHub ------------------------------------------------------------------------------


async def test_github_get_repository() -> None:
    api = MockApi(httpx.Response(200, json=repo_json()))
    repo = await GitHubClient(api.client(), TOKEN).get_repository("fastapi", "fastapi")

    assert repo.full_name == "fastapi/fastapi"
    assert repo.stargazers_count == 100
    assert str(api.last.url) == "https://api.github.com/repos/fastapi/fastapi"
    assert api.last.headers["Authorization"] == f"Bearer {TOKEN.get_secret_value()}"
    assert api.last.headers["Accept"] == "application/vnd.github+json"
    assert api.last.headers["X-GitHub-Api-Version"] == "2022-11-28"


async def test_github_repository_not_found_is_a_404() -> None:
    api = MockApi(httpx.Response(404, json={"message": "Not Found"}))
    with pytest.raises(NotFoundError) as exc_info:
        await GitHubClient(api.client(), TOKEN).get_repository("fastapi", "missing")
    assert exc_info.value.code == "GITHUB_REPOSITORY_NOT_FOUND"


async def test_github_rate_limit_is_detected_from_403() -> None:
    api = MockApi(httpx.Response(403, headers={"x-ratelimit-remaining": "0"}, json={"message": "rate limit"}))
    with pytest.raises(IntegrationRateLimitedError):
        await GitHubClient(api.client(), TOKEN).get_repository("fastapi", "fastapi")


@pytest.mark.parametrize(("owner", "repo"), [("../x", "y"), ("a", "b/c"), ("a", ".."), ("-bad", "r"), ("a", "r?x=1")])
async def test_github_rejects_path_injection(owner: str, repo: str) -> None:
    api = MockApi()
    with pytest.raises(ValueError, match="invalid GitHub"):
        await GitHubClient(api.client(), TOKEN).get_repository(owner, repo)
    assert api.requests == []


async def test_github_search_repositories() -> None:
    api = MockApi(
        httpx.Response(
            200, json={"total_count": 2, "incomplete_results": False, "items": [repo_json(), repo_json("typer")]}
        )
    )
    result = await GitHubClient(api.client(), TOKEN).search_repositories(" fastapi ", sort="stars", per_page=5)

    assert [r.name for r in result.items] == ["fastapi", "typer"]
    params = api.last.url.params
    assert params["q"] == "fastapi"
    assert params["sort"] == "stars"
    assert params["per_page"] == "5"
    assert api.last.url.path == "/search/repositories"


async def test_github_search_without_sort_omits_the_param() -> None:
    api = MockApi(httpx.Response(200, json={"total_count": 0, "incomplete_results": False, "items": []}))
    await GitHubClient(api.client(), TOKEN).search_repositories("x")
    assert "sort" not in api.last.url.params


async def test_github_works_without_token_flag() -> None:
    client = GitHubClient(MockApi().client(), None)
    assert client.configured is False
    with pytest.raises(IntegrationNotConfiguredError, match="GITHUB_TOKEN"):
        await client.search_repositories("x")


# --- Maps --------------------------------------------------------------------------------


async def test_mapbox_geocode() -> None:
    feature = {
        "geometry": {"coordinates": [2.3522, 48.8566]},
        "properties": {"name": "Paris", "full_address": "Paris, France", "feature_type": "place"},
    }
    api = MockApi(httpx.Response(200, json={"features": [feature]}))
    results = await MapsClient(MapboxGeocoder(api.client(), SecretStr("pk.test123456789"))).geocode(" Paris ", limit=3)

    assert len(results) == 1
    assert (results[0].name, results[0].latitude, results[0].longitude, results[0].kind) == (
        "Paris, France",
        48.8566,
        2.3522,
        "place",
    )
    assert api.last.url.path == "/search/geocode/v6/forward"
    assert dict(api.last.url.params) == {"q": "Paris", "limit": "3", "access_token": "pk.test123456789"}
    assert "Authorization" not in api.last.headers


async def test_google_geocode() -> None:
    result = {
        "formatted_address": "Paris, France",
        "geometry": {"location": {"lat": 48.85, "lng": 2.35}},
        "types": ["locality", "political"],
    }
    api = MockApi(httpx.Response(200, json={"status": "OK", "results": [result, result]}))
    results = await MapsClient(GoogleGeocoder(api.client(), SecretStr("AIza-test"))).geocode("Paris", limit=1)

    assert len(results) == 1
    assert results[0].kind == "locality"
    assert api.last.url.params["key"] == "AIza-test"
    assert api.last.url.params["address"] == "Paris"


@pytest.mark.parametrize(
    ("status", "error_type"),
    [
        ("REQUEST_DENIED", IntegrationAuthError),
        ("OVER_QUERY_LIMIT", IntegrationRateLimitedError),
        ("INVALID_REQUEST", IntegrationRequestError),
    ],
)
async def test_google_geocode_status_errors(status: str, error_type: type[Exception]) -> None:
    api = MockApi(httpx.Response(200, json={"status": status, "results": []}))
    with pytest.raises(error_type):
        await GoogleGeocoder(api.client(), SecretStr("k")).geocode("x", limit=1)


async def test_google_zero_results_is_empty_list() -> None:
    api = MockApi(httpx.Response(200, json={"status": "ZERO_RESULTS", "results": []}))
    assert await GoogleGeocoder(api.client(), SecretStr("k")).geocode("nowhere", limit=1) == []


async def test_maps_input_validation_and_missing_key() -> None:
    maps = MapsClient(MapboxGeocoder(MockApi().client(), None))
    with pytest.raises(ValueError):
        await maps.geocode("   ")
    with pytest.raises(ValueError):
        await maps.geocode("Paris", limit=50)
    with pytest.raises(IntegrationNotConfiguredError, match="MAPS_API_KEY"):
        await maps.geocode("Paris")


# --- Email -------------------------------------------------------------------------------


async def test_resend_send_email() -> None:
    api = MockApi(httpx.Response(200, json={"id": "email_123"}))
    email = EmailClient(
        ResendEmailProvider(api.client(), SecretStr("re_test123456789")), default_sender="App <hi@app.test>"
    )

    result = await email.send_email("ada@example.com", "Welcome", "<p>Hi</p>", text="Hi", idempotency_key="k-1")

    assert (result.id, result.provider) == ("email_123", "resend")
    assert str(api.last.url) == "https://api.resend.com/emails"
    assert api.last.headers["Authorization"] == "Bearer re_test123456789"
    assert api.last.headers["Idempotency-Key"] == "k-1"
    assert api.body() == {
        "from": "App <hi@app.test>",
        "to": ["ada@example.com"],
        "subject": "Welcome",
        "html": "<p>Hi</p>",
        "text": "Hi",
    }


async def test_email_without_idempotency_key_is_never_retried() -> None:
    api = MockApi(httpx.Response(503), httpx.Response(200, json={"id": "dup"}))
    email = EmailClient(ResendEmailProvider(api.client(), SecretStr("re_k")), default_sender="hi@app.test")
    with pytest.raises(IntegrationUnavailableError):
        await email.send_email("a@example.com", "s", "<p>x</p>")
    assert len(api.requests) == 1


async def test_email_with_idempotency_key_is_retried() -> None:
    api = MockApi(httpx.Response(503), httpx.Response(200, json={"id": "once"}))
    email = EmailClient(ResendEmailProvider(api.client(), SecretStr("re_k")), default_sender="hi@app.test")
    assert (await email.send_email("a@example.com", "s", "<p>x</p>", idempotency_key="k")).id == "once"
    assert len(api.requests) == 2
    assert api.requests[0].headers["Idempotency-Key"] == api.requests[1].headers["Idempotency-Key"] == "k"


async def test_email_rejects_header_injection_and_bad_recipients() -> None:
    api = MockApi()
    email = EmailClient(ResendEmailProvider(api.client(), SecretStr("re_k")), default_sender="hi@app.test")
    with pytest.raises(ValueError, match="single line"):
        await email.send_email("a@example.com", "Hi\r\nBcc: victim@example.com", "<p>x</p>")
    with pytest.raises(ValueError, match="invalid email"):
        await email.send_email("not-an-email", "Hi", "<p>x</p>")
    assert api.requests == []


async def test_email_missing_configuration() -> None:
    no_key = EmailClient(ResendEmailProvider(MockApi().client(), None), default_sender="hi@app.test")
    with pytest.raises(IntegrationNotConfiguredError, match="RESEND_API_KEY"):
        await no_key.send_email("a@example.com", "s", "<p>x</p>")

    no_sender = EmailClient(ResendEmailProvider(MockApi().client(), SecretStr("re_k")), default_sender=None)
    assert no_sender.configured is False
    with pytest.raises(IntegrationNotConfiguredError, match="EMAIL_FROM"):
        await no_sender.send_email("a@example.com", "s", "<p>x</p>")


# --- Notifications -----------------------------------------------------------------------


async def test_slack_escapes_mentions_and_links() -> None:
    api = MockApi(httpx.Response(200, text="ok"))
    client = NotificationClient(api.client(), slack_webhook_url=SecretStr(SLACK_URL), discord_webhook_url=None)

    await client.send("slack", "<!channel> deploy & <https://evil.test|click>")

    assert str(api.last.url) == SLACK_URL
    assert api.body() == {"text": "&lt;!channel&gt; deploy &amp; &lt;https://evil.test|click&gt;"}


async def test_discord_disables_mentions() -> None:
    api = MockApi(httpx.Response(204))
    client = NotificationClient(api.client(), slack_webhook_url=None, discord_webhook_url=SecretStr(DISCORD_URL))

    await client.send("discord", "@everyone hello")

    assert str(api.last.url) == DISCORD_URL
    assert api.body() == {"content": "@everyone hello", "allowed_mentions": {"parse": []}}


async def test_unconfigured_notification_channel() -> None:
    client = NotificationClient(MockApi().client(), slack_webhook_url=None, discord_webhook_url=None)
    assert client.configured("slack") is False
    with pytest.raises(IntegrationNotConfiguredError, match="DISCORD_WEBHOOK_URL"):
        await client.send("discord", "hi")


# --- Registry ----------------------------------------------------------------------------


def test_status_reports_configuration_without_secrets() -> None:
    settings = build_settings(
        openai_api_key="sk-test-123",
        github_token="ghp_x",
        resend_api_key="re_x",
        email_from="hi@app.test",
        slack_webhook_url=SLACK_URL,
    )
    api = MockApi()
    status = Integrations(settings, api.client()).status()

    assert status == {
        "openai": True,
        "gemini": False,
        "anthropic": False,
        "grok": False,
        "github": True,
        "maps": False,
        "email": True,
        "slack": True,
        "discord": False,
    }
    assert api.requests == []


def test_registry_picks_maps_provider_and_ai_clients() -> None:
    integrations = Integrations(build_settings(maps_provider="google"), MockApi().client())
    assert isinstance(integrations.maps._geocoder, GoogleGeocoder)
    assert integrations.ai("anthropic") is integrations.anthropic
    assert integrations.openai.default_model == "gpt-4.1-mini"
