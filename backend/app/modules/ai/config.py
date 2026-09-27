"""Server-only AI configuration; provider models are explicitly configured."""

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.core.config import BACKEND_DIR


class AISettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    gemini_api_key: str = ""
    openai_model: str = ""
    anthropic_model: str = ""
    gemini_model: str = ""
    ai_timeout_seconds: float = Field(default=45, ge=1, le=120)
    ai_max_retries: int = Field(default=2, ge=0, le=3)
    ai_prices_per_million: dict[str, dict[str, float]] = Field(default_factory=dict)
    embedding_provider: str = "openai"
    embedding_model: str = "text-embedding-3-small"
    supabase_url: str = ""
    supabase_anon_key: str = ""

    @field_validator("ai_prices_per_million")
    @classmethod
    def prices_are_finite(cls, value):
        import math

        for prices in value.values():
            if set(prices) != {"input", "output"}:
                raise ValueError("Each model price requires input and output USD per million")
            if any(not math.isfinite(price) or price < 0 for price in prices.values()):
                raise ValueError("Prices must be finite and nonnegative")
        return value
