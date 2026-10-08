"""Anthropic Messages API adapter. Structured output uses a forced tool call."""

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

API_VERSION = "2023-06-01"
STRUCTURED_TOOL = "structured_output"


class _Block(BaseModel):
    type: str
    text: str | None = None
    name: str | None = None
    input: dict[str, object] | None = None


class _Usage(BaseModel):
    input_tokens: int | None = None
    output_tokens: int | None = None


class _MessageResponse(BaseModel):
    model: str
    content: list[_Block] = Field(default_factory=list)
    stop_reason: str | None = None
    usage: _Usage | None = None


class AnthropicClient(AIClient):
    service_name: ClassVar[str] = "anthropic"
    env_var: ClassVar[str] = "ANTHROPIC_API_KEY"
    base_url: ClassVar[str] = "https://api.anthropic.com/v1"

    def auth_headers(self) -> dict[str, str]:
        return {"x-api-key": self.credential(), "anthropic-version": API_VERSION}

    def _body(
        self,
        messages: list[dict[str, object]],
        *,
        system: str | None,
        model: str | None,
        max_tokens: int,
        temperature: float | None,
        extra: dict[str, object] | None = None,
    ) -> dict[str, object]:
        body: dict[str, object] = {
            "model": model or self.default_model,
            "max_tokens": max_tokens,
            "messages": messages,
            **(extra or {}),
        }
        if system:
            body["system"] = system
        if temperature is not None:
            body["temperature"] = temperature
        return body

    async def _message(
        self,
        prompt: Prompt,
        *,
        system: str | None,
        model: str | None,
        max_tokens: int,
        temperature: float | None,
        extra: dict[str, object] | None = None,
    ) -> _MessageResponse:
        body = self._body(
            [m.model_dump() for m in to_messages(prompt)],
            system=system,
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
            extra=extra,
        )
        return await self.call("POST", "/messages", model=_MessageResponse, json=body, idempotent=True)

    def _text_result(self, data: _MessageResponse) -> TextResult:
        text = require_text(
            self.service_name, "".join(b.text or "" for b in data.content if b.type == "text"), data.stop_reason
        )
        usage = (
            TokenUsage(input_tokens=data.usage.input_tokens, output_tokens=data.usage.output_tokens)
            if data.usage
            else None
        )
        return TextResult(
            provider=self.service_name, model=data.model, text=text, finish_reason=data.stop_reason, usage=usage
        )

    async def generate_text(
        self,
        prompt: Prompt,
        *,
        system: str | None = None,
        model: str | None = None,
        max_tokens: int = 1024,
        temperature: float | None = None,
    ) -> TextResult:
        data = await self._message(prompt, system=system, model=model, max_tokens=max_tokens, temperature=temperature)
        return self._text_result(data)

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
        tool = {
            "name": STRUCTURED_TOOL,
            "description": f"Respond with a {schema.__name__} object.",
            "input_schema": json_schema_for(schema),
        }
        data = await self._message(
            prompt,
            system=system,
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
            extra={"tools": [tool], "tool_choice": {"type": "tool", "name": STRUCTURED_TOOL}},
        )
        for block in data.content:
            if block.type == "tool_use" and block.name == STRUCTURED_TOOL and block.input is not None:
                return parse_structured(self.service_name, block.input, schema)
        raise IntegrationInvalidResponseError(
            self.service_name, "Model did not return structured output", code="AI_INVALID_STRUCTURED_OUTPUT"
        )
