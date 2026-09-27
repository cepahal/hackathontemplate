import asyncio
import base64
import json
from uuid import UUID

import httpx
import pytest
from fastapi import Depends, FastAPI, HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.core.errors import register_exception_handlers
from app.modules.identity import dependencies as identity_dependencies
from app.modules.identity import router
from app.modules.identity.client import SupabaseGateway
from app.modules.identity.dependencies import (
    get_supabase_gateway,
    require_admin,
)
from app.modules.identity.settings import IdentitySettings

OWNER = "22222222-2222-4222-8222-222222222222"
OTHER = "33333333-3333-4333-8333-333333333333"
PROJECT = "44444444-4444-4444-8444-444444444444"
TOKEN = "user-access-token"
HEADERS = {"Authorization": f"Bearer {TOKEN}"}
PROJECT_ROW = {
    "id": PROJECT,
    "owner_id": OWNER,
    "name": "Research",
    "description": "A useful project",
    "created_at": "2026-09-27T18:00:00Z",
    "updated_at": "2026-09-27T18:00:00Z",
}


def identity_app() -> FastAPI:
    app = FastAPI()
    register_exception_handlers(app)
    app.include_router(router, prefix="/api/v1")
    return app


def mocked_client(handler, user=None, auth_status=200):
    requests = []
    app = identity_app()
    profile = user if user is not None else {"id": OWNER, "email": "owner@example.com"}

    def transport(request):
        requests.append(request)
        assert request.headers["apikey"] == "public-test-key"
        assert request.headers["authorization"] == f"Bearer {TOKEN}"
        if request.url.path == "/auth/v1/user":
            return httpx.Response(auth_status, json=profile)
        return handler(request)

    async def gateway():
        settings = IdentitySettings(
            _env_file=None,
            supabase_url="https://example.supabase.co",
            supabase_anon_key="public-test-key",
        )
        async with httpx.AsyncClient(transport=httpx.MockTransport(transport)) as outgoing:
            yield SupabaseGateway(settings, outgoing, TOKEN)

    app.dependency_overrides[get_supabase_gateway] = gateway
    return TestClient(app), requests, app


def test_missing_token_is_401():
    with TestClient(identity_app()) as client:
        response = client.get("/api/v1/auth/me")
    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


def test_missing_config_is_503(monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_ANON_KEY", raising=False)
    app = identity_app()

    monkeypatch.setattr(
        identity_dependencies, "IdentitySettings", lambda: IdentitySettings(_env_file=None)
    )
    with TestClient(app) as client:
        response = client.get("/api/v1/auth/me", headers=HEADERS)
    assert response.status_code == 503


def test_rejected_auth_token_never_reaches_database():
    client, requests, _ = mocked_client(
        lambda request: httpx.Response(200, json=[]), auth_status=401
    )
    with client:
        response = client.get("/api/v1/projects", headers=HEADERS)
    assert response.status_code == 401
    assert len(requests) == 1
    assert requests[0].url.path == "/auth/v1/user"


def test_client_user_metadata_cannot_grant_admin():
    client, requests, _ = mocked_client(
        lambda request: httpx.Response(200, json=[]),
        user={"id": OWNER, "user_metadata": {"role": "admin"}},
    )
    with client:
        response = client.get("/api/v1/auth/me", headers=HEADERS)
    assert response.status_code == 200
    assert response.json()["role"] == "user"
    assert len(requests) == 1
    assert requests[0].url.path == "/auth/v1/user"


def test_only_validated_app_metadata_grants_admin():
    client, _, app = mocked_client(
        lambda request: httpx.Response(200, json=[]),
        user={"id": OWNER, "app_metadata": {"role": "admin"}},
    )
    app.add_api_route("/admin", lambda: {"ok": True}, dependencies=[Depends(require_admin)])
    with client:
        assert client.get("/api/v1/auth/me", headers=HEADERS).json()["role"] == "admin"
        assert client.get("/admin", headers=HEADERS).status_code == 200


def test_normal_user_cannot_access_admin_dependency():
    client, _, app = mocked_client(lambda request: httpx.Response(200, json=[]))
    app.add_api_route("/admin", lambda: {"ok": True}, dependencies=[Depends(require_admin)])
    with client:
        assert client.get("/admin", headers=HEADERS).status_code == 403


def test_invalid_upstream_identity_is_redacted():
    client, _, _ = mocked_client(
        lambda request: httpx.Response(200, json=[]), user={"id": "private-invalid-id"}
    )
    with client:
        response = client.get("/api/v1/auth/me", headers=HEADERS)
    assert response.status_code == 502
    assert "private-invalid-id" not in response.text


def test_projects_list_preserves_rls_shared_access_and_pagination():
    client, requests, _ = mocked_client(lambda request: httpx.Response(200, json=[PROJECT_ROW]))
    with client:
        response = client.get("/api/v1/projects?limit=5&offset=10", headers=HEADERS)
    assert response.status_code == 200
    assert response.json()["items"][0]["id"] == PROJECT
    assert response.json()["limit"] == 5
    assert response.json()["offset"] == 10
    outgoing = requests[-1]
    assert "owner_id" not in outgoing.url.params  # RLS includes owners and shared members.
    assert outgoing.url.params["limit"] == "5"


def test_create_uses_validated_identity_as_owner():
    client, requests, _ = mocked_client(lambda request: httpx.Response(201, json=[PROJECT_ROW]))
    with client:
        response = client.post(
            "/api/v1/projects", headers=HEADERS, json={"name": " Research ", "description": "test"}
        )
    assert response.status_code == 201
    body = json.loads(requests[-1].content)
    assert body["owner_id"] == OWNER
    assert body["name"] == "Research"
    assert requests[-1].headers["prefer"] == "return=representation"


@pytest.mark.parametrize(
    "method,path,body",
    [
        ("POST", "/api/v1/projects", {"name": "Research", "owner_id": OTHER}),
        ("PATCH", f"/api/v1/projects/{PROJECT}", {"owner_id": OTHER}),
        ("PATCH", f"/api/v1/projects/{PROJECT}", {}),
        ("PATCH", f"/api/v1/projects/{PROJECT}", {"name": None}),
        ("POST", "/api/v1/projects", {"name": "   "}),
    ],
)
def test_invalid_mutations_never_reach_database(method, path, body):
    client, requests, _ = mocked_client(lambda request: httpx.Response(200, json=[]))
    with client:
        response = client.request(method, path, headers=HEADERS, json=body)
    assert response.status_code == 422
    assert all(request.url.path == "/auth/v1/user" for request in requests)


def test_patch_only_sends_requested_changes_and_preserves_editor_access():
    row = {**PROJECT_ROW, "description": ""}
    client, requests, _ = mocked_client(lambda request: httpx.Response(200, json=[row]))
    with client:
        response = client.patch(
            f"/api/v1/projects/{PROJECT}", headers=HEADERS, json={"description": ""}
        )
    assert response.status_code == 200
    assert json.loads(requests[-1].content) == {"description": ""}
    assert "owner_id" not in requests[-1].url.params  # Editors are authorized by database RLS.
    assert requests[-1].url.params["id"] == f"eq.{PROJECT}"


@pytest.mark.parametrize("method", ["GET", "PATCH", "DELETE"])
def test_hidden_or_missing_projects_return_404(method):
    client, _, _ = mocked_client(lambda request: httpx.Response(200, json=[]))
    with client:
        kwargs = {"json": {"name": "Changed"}} if method == "PATCH" else {}
        response = client.request(method, f"/api/v1/projects/{PROJECT}", headers=HEADERS, **kwargs)
    assert response.status_code == 404


def test_delete_returns_204_without_body():
    client, requests, _ = mocked_client(lambda request: httpx.Response(200, json=[PROJECT_ROW]))
    with client:
        response = client.delete(f"/api/v1/projects/{PROJECT}", headers=HEADERS)
    assert response.status_code == 204
    assert response.content == b""
    assert requests[-1].url.params["owner_id"] == f"eq.{OWNER}"


def test_path_and_pagination_are_validated():
    client, _, _ = mocked_client(lambda request: httpx.Response(200, json=[]))
    with client:
        assert client.get("/api/v1/projects/not-a-uuid", headers=HEADERS).status_code == 422
        assert client.get("/api/v1/projects?limit=101", headers=HEADERS).status_code == 422


@pytest.mark.parametrize("upstream,expected", [(401, 401), (403, 403), (429, 429), (500, 502)])
def test_upstream_errors_are_sanitized(upstream, expected):
    client, _, _ = mocked_client(
        lambda request: httpx.Response(upstream, json={"message": "private database detail"})
    )
    with client:
        response = client.get("/api/v1/projects", headers=HEADERS)
    assert response.status_code == expected
    assert "private database detail" not in response.text


def test_network_timeout_has_distinct_gateway_status():
    def timeout(request):
        raise httpx.ReadTimeout("private network detail", request=request)

    async def run():
        settings = IdentitySettings(
            _env_file=None, supabase_url="https://example.supabase.co", supabase_anon_key="test"
        )
        async with httpx.AsyncClient(transport=httpx.MockTransport(timeout)) as outgoing:
            gateway = SupabaseGateway(settings, outgoing, TOKEN)
            with pytest.raises(HTTPException) as caught:
                await gateway.request("GET", "/auth/v1/user")
        assert caught.value.status_code == 504
        assert "private network detail" not in caught.value.detail

    asyncio.run(run())


def test_supabase_configuration_rejects_secret_keys_and_unsafe_urls():
    encoded = base64.urlsafe_b64encode(json.dumps({"role": "service_role"}).encode()).decode()
    for key in ("sb_secret_private", f"header.{encoded}.signature"):
        with pytest.raises(ValidationError):
            IdentitySettings(_env_file=None, supabase_anon_key=key)
    for url in (
        "http://supabase.example",
        "https://user:pass@example.com",
        "https://example.com/a",
    ):
        with pytest.raises(ValidationError):
            IdentitySettings(_env_file=None, supabase_url=url)
    assert UUID(OWNER)


MEMBER_ROW = {
    "project_id": PROJECT,
    "user_id": OTHER,
    "role": "editor",
    "created_at": "2026-09-27T18:00:00Z",
}


def test_project_owner_can_add_existing_account_as_member():
    def handler(request):
        if request.url.path == "/rest/v1/projects":
            return httpx.Response(200, json=[PROJECT_ROW])
        return httpx.Response(201, json=[MEMBER_ROW])

    client, requests, _ = mocked_client(handler)
    with client:
        response = client.post(
            f"/api/v1/projects/{PROJECT}/members",
            headers=HEADERS,
            json={"user_id": OTHER, "role": "editor"},
        )
    assert response.status_code == 201
    assert response.json()["role"] == "editor"
    assert json.loads(requests[-1].content) == {
        "project_id": PROJECT,
        "user_id": OTHER,
        "role": "editor",
    }


@pytest.mark.parametrize(
    "method,path,kwargs",
    [
        ("GET", f"/api/v1/projects/{PROJECT}/members", {}),
        (
            "POST",
            f"/api/v1/projects/{PROJECT}/members",
            {"json": {"user_id": OWNER, "role": "editor"}},
        ),
        ("DELETE", f"/api/v1/projects/{PROJECT}/members/{OWNER}", {}),
    ],
)
def test_shared_member_cannot_manage_membership(method, path, kwargs):
    client, requests, _ = mocked_client(
        lambda request: httpx.Response(200, json=[PROJECT_ROW]), user={"id": OTHER}
    )
    with client:
        response = client.request(method, path, headers=HEADERS, **kwargs)
    assert response.status_code == 403
    assert all(request.url.path != "/rest/v1/project_members" for request in requests)


def test_owner_membership_listing_and_removal():
    def handler(request):
        rows = [PROJECT_ROW] if request.url.path == "/rest/v1/projects" else [MEMBER_ROW]
        return httpx.Response(200, json=rows)

    client, requests, _ = mocked_client(handler)
    with client:
        listed = client.get(f"/api/v1/projects/{PROJECT}/members", headers=HEADERS)
        deleted = client.delete(f"/api/v1/projects/{PROJECT}/members/{OTHER}", headers=HEADERS)
    assert listed.status_code == 200
    assert listed.json()["items"][0]["user_id"] == OTHER
    assert deleted.status_code == 204
    assert requests[-1].url.params["project_id"] == f"eq.{PROJECT}"
    assert requests[-1].url.params["user_id"] == f"eq.{OTHER}"


def test_cannot_invite_an_administrator_role():
    client, _, _ = mocked_client(lambda request: httpx.Response(200, json=[PROJECT_ROW]))
    with client:
        response = client.post(
            f"/api/v1/projects/{PROJECT}/members",
            headers=HEADERS,
            json={"user_id": OTHER, "role": "admin"},
        )
    assert response.status_code == 422


NOTIFICATION_ROW = {
    "id": PROJECT,
    "owner_id": OWNER,
    "title": "Project created",
    "message": "Ready",
    "data": {"project_id": PROJECT},
    "read_at": None,
    "created_at": "2026-09-27T18:00:00Z",
}


def test_notifications_are_owner_scoped_and_can_be_marked_read():
    def handler(request):
        row = dict(NOTIFICATION_ROW)
        if request.method == "PATCH":
            row.update(json.loads(request.content))
        return httpx.Response(200, json=[row])

    client, requests, _ = mocked_client(handler)
    with client:
        listed = client.get("/api/v1/notifications", headers=HEADERS)
        marked = client.patch(
            f"/api/v1/notifications/{PROJECT}", headers=HEADERS, json={"read": True}
        )
    assert listed.status_code == 200
    assert listed.json()["items"][0]["read_at"] is None
    assert marked.status_code == 200
    assert marked.json()["read_at"] is not None
    assert requests[-1].url.params["owner_id"] == f"eq.{OWNER}"
    assert set(json.loads(requests[-1].content)) == {"read_at"}


def test_notification_content_cannot_be_changed_through_api():
    client, _, _ = mocked_client(lambda request: httpx.Response(200, json=[NOTIFICATION_ROW]))
    with client:
        response = client.patch(
            f"/api/v1/notifications/{PROJECT}",
            headers=HEADERS,
            json={"read": True, "title": "Forged notice"},
        )
    assert response.status_code == 422
