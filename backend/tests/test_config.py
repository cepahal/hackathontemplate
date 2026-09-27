import pytest
from pydantic import ValidationError
from pydantic_settings import SettingsError

from app.core.config import Settings


def test_settings_load_from_env_file(tmp_path):
    env_file = tmp_path / ".env"
    env_file.write_text(
        'APP_ENV=test\nCORS_ORIGINS=["https://frontend.example"]\n', encoding="utf-8"
    )
    settings = Settings(_env_file=env_file)
    assert settings.app_env == "test"
    assert settings.cors_origins == ["https://frontend.example"]


def test_real_environment_overrides_dotenv(tmp_path, monkeypatch):
    env_file = tmp_path / ".env"
    env_file.write_text("APP_ENV=development\n", encoding="utf-8")
    monkeypatch.setenv("APP_ENV", "production")
    assert Settings(_env_file=env_file).app_env == "production"


@pytest.mark.parametrize(
    "origin",
    [
        "*",
        "https://example.com/path",
        "https://user:password@example.com",
        "file:///local",
        "http://localhost:invalid",
        "http://localhost:70000",
        "https://*.example.com",
        "http://local host:3000",
    ],
)
def test_unsafe_or_malformed_origin_fails_at_startup(origin):
    with pytest.raises(ValidationError):
        Settings(_env_file=None, cors_origins=[origin])


def test_malformed_json_fails_at_startup(monkeypatch):
    monkeypatch.setenv("CORS_ORIGINS", "http://localhost:3000")
    with pytest.raises(SettingsError):
        Settings(_env_file=None)


def test_invalid_app_environment_is_rejected():
    with pytest.raises(ValidationError):
        Settings(_env_file=None, app_env="prodution")
