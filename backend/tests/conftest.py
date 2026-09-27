import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app


@pytest.fixture(autouse=True)
def isolate_process_settings(monkeypatch):
    for key in ("APP_ENV", "LOG_LEVEL", "CORS_ORIGINS"):
        monkeypatch.delenv(key, raising=False)


@pytest.fixture
def client():
    settings = Settings(_env_file=None, app_env="test")
    with TestClient(create_app(settings)) as test_client:
        yield test_client
