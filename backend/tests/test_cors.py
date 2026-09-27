import pytest


@pytest.mark.parametrize("origin", ["http://localhost:3000", "http://127.0.0.1:3000"])
def test_frontend_origin_can_read_health(client, origin):
    response = client.get("/health", headers={"Origin": origin})
    assert response.headers["Access-Control-Allow-Origin"] == origin
    assert "X-Request-ID" in response.headers["Access-Control-Expose-Headers"]


def test_allowed_preflight(client):
    response = client.options(
        "/health",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "Content-Type",
        },
    )
    assert response.status_code == 200
    assert response.headers["Access-Control-Allow-Origin"] == "http://localhost:3000"


def test_unlisted_origin_receives_no_permission_header(client):
    response = client.get("/health", headers={"Origin": "https://unlisted.example"})
    assert "Access-Control-Allow-Origin" not in response.headers


def test_unlisted_preflight_is_denied(client):
    response = client.options(
        "/health",
        headers={
            "Origin": "https://unlisted.example",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code == 400
    assert "Access-Control-Allow-Origin" not in response.headers
