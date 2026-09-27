from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel, Field

from app.core.config import Settings
from app.main import create_app


class ExamplePayload(BaseModel):
    count: int = Field(ge=1)


def error_test_app() -> FastAPI:
    app = create_app(Settings(_env_file=None, app_env="test"))

    @app.post("/test-validation")
    async def validate(payload: ExamplePayload):
        return payload

    @app.get("/test-failure")
    async def fail():
        raise RuntimeError("private connection detail")

    return app


def test_validation_error_does_not_echo_input():
    with TestClient(error_test_app()) as client:
        response = client.post("/test-validation", json={"count": "private-input"})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"
    assert "private-input" not in response.text
    assert response.json()["error"]["details"][0]["location"] == ["body", "count"]


def test_unexpected_error_is_redacted_and_has_cors_headers():
    with TestClient(error_test_app()) as client:
        response = client.get("/test-failure", headers={"Origin": "http://localhost:3000"})
    assert response.status_code == 500
    assert response.json()["error"]["code"] == "internal_error"
    assert "private connection detail" not in response.text
    assert response.headers["Access-Control-Allow-Origin"] == "http://localhost:3000"
    assert response.json()["error"]["request_id"] == response.headers["X-Request-ID"]
