"""Bounded, non-streaming text generation through Snowflake's Cortex REST API."""

import re
from typing import ClassVar, Literal

import httpx
from pydantic import BaseModel, ConfigDict, Field, SecretStr, ValidationError

from app.integrations.errors import IntegrationInvalidResponseError
from app.integrations.snowflake.client import _DEFAULT_AUTH_TYPE, SnowflakeClient, SnowflakeTokenType


class CortexTextResult(BaseModel):
    model_config = ConfigDict(strict=True)

    text: str = Field(min_length=1, max_length=16_000)
    model: str = Field(min_length=1, max_length=255)


class _Message(BaseModel):
    model_config = ConfigDict(strict=True)

    role: Literal["assistant"]
    content: str = Field(min_length=1, max_length=16_000)


class _Choice(BaseModel):
    message: _Message


class _Completion(BaseModel):
    model_config = ConfigDict(strict=True)

    model: str = Field(min_length=1, max_length=255)
    choices: list[_Choice] = Field(min_length=1, max_length=1)


class CortexClient(SnowflakeClient):
    """Reuses Snowflake's pinned host, token headers, safe errors and no-retry HTTP client.

    The account must enable Cortex REST access and its default role must have
    SNOWFLAKE.CORTEX_USER or SNOWFLAKE.CORTEX_REST_API_USER. Model access varies by region.
    Construction performs no I/O; generation may consume Snowflake credits.
    """

    service_name: ClassVar[str] = "snowflake_cortex"
    timeout_seconds: ClassVar[float] = 30.0

    def __init__(
        self,
        http: httpx.AsyncClient,
        token: SecretStr | None,
        *,
        account_host: str | None = None,
        token_type: SnowflakeTokenType = _DEFAULT_AUTH_TYPE,
        default_model: str = "claude-sonnet-4-5",
    ) -> None:
        if token is not None and not token.get_secret_value().strip():
            token = None
        super().__init__(http, token, account_host=account_host, token_type=token_type)
        if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,254}", default_model):
            raise ValueError("SNOWFLAKE_CORTEX_MODEL must be a model name of 1-255 characters")
        self._default_model = default_model

    async def generate_text(
        self, prompt: str, *, system: str | None = None, max_tokens: int = 1024
    ) -> CortexTextResult:
        """Generate one text response. No tools, attachments, retries or durable history."""
        if not prompt.strip() or len(prompt) > 8_000:
            raise ValueError("prompt must be 1-8000 characters")
        if system is not None and (not system.strip() or len(system) > 2_000):
            raise ValueError("system must be 1-2000 characters when provided")
        if type(max_tokens) is not int or not 1 <= max_tokens <= 2048:
            raise ValueError("max_tokens must be an integer between 1 and 2048")
        messages: list[dict[str, str]] = []
        if system is not None:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        response = await self.call_raw(
            "POST",
            "/cortex/v1/chat/completions",
            json={
                "model": self._default_model,
                "messages": messages,
                # Cortex's Chat API rejects the deprecated max_tokens wire field.
                "max_completion_tokens": max_tokens,
                "stream": False,
            },
            idempotent=False,
        )
        if response.status_code != 200:
            raise IntegrationInvalidResponseError(self.service_name)
        try:
            result = _Completion.model_validate(response.json())
        except (ValueError, ValidationError):
            raise IntegrationInvalidResponseError(self.service_name) from None
        text = result.choices[0].message.content
        if not text.strip():
            raise IntegrationInvalidResponseError(self.service_name)
        return CortexTextResult(text=text, model=result.model)
