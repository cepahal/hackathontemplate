"""Application settings, loaded from environment variables and `backendFINAL/.env`."""

import base64
import binascii
import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal
from urllib.parse import urlsplit

from pydantic import Field, SecretStr, ValidationError, ValidationInfo, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

BACKEND_ROOT = Path(__file__).resolve().parents[2]
LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1"}
EMAIL_FROM_PATTERN = re.compile(r"(?:[^<>\r\n]{1,100} <)?[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+>?")
# Webhook URLs are secrets from the environment; pinning their hosts keeps them from becoming
# a server-side request forgery vector if someone sets them to an internal address.
WEBHOOK_URL_PREFIXES: dict[str, tuple[str, ...]] = {
    "slack_webhook_url": ("https://hooks.slack.com/",),
    "discord_webhook_url": ("https://discord.com/api/webhooks/", "https://discordapp.com/api/webhooks/"),
}


class ConfigError(RuntimeError):
    """Raised at startup when required configuration is missing or unsafe."""


def _jwt_role(key: str) -> str | None:
    """Returns the `role` claim of a legacy JWT-style Supabase key without verifying it."""
    parts = key.split(".")
    if len(parts) != 3:
        return None
    payload = parts[1] + "=" * (-len(parts[1]) % 4)
    try:
        claims = json.loads(base64.urlsafe_b64decode(payload))
    except (binascii.Error, ValueError):
        return None
    role = claims.get("role") if isinstance(claims, dict) else None
    return role if isinstance(role, str) else None


def _normalize_origin(value: str) -> str:
    origin = value.strip().rstrip("/")
    if origin == "*" or "*" in origin:
        raise ValueError("wildcard CORS origins are not allowed; list explicit origins")
    parts = urlsplit(origin)
    if parts.scheme not in {"http", "https"} or not parts.netloc:
        raise ValueError(f"'{value}' is not an origin like https://app.example.com")
    if parts.path or parts.query or parts.fragment:
        raise ValueError(f"'{value}' must be an origin only (scheme://host[:port]), without a path")
    return origin


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_ROOT / ".env",
        env_file_encoding="utf-8",
        env_ignore_empty=True,
        extra="ignore",
    )

    environment: Literal["development", "test", "production"] = "development"
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"

    supabase_url: str
    # Public (anon / sb_publishable_) key. Sent as `apikey` together with the caller's own JWT,
    # so every database query runs as that user and Row Level Security applies.
    supabase_anon_key: SecretStr
    # Bypasses RLS. Backend-only and not used by any user-facing route; reserved for admin jobs.
    supabase_service_role_key: SecretStr | None = None
    # Only for legacy projects that still sign user JWTs with HS256. Projects using JWT signing
    # keys (ES256/RS256, the current default) are verified via the public JWKS endpoint instead.
    supabase_jwt_secret: SecretStr | None = None
    supabase_timeout_seconds: float = Field(default=10.0, gt=0, le=60)

    frontend_url: str = "http://localhost:3000"
    # Extra allowed origins, comma-separated (e.g. a Vercel preview URL).
    cors_origins: Annotated[list[str], NoDecode] = Field(default_factory=list)

    # External integrations. All optional: a missing key only fails when that integration is
    # called (503 INTEGRATION_NOT_CONFIGURED). See app/integrations/README.md.
    openai_api_key: SecretStr | None = None
    openai_model: str = "gpt-4.1-mini"
    gemini_api_key: SecretStr | None = None
    gemini_model: str = "gemini-3.8-flash"
    anthropic_api_key: SecretStr | None = None
    anthropic_model: str = "claude-haiku-4-5"
    grok_api_key: SecretStr | None = None
    grok_model: str = "grok-4-fast-non-reasoning"
    github_token: SecretStr | None = None
    maps_provider: Literal["mapbox", "google"] = "mapbox"
    maps_api_key: SecretStr | None = None
    resend_api_key: SecretStr | None = None
    email_from: str | None = None
    slack_webhook_url: SecretStr | None = None
    discord_webhook_url: SecretStr | None = None
    integrations_rate_limit_per_minute: int = Field(default=20, ge=1, le=1000)

    # AI application layer (app/ai). The provider is chosen per request from the configured ones;
    # models always come from *_MODEL above, never from the client.
    ai_default_provider: Literal["openai", "gemini", "anthropic", "grok"] | None = None
    ai_max_prompt_chars: int = Field(default=20_000, ge=100, le=200_000)
    ai_max_context_chars: int = Field(default=50_000, ge=0, le=500_000)
    ai_max_output_tokens: int = Field(default=2048, ge=64, le=16_384)
    ai_max_file_bytes: int = Field(default=5 * 1024 * 1024, ge=1024, le=20 * 1024 * 1024)
    ai_stream_timeout_seconds: float = Field(default=120.0, gt=0, le=600)

    @field_validator("supabase_url")
    @classmethod
    def _validate_supabase_url(cls, value: str) -> str:
        url = value.strip().rstrip("/")
        parts = urlsplit(url)
        if not parts.hostname:
            raise ValueError("must be a URL like https://<project-ref>.supabase.co")
        if parts.scheme != "https" and not (parts.scheme == "http" and parts.hostname in LOCAL_HOSTS):
            raise ValueError("must use https (http is only allowed for localhost)")
        if parts.path or parts.query:
            raise ValueError("must be the project base URL without a path, e.g. https://abc.supabase.co")
        return url

    @field_validator("frontend_url")
    @classmethod
    def _validate_frontend_url(cls, value: str) -> str:
        return _normalize_origin(value)

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_cors_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [item for item in value.split(",") if item.strip()]
        return value

    @field_validator("cors_origins")
    @classmethod
    def _validate_cors_origins(cls, value: list[str]) -> list[str]:
        return [_normalize_origin(item) for item in value]

    @field_validator("openai_model", "gemini_model", "anthropic_model", "grok_model")
    @classmethod
    def _validate_model_name(cls, value: str) -> str:
        if not re.fullmatch(r"[A-Za-z0-9._:-]{1,100}", value):
            raise ValueError("model names may only contain letters, digits, '.', '_', ':' and '-'")
        return value

    @field_validator("email_from")
    @classmethod
    def _validate_email_from(cls, value: str | None) -> str | None:
        if value is not None and not EMAIL_FROM_PATTERN.fullmatch(value.strip()):
            raise ValueError("must look like 'you@example.com' or 'App Name <you@example.com>'")
        return value.strip() if value else None

    @field_validator("slack_webhook_url", "discord_webhook_url")
    @classmethod
    def _validate_webhook_url(cls, value: SecretStr | None, info: ValidationInfo) -> SecretStr | None:
        if value is None:
            return None
        allowed = WEBHOOK_URL_PREFIXES[info.field_name or ""]
        if not value.get_secret_value().startswith(allowed):
            raise ValueError(f"must start with one of: {', '.join(allowed)}")
        return value

    @model_validator(mode="after")
    def _validate_key_roles(self) -> "Settings":
        anon = self.supabase_anon_key.get_secret_value()
        if anon.startswith("sb_secret_") or _jwt_role(anon) == "service_role":
            raise ValueError(
                "SUPABASE_ANON_KEY contains a secret/service-role key. Use the publishable "
                "(sb_publishable_...) or legacy anon key."
            )
        if self.supabase_service_role_key is not None:
            service = self.supabase_service_role_key.get_secret_value()
            if service.startswith("sb_publishable_") or _jwt_role(service) == "anon" or service == anon:
                raise ValueError(
                    "SUPABASE_SERVICE_ROLE_KEY contains the public anon/publishable key. Use the "
                    "secret (sb_secret_...) or legacy service_role key, or leave it empty."
                )
        return self

    @property
    def rest_url(self) -> str:
        return f"{self.supabase_url}/rest/v1"

    @property
    def auth_url(self) -> str:
        return f"{self.supabase_url}/auth/v1"

    @property
    def jwks_url(self) -> str:
        return f"{self.auth_url}/.well-known/jwks.json"

    @property
    def jwt_issuer(self) -> str:
        return self.auth_url

    @property
    def allowed_origins(self) -> list[str]:
        return list(dict.fromkeys([self.frontend_url, *self.cors_origins]))

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    try:
        return Settings()
    except ValidationError as exc:
        problems = []
        for error in exc.errors():
            field = ".".join(str(part) for part in error["loc"]) or "settings"
            message = "is required" if error["type"] == "missing" else error["msg"]
            problems.append(f"  - {field.upper()}: {message}")
        raise ConfigError(
            "Invalid backend configuration. Set these in backendFINAL/.env (see .env.example):\n" + "\n".join(problems)
        ) from None
