"""OpenAI (and OpenAI-compatible xAI Grok) providers: streaming + image/PDF input on top of the
Chat Completions client in app.integrations.ai.openai_client."""

from collections.abc import AsyncGenerator
from contextlib import aclosing
from typing import ClassVar

from pydantic import BaseModel, Field, ValidationError

from app.ai.providers.base import (
    IMAGE_MEDIA_TYPES,
    PDF_MEDIA_TYPE,
    AIProvider,
    Attachment,
    StreamEnd,
    StreamEvent,
    TextDelta,
)
from app.ai.streaming import json_event, parse_sse
from app.integrations.ai.base import Prompt, TextResult, TokenUsage
from app.integrations.ai.openai_client import ChatMessages, GrokClient, OpenAIClient, OpenAICompatibleClient
from app.integrations.errors import IntegrationInvalidResponseError, IntegrationUnavailableError


class _Delta(BaseModel):
    content: str | None = None
    refusal: str | None = None


class _StreamChoice(BaseModel):
    delta: _Delta = Field(default_factory=_Delta)
    finish_reason: str | None = None


class _StreamUsage(BaseModel):
    prompt_tokens: int | None = None
    completion_tokens: int | None = None


class _StreamChunk(BaseModel):
    model: str | None = None
    choices: list[_StreamChoice] = Field(default_factory=list)
    usage: _StreamUsage | None = None


class OpenAICompatibleProvider(OpenAICompatibleClient, AIProvider):
    # Ask for a final usage chunk (`stream_options.include_usage`).
    stream_usage: ClassVar[bool] = True

    async def stream_text(
        self,
        prompt: Prompt,
        *,
        system: str | None = None,
        model: str | None = None,
        max_tokens: int = 1024,
        temperature: float | None = None,
    ) -> AsyncGenerator[StreamEvent]:
        body = self._chat_body(
            self._chat_messages(prompt, system), model=model, max_tokens=max_tokens, temperature=temperature
        )
        body["stream"] = True
        if self.stream_usage:
            body["stream_options"] = {"include_usage": True}

        used_model = str(body["model"])
        finish_reason: str | None = None
        usage: TokenUsage | None = None
        completed = False
        lines = self.call_stream("POST", "/chat/completions", json=body, idempotent=True)
        async with aclosing(parse_sse(lines)) as messages:
            async for message in messages:
                if message.data.strip() == "[DONE]":
                    completed = True
                    break
                chunk = self._parse_chunk(json_event(self.service_name, message))
                used_model = chunk.model or used_model
                if chunk.usage is not None:
                    usage = TokenUsage(
                        input_tokens=chunk.usage.prompt_tokens, output_tokens=chunk.usage.completion_tokens
                    )
                for choice in chunk.choices[:1]:
                    if choice.delta.refusal:
                        raise IntegrationInvalidResponseError(
                            self.service_name, "The model refused the request", code="AI_REFUSED"
                        )
                    if choice.delta.content:
                        yield TextDelta(text=choice.delta.content)
                    finish_reason = choice.finish_reason or finish_reason
        if not completed:
            raise IntegrationInvalidResponseError(
                self.service_name, "The stream ended before completion", code="AI_STREAM_INCOMPLETE"
            )
        yield StreamEnd(model=used_model, finish_reason=finish_reason, usage=usage)

    def _parse_chunk(self, payload: dict[str, object]) -> _StreamChunk:
        if "error" in payload:
            raise IntegrationUnavailableError(self.service_name, f"{self.service_name} reported an error mid-stream")
        try:
            return _StreamChunk.model_validate(payload)
        except ValidationError:
            raise IntegrationInvalidResponseError(
                self.service_name, "Received a malformed stream event", code="AI_MALFORMED_STREAM"
            ) from None

    async def analyze_image(
        self,
        attachment: Attachment,
        prompt: str,
        *,
        system: str | None = None,
        model: str | None = None,
        max_tokens: int = 1024,
        temperature: float | None = None,
    ) -> TextResult:
        self._check_attachment(attachment)
        if not prompt.strip():
            raise ValueError("prompt must not be empty")
        part: dict[str, object] = (
            {"type": "file", "file": {"filename": attachment.filename, "file_data": attachment.data_url}}
            if attachment.media_type == PDF_MEDIA_TYPE
            else {"type": "image_url", "image_url": {"url": attachment.data_url}}
        )
        messages: ChatMessages = [{"role": "system", "content": system}] if system else []
        messages.append({"role": "user", "content": [{"type": "text", "text": prompt}, part]})
        body = self._chat_body(messages, model=model, max_tokens=max_tokens, temperature=temperature)
        text, used_model, finish_reason, usage = await self._complete_body(body)
        return TextResult(
            provider=self.service_name, model=used_model, text=text, finish_reason=finish_reason, usage=usage
        )


class OpenAIProvider(OpenAICompatibleProvider, OpenAIClient):
    supported_attachments: ClassVar[frozenset[str]] = IMAGE_MEDIA_TYPES | {PDF_MEDIA_TYPE}


class GrokProvider(OpenAICompatibleProvider, GrokClient):
    # xAI documents JPEG/PNG image input and no PDF input on Chat Completions.
    supported_attachments: ClassVar[frozenset[str]] = frozenset({"image/png", "image/jpeg"})
    stream_usage: ClassVar[bool] = False
