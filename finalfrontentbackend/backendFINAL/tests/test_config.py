import base64
import json

import pytest
from pydantic import ValidationError
from pydantic_settings import SettingsConfigDict

from app.core import config
from tests.conftest import build_settings


def legacy_key(role: str) -> str:
    def part(data: dict[str, str]) -> str:
        return base64.urlsafe_b64encode(json.dumps(data).encode()).rstrip(b"=").decode()

    return f"{part({'alg': 'HS256'})}.{part({'role': role, 'iss': 'supabase'})}.signature"


def test_valid_settings_derive_urls() -> None:
    settings = build_settings(
        supabase_url="https://abc.supabase.co/", cors_origins="https://a.example, https://b.example/"
    )
    assert settings.rest_url == "https://abc.supabase.co/rest/v1"
    assert settings.jwks_url == "https://abc.supabase.co/auth/v1/.well-known/jwks.json"
    assert settings.allowed_origins == ["http://localhost:3000", "https://a.example", "https://b.example"]


@pytest.mark.parametrize("origin", ["*", "https://*.example.com", "localhost:3000", "https://app.example/path"])
def test_rejects_wildcard_or_malformed_origins(origin: str) -> None:
    with pytest.raises(ValidationError):
        build_settings(frontend_url=origin)
    with pytest.raises(ValidationError):
        build_settings(cors_origins=origin)


@pytest.mark.parametrize("key", ["sb_secret_abc123", legacy_key("service_role")])
def test_rejects_secret_key_in_anon_slot(key: str) -> None:
    with pytest.raises(ValidationError, match="SUPABASE_ANON_KEY contains a secret"):
        build_settings(supabase_anon_key=key)


@pytest.mark.parametrize("key", ["sb_publishable_abc", legacy_key("anon"), "sb_publishable_test_only"])
def test_rejects_public_key_in_service_role_slot(key: str) -> None:
    with pytest.raises(ValidationError, match="SUPABASE_SERVICE_ROLE_KEY contains the public"):
        build_settings(supabase_service_role_key=key)


def test_secrets_are_not_printed() -> None:
    settings = build_settings(supabase_service_role_key="sb_secret_real_value", openai_api_key="sk-live-value")
    dumped = repr(settings) + str(settings.model_dump())
    assert "sb_secret_real_value" not in dumped
    assert "sk-live-value" not in dumped


@pytest.mark.parametrize("url", ["http://abc.supabase.co", "abc.supabase.co", "https://abc.supabase.co/rest/v1"])
def test_rejects_bad_supabase_url(url: str) -> None:
    with pytest.raises(ValidationError):
        build_settings(supabase_url=url)


def test_local_http_supabase_is_allowed() -> None:
    assert build_settings(supabase_url="http://127.0.0.1:54321").rest_url == "http://127.0.0.1:54321/rest/v1"


def test_snowflake_cortex_model_defaults_and_qualified_model_names() -> None:
    assert build_settings().snowflake_cortex_model == "claude-sonnet-4-5"
    assert build_settings(snowflake_cortex_model="DEMO.PUBLIC.fine_tuned-model").snowflake_cortex_model == (
        "DEMO.PUBLIC.fine_tuned-model"
    )


@pytest.mark.parametrize("model", ["", " ", "model\n", "a" * 256, "https://attacker.example/model"])
def test_rejects_invalid_snowflake_cortex_model_names(model: str) -> None:
    with pytest.raises(ValidationError, match="snowflake_cortex_model"):
        build_settings(snowflake_cortex_model=model)


def test_missing_config_fails_with_actionable_message(monkeypatch: pytest.MonkeyPatch) -> None:
    class NoEnvFileSettings(config.Settings):
        model_config = SettingsConfigDict(env_file=None)

    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_ANON_KEY", raising=False)
    monkeypatch.setattr(config, "Settings", NoEnvFileSettings)
    config.get_settings.cache_clear()
    try:
        with pytest.raises(config.ConfigError) as excinfo:
            config.get_settings()
    finally:
        config.get_settings.cache_clear()
    message = str(excinfo.value)
    assert "SUPABASE_URL: is required" in message
    assert "SUPABASE_ANON_KEY: is required" in message
    assert ".env.example" in message
