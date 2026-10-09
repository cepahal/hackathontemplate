"""OpenAI Chat Completions adapter. Also works for any OpenAI-compatible API (xAI Grok below)."""

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


class _Message(BaseModel):
    content: str | None = None
    refusal: str | None = None


class _Choice(BaseModel):
    message: _Message
    finish_reason: str | None = None


class _Usage(BaseModel):
    prompt_tokens: int | None = None
    completion_tokens: int | None = None


class _ChatCompletion(BaseModel):
    model: str
    choices: list[_Choice] = Field(min_length=1)
    usage: _Usage | None = None


ChatMessages = list[dict[str, object]]


class OpenAICompatibleClient(AIClient):
    @staticmethod
    def _chat_messages(prompt: Prompt, system: str | None) -> ChatMessages:
        messages: ChatMessages = [{"role": "system", "content": system}] if system else []
        return messages + [m.model_dump() for m in to_messages(prompt)]

    def _chat_body(
        self, messages: ChatMessages, *, model: str | None, max_tokens: int, temperature: float | None
    ) -> dict[str, object]:
        body: dict[str, object] = {
            "model": model or self.default_model,
            "messages": messages,
            "max_completion_tokens": max_tokens,
        }
        if temperature is not None:
            body["temperature"] = temperature
        return body

    async def _complete(
        self,
        prompt: Prompt,
        *,
        system: str | None,
        model: str | None,
        max_tokens: int,
        temperature: float | None,
        response_format: dict[str, object] | None = None,
    ) -> tuple[str, str, str | None, TokenUsage | None]:
        body = self._chat_body(
            self._chat_messages(prompt, system), model=model, max_tokens=max_tokens, temperature=temperature
        )
        if response_format is not None:
            body["response_format"] = response_format
        return await self._complete_body(body)

    async def _complete_body(self, body: dict[str, object]) -> tuple[str, str, str | None, TokenUsage | None]:
        # Generation has no side effects, so retrying transient failures is safe.
        data = await self.call("POST", "/chat/completions", model=_ChatCompletion, json=body, idempotent=True)
        choice = data.choices[0]
        if choice.message.refusal:
            raise IntegrationInvalidResponseError(self.service_name, "The model refused the request", code="AI_REFUSED")
        usage = (
            TokenUsage(input_tokens=data.usage.prompt_tokens, output_tokens=data.usage.completion_tokens)
            if data.usage
            else None
        )
        text = require_text(self.service_name, choice.message.content or "", choice.finish_reason)
        return text, data.model, choice.finish_reason, usage

    async def generate_text(
        self,
        prompt: Prompt,
        *,
        system: str | None = None,
        model: str | None = None,
        max_tokens: int = 1024,
        temperature: float | None = None,
    ) -> TextResult:
        text, used_model, finish_reason, usage = await self._complete(
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
        response_format: dict[str, object] = {
            "type": "json_schema",
            "json_schema": {"name": schema.__name__, "schema": json_schema_for(schema), "strict": False},
        }
        text, *_ = await self._complete(
            prompt,
            system=system,
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
            response_format=response_format,
        )
        return parse_structured(self.service_name, text, schema)


class OpenAIClient(OpenAICompatibleClient):
    service_name: ClassVar[str] = "openai"
    env_var: ClassVar[str] = "OPENAI_API_KEY"
    base_url: ClassVar[str] = "https://api.openai.com/v1"


class GrokClient(OpenAICompatibleClient):
    service_name: ClassVar[str] = "grok"
    env_var: ClassVar[str] = "GROK_API_KEY"
    base_url: ClassVar[str] = "https://api.x.ai/v1"
