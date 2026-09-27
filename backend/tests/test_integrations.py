import asyncio
from types import SimpleNamespace
from uuid import UUID

import httpx
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.main import create_app
from app.modules.identity.dependencies import get_current_user
from app.modules.identity.schemas import AuthenticatedUser
from app.modules.integrations import client as transport
from app.modules.integrations import oauth, routes
from app.modules.integrations.settings import IntegrationSettings

USER_ID = UUID("10000000-0000-0000-0000-000000000001")


def api_for(role="admin"):
    app = create_app()
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(
        id=USER_ID, email="test@example.com", role=role
    )
    return TestClient(app)


def test_shared_credentials_require_admin():
    with api_for("user") as api:
        result = api.post(
            "/api/v1/integrations/slack/execute",
            json={
                "operation": "send_message",
                "confirm": True,
                "params": {"channel": "C123", "text": "test"},
            },
        )
    assert result.status_code == 403


def test_write_requires_explicit_confirmation():
    with api_for() as api:
        result = api.post(
            "/api/v1/integrations/slack/execute",
            json={
                "operation": "send_message",
                "params": {"channel": "C123", "text": "test"},
            },
        )
    assert result.status_code == 409


def test_unknown_provider_cannot_be_used_as_url():
    with api_for() as api:
        response = api.post(
            "/api/v1/integrations/evil/execute",
            json={
                "operation": "fetch",
                "params": {"url": "http://169.254.169.254"},
            },
        )
    assert response.status_code == 400


def test_malformed_provider_success_is_reported_as_gateway_error(monkeypatch):
    transport._cache.clear()
    monkeypatch.setattr(
        routes,
        "IntegrationSettings",
        lambda: IntegrationSettings(_env_file=None, discord_bot_token="test-token"),
    )

    async def malformed(*_args, **_kwargs):
        return [], {}

    monkeypatch.setattr(routes, "provider_request", malformed)
    with api_for() as api:
        response = api.post(
            "/api/v1/integrations/discord/execute",
            json={
                "operation": "send_message",
                "params": {"channel": "1234", "text": "Test"},
                "confirm": True,
            },
        )
    assert response.status_code == 502


def test_malformed_github_response_is_not_cached(monkeypatch):
    transport._cache.clear()

    async def malformed(*_args, **_kwargs):
        return {"private": "internal detail"}, {}

    monkeypatch.setattr(routes, "provider_request", malformed)
    with api_for("user") as api:
        response = api.get("/api/v1/integrations/github/repos?username=octocat")
    assert response.status_code == 502
    assert "internal detail" not in response.text
    assert not transport._cache


def test_github_response_is_normalized_and_paginated(monkeypatch):
    transport._cache.clear()

    async def request(method, url, **kwargs):
        assert method == "GET"
        assert url == "https://api.github.com/users/octocat/repos"
        assert kwargs["params"]["page"] == 2
        return (
            [
                {
                    "id": 1,
                    "name": "example",
                    "html_url": "https://github.com/octocat/example",
                    "description": "Public test",
                }
            ],
            {"Link": '<next>; rel="next"'},
        )

    monkeypatch.setattr(routes, "provider_request", request)
    with api_for("user") as api:
        response = api.get("/api/v1/integrations/github/repos?username=octocat&page=2")
    assert response.status_code == 200
    assert response.json()["next_page"] == 3
    assert response.json()["items"][0]["url"] == "https://github.com/octocat/example"
    transport._cache.clear()


@pytest.mark.parametrize(
    "provider,operation,params,provider_response,expected",
    [
        (
            "google_maps",
            "geocode",
            {"address": "Test address"},
            {
                "status": "OK",
                "results": [
                    {"formatted_address": "Test", "geometry": {"location": {"lat": 1, "lng": 2}}}
                ],
            },
            "items",
        ),
        (
            "slack",
            "send_message",
            {"channel": "C123", "text": "Test"},
            {"ok": True, "ts": "123", "channel": "C123"},
            "id",
        ),
        (
            "discord",
            "send_message",
            {"channel": "1234", "text": "Test"},
            {"id": "10", "channel_id": "1234"},
            "id",
        ),
        (
            "twilio",
            "send_sms",
            {"to": "+15555550100", "text": "Test"},
            {"sid": "SMtest", "status": "queued"},
            "id",
        ),
        (
            "youtube",
            "search",
            {"query": "Test"},
            {"items": [{"id": {"videoId": "abc"}, "snippet": {"title": "Test"}}]},
            "items",
        ),
    ],
)
def test_provider_adapters_use_fixed_https_origins(
    monkeypatch, provider, operation, params, provider_response, expected
):
    settings = IntegrationSettings(
        _env_file=None,
        google_maps_api_key="test",
        slack_bot_token="test",
        discord_bot_token="test",
        twilio_account_sid="AC" + "0" * 32,
        twilio_auth_token="test",
        twilio_from_number="+15555550101",
        youtube_api_key="test",
    )
    monkeypatch.setattr(routes, "IntegrationSettings", lambda: settings)

    async def request(method, url, **kwargs):
        assert url.startswith("https://")
        assert "169.254" not in url
        return provider_response, {}

    monkeypatch.setattr(routes, "provider_request", request)
    transport._cache.clear()
    with api_for() as api:
        response = api.post(
            f"/api/v1/integrations/{provider}/execute",
            json={
                "operation": operation,
                "params": params,
                "confirm": True,
            },
        )
    assert response.status_code == 200
    assert expected in response.json()
    transport._cache.clear()


def test_read_retries_are_bounded(monkeypatch):
    attempts = []

    def respond(request):
        attempts.append(request)
        return httpx.Response(
            503 if len(attempts) < 3 else 200, json={"ok": True}, headers={"Retry-After": "0"}
        )

    original_client = httpx.AsyncClient
    monkeypatch.setattr(
        transport,
        "httpx",
        SimpleNamespace(
            HTTPError=httpx.HTTPError,
            AsyncClient=lambda **kwargs: original_client(
                transport=httpx.MockTransport(respond), **kwargs
            ),
        ),
    )
    result, _ = asyncio.run(transport.provider_request("GET", "https://provider.example/data"))
    assert result == {"ok": True}
    assert len(attempts) == 3


def test_non_idempotent_post_is_not_retried(monkeypatch):
    attempts = []

    def respond(request):
        attempts.append(request)
        return httpx.Response(503, json={"error": "no"})

    original_client = httpx.AsyncClient
    monkeypatch.setattr(
        transport,
        "httpx",
        SimpleNamespace(
            HTTPError=httpx.HTTPError,
            AsyncClient=lambda **kwargs: original_client(
                transport=httpx.MockTransport(respond), **kwargs
            ),
        ),
    )
    with pytest.raises(HTTPException) as failure:
        asyncio.run(transport.provider_request("POST", "https://provider.example/send"))
    assert failure.value.status_code == 502
    assert len(attempts) == 1


def test_oauth_state_bound_to_user_provider_and_signature():
    secret = "x" * 40
    state = oauth.issue_state("alice", "github", secret)
    assert oauth.verify_state(state, "alice", "github", secret)["user_id"] == "alice"
    for user, provider, token in [
        ("bob", "github", state),
        ("alice", "slack", state),
        ("alice", "github", state + "x"),
    ]:
        with pytest.raises(ValueError):
            oauth.verify_state(token, user, provider, secret)


def test_oversized_request_is_rejected_without_parsing():
    with api_for() as api:
        response = api.post(
            "/api/v1/ai/chat",
            content=b"x" * 6_000_001,
            headers={"Content-Type": "application/json"},
        )
    assert response.status_code == 413
