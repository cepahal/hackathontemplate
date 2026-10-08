from collections.abc import Callable

from fastapi.testclient import TestClient

from tests.conftest import FRONTEND, build_settings
from tests.fakes import ExplodingDB, InMemoryDB


def test_health_returns_ok_without_auth(client: TestClient) -> None:
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_accepts_head_for_uptime_monitors(client: TestClient) -> None:
    response = client.head("/api/v1/health")
    assert response.status_code == 200
    assert response.content == b""


def test_every_response_has_a_request_id(client: TestClient) -> None:
    generated = client.get("/api/v1/health").headers["X-Request-ID"]
    assert len(generated) == 32

    echoed = client.get("/api/v1/health", headers={"X-Request-ID": "trace-12345678"})
    assert echoed.headers["X-Request-ID"] == "trace-12345678"

    unsafe = client.get("/api/v1/health", headers={"X-Request-ID": "bad id\nwith newline"})
    assert unsafe.headers["X-Request-ID"] != "bad id\nwith newline"


def test_unknown_route_uses_error_shape(client: TestClient) -> None:
    response = client.get("/api/v1/does-not-exist")
    assert response.status_code == 404
    body = response.json()
    assert body["error"]["code"] == "NOT_FOUND"
    assert body["error"]["message"] == "Route not found"
    assert body["error"]["request_id"] == response.headers["X-Request-ID"]


def test_wrong_method_is_405(client: TestClient, alice: dict[str, str]) -> None:
    response = client.put("/api/v1/projects", headers=alice, json={})
    assert response.status_code == 405
    assert response.json()["error"]["code"] == "METHOD_NOT_ALLOWED"


def test_cors_allows_only_the_configured_frontend(client: TestClient) -> None:
    preflight = {"Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization"}

    allowed = client.options("/api/v1/projects", headers={"Origin": FRONTEND, **preflight})
    assert allowed.status_code == 200
    assert allowed.headers["access-control-allow-origin"] == FRONTEND
    assert "access-control-allow-credentials" not in allowed.headers

    denied = client.options("/api/v1/projects", headers={"Origin": "https://evil.example", **preflight})
    assert denied.status_code == 400
    assert "access-control-allow-origin" not in denied.headers

    simple = client.get("/api/v1/health", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in simple.headers


def test_error_responses_carry_cors_headers(client: TestClient) -> None:
    response = client.get("/api/v1/projects", headers={"Origin": FRONTEND})
    assert response.status_code == 401
    assert response.headers["access-control-allow-origin"] == FRONTEND


def test_unhandled_exception_becomes_json_500_without_leaking(
    client_factory: Callable[..., TestClient], alice: dict[str, str]
) -> None:
    client = client_factory(ExplodingDB())
    response = client.get("/api/v1/projects", headers={**alice, "Origin": FRONTEND})
    assert response.status_code == 500
    assert response.json()["error"]["code"] == "INTERNAL_ERROR"
    assert "boom" not in response.text
    assert response.headers["access-control-allow-origin"] == FRONTEND


def test_docs_are_disabled_in_production(client_factory: Callable[..., TestClient]) -> None:
    dev = client_factory(InMemoryDB())
    assert dev.get("/api/v1/openapi.json").status_code == 200

    prod = client_factory(InMemoryDB(), build_settings(environment="production"))
    assert prod.get("/api/v1/openapi.json").status_code == 404
    assert prod.get("/api/v1/docs").status_code == 404


def test_openapi_lists_every_endpoint(client: TestClient) -> None:
    paths = client.get("/api/v1/openapi.json").json()["paths"]
    assert set(paths) == {
        "/api/v1/health",
        "/api/v1/me",
        "/api/v1/projects",
        "/api/v1/projects/{project_id}",
        "/api/v1/projects/{project_id}/tasks",
        "/api/v1/tasks/{task_id}",
        "/api/v1/integrations/status",
        "/api/v1/integrations/github/repos/{owner}/{repo}",
        "/api/v1/integrations/github/search",
        "/api/v1/integrations/maps/geocode",
        "/api/v1/integrations/email/test",
        "/api/v1/integrations/notifications",
        "/api/v1/ai/providers",
        "/api/v1/ai/generate",
        "/api/v1/ai/structured",
        "/api/v1/ai/stream",
        "/api/v1/ai/analyze-image",
        "/api/v1/ai/analyze-file",
        "/api/v1/ai/history",
    }
    assert set(paths["/api/v1/projects/{project_id}"]) == {"get", "patch", "delete"}
    assert set(paths["/api/v1/tasks/{task_id}"]) == {"patch", "delete"}
