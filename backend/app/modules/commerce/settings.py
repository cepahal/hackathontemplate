from pydantic import SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.core.config import BACKEND_DIR
from app.modules.identity.settings import IdentitySettings


class CommerceSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_allowed_price_ids: list[str] = []
    allow_live_payments: bool = False
    app_public_url: str = ""
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""

    @field_validator("supabase_url", "app_public_url")
    @classmethod
    def https_origin(cls, value: str) -> str:
        return IdentitySettings.validate_url(value)

    @field_validator("supabase_anon_key")
    @classmethod
    def public_key(cls, value: str) -> str:
        return IdentitySettings.reject_privileged_keys(SecretStr(value)).get_secret_value()
