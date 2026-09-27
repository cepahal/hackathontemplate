from uuid import UUID


def test_health_contract(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "hackathon-api",
        "environment": "test",
        "version": "0.1.0",
    }
    assert UUID(response.headers["X-Request-ID"]).version == 4


def test_docs_and_openapi_are_available(client):
    assert client.get("/docs").status_code == 200
    schema = client.get("/openapi.json").json()
    assert "/health" in schema["paths"]
    assert "/api/v1/examples" not in schema["paths"]


def test_unknown_route_uses_error_envelope(client):
    response = client.get("/missing")
    assert response.status_code == 404
    error = response.json()["error"]
    assert error["code"] == "http_404"
    assert error["request_id"] == response.headers["X-Request-ID"]


def test_unsupported_method_preserves_allow_header(client):
    response = client.post("/health")
    assert response.status_code == 405
    assert "GET" in response.headers["allow"]
