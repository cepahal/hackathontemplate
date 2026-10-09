"""Google Gemini (Generative Language API, generateContent) adapter."""

import re
from typing import ClassVar

from pydantic import BaseModel, Field

from app.integrations.ai.base import (
    AIClient,
    Prompt,
    SchemaT,
    TextResult,
    TokenUsage,
    json_schema_for,
    parse_structured,
    require_text,
    to_messages,
)
from app.integrations.errors import IntegrationInvalidResponseError

_MODEL_NAME = re.compile(r"[A-Za-z0-9._-]{1,100}")


class _Part(BaseModel):
    text: str | None = None
    thought: bool | None = None


class _Content(BaseModel):
    parts: list[_Part] = Field(default_factory=list)


class _Candidate(BaseModel):
    content: _Content | None = None
    finishReason: str | None = None  # noqa: N815 - provider field name


class _PromptFeedback(BaseModel):
    blockReason: str | None = None  # noqa: N815


class _UsageMetadata(BaseModel):
    promptTokenCount: int | None = None  # noqa: N815
    candidatesTokenCount: int | None = None  # noqa: N815


class _GenerateContentResponse(BaseModel):
    candidates: list[_Candidate] = Field(default_factory=list)
    promptFeedback: _PromptFeedback | None = None  # noqa: N815
    usageMetadata: _UsageMetadata | None = None  # noqa: N815
    modelVersion: str | None = None  # noqa: N815


class GeminiClient(AIClient):
    service_name: ClassVar[str] = "gemini"
    env_var: ClassVar[str] = "GEMINI_API_KEY"
    base_url: ClassVar[str] = "https://generativelanguage.googleapis.com/v1beta"

    def auth_headers(self) -> dict[str, str]:
        return {"x-goog-api-key": self.credential()}

    def _model_name(self, model: str | None) -> str:
        model_name = model or self.default_model
        if not _MODEL_NAME.fullmatch(model_name):
            raise ValueError(f"invalid Gemini model name: {model_name!r}")
        return model_name

    @staticmethod
    def _contents(prompt: Prompt) -> list[dict[str, object]]:
        return [
            {"role": "model" if m.role == "assistant" else "user", "parts": [{"text": m.content}]}
            for m in to_messages(prompt)
        ]

    @staticmethod
    def _body(
        contents: list[dict[str, object]],
        *,
        system: str | None,
        max_tokens: int,
        temperature: float | None,
        response_schema: dict[str, object] | None = None,
    ) -> dict[str, object]:
        generation_config: dict[str, object] = {"maxOutputTokens": max_tokens}
        if temperature is not None:
            generation_config["temperature"] = temperature
        if response_schema is not None:
            generation_config["responseMimeType"] = "application/json"
            generation_config["responseJsonSchema"] = response_schema
        body: dict[str, object] = {"contents": contents, "generationConfig": generation_config}
        if system:
            body["systemInstruction"] = {"parts": [{"text": system}]}
        return body

    def _candidate_text(self, data: _GenerateContentResponse) -> tuple[str, str | None]:
        """Text (excluding thought summaries) and finish reason of the first candidate."""
        if not data.candidates:
            reason = data.promptFeedback.blockReason if data.promptFeedback else None
            raise IntegrationInvalidResponseError(
                self.service_name, f"Gemini returned no candidates (block reason: {reason})", code="AI_BLOCKED"
            )
        candidate = data.candidates[0]
        parts = candidate.content.parts if candidate.content else []
        return "".join(part.text or "" for part in parts if not part.thought), candidate.finishReason

    @staticmethod
    def _usage(data: _GenerateContentResponse) -> TokenUsage | None:
        if data.usageMetadata is None:
            return None
        return TokenUsage(
            input_tokens=data.usageMetadata.promptTokenCount, output_tokens=data.usageMetadata.candidatesTokenCount
        )

    async def _generate_body(
        self, model_name: str, body: dict[str, object]
    ) -> tuple[str, str, str | None, TokenUsage | None]:
        data = await self.call(
            "POST", f"/models/{model_name}:generateContent", model=_GenerateContentResponse, json=body, idempotent=True
        )
        text, finish_reason = self._candidate_text(data)
        text = require_text(self.service_name, text, finish_reason)
        return text, data.modelVersion or model_name, finish_reason, self._usage(data)

    async def _generate(
        self,
        prompt: Prompt,
        *,
        system: str | None,
        model: str | None,
        max_tokens: int,
        temperature: float | None,
        response_schema: dict[str, object] | None = None,
    ) -> tuple[str, str, str | None, TokenUsage | None]:
        model_name = self._model_name(model)
        body = self._body(
            self._contents(prompt),
            system=system,
            max_tokens=max_tokens,
            temperature=temperature,
            response_schema=response_schema,
        )
        return await self._generate_body(model_name, body)

    async def generate_text(
        self,
        prompt: Prompt,
        *,
        system: str | None = None,
        model: str | None = None,
        max_tokens: int = 1024,
        temperature: float | None = None,
    ) -> TextResult:
        text, used_model, finish_reason, usage = await self._generate(
            prompt, system=system, model=model, max_tokens=max_tokens, temperature=temperature
        )
        return TextResult(
            provider=self.service_name, model=used_model, text=text, finish_reason=finish_reason, usage=usage
        )

    async def generate_structured(
        self,
        prompt: Prompt,
        schema: type[SchemaT],
        *,
        system: str | None = None,
        model: str | None = None,
        max_tokens: int = 1024,
        temperature: float | None = None,
    ) -> SchemaT:
        text, *_ = await self._generate(
            prompt,
            system=system,
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
            response_schema=json_schema_for(schema),
        )
        return parse_structured(self.service_name, text, schema)
