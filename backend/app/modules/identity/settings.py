"""Identity configuration remains optional until an identity endpoint is used."""

import base64
import json
from urllib.parse import urlsplit

from pydantic import SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.core.config import BACKEND_DIR


class IdentitySettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env", extra="ignore", case_sensitive=False
    )

    supabase_url: str = ""
    supabase_anon_key: SecretStr = SecretStr("")

    @field_validator("supabase_url")
    @classmethod
    def validate_url(cls, value: str) -> str:
        if not value:
            return value
        parsed = urlsplit(value)
        if (
            parsed.scheme != "https"
            or not parsed.hostname
            or parsed.username
            or parsed.password
            or parsed.path not in {"", "/"}
            or parsed.query
            or parsed.fragment
            or any(character.isspace() for character in value)
        ):
            raise ValueError("SUPABASE_URL must be an HTTPS origin without credentials or a path")
        _ = parsed.port
        return value.rstrip("/")

    @field_validator("supabase_anon_key")
    @classmethod
    def reject_privileged_keys(cls, value: SecretStr) -> SecretStr:
        key = value.get_secret_value()
        privileged = key.startswith("sb_secret_")
        if key.count(".") == 2:
            # Decode only to reject privileged configuration, never to authorize a request.
            try:
                segment = key.split(".")[1]
                payload = json.loads(base64.urlsafe_b64decode(segment + "=" * (-len(segment) % 4)))
                privileged = privileged or payload.get("role") == "service_role"
            except (ValueError, TypeError, AttributeError):
                pass
        if privileged:
            raise ValueError("Use a Supabase publishable or anon key, not a service-role key")
        return value
