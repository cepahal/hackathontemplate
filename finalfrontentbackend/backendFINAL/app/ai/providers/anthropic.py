"""Anthropic provider: Messages API streaming + image/PDF content blocks on top of
app.integrations.ai.anthropic_client."""

from collections.abc import AsyncGenerator
from contextlib import aclosing
from typing import ClassVar, TypeVar

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
from app.integrations.ai.anthropic_client import AnthropicClient, _MessageResponse
from app.integrations.ai.base import Prompt, TextResult, TokenUsage, to_messages
from app.integrations.errors import (
    IntegrationError,
    IntegrationInvalidResponseError,
    IntegrationRateLimitedError,
    IntegrationRequestError,
    IntegrationUnavailableError,
)

EventT = TypeVar("EventT", bound=BaseModel)


class _StartUsage(BaseModel):
    input_tokens: int | None = None


class _StartMessage(BaseModel):
    model: str
    usage: _StartUsage = Field(default_factory=_StartUsage)


class _MessageStart(BaseModel):
    message: _StartMessage


class _Delta(BaseModel):
    type: str
    text: str | None = None
    stop_reason: str | None = None


class _BlockDelta(BaseModel):
    delta: _Delta


class _DeltaUsage(BaseModel):
    output_tokens: int | None = None


class _MessageDelta(BaseModel):
    delta: _Delta
    usage: _DeltaUsage = Field(default_factory=_DeltaUsage)


class _ErrorDetail(BaseModel):
    type: str = "api_error"


class _StreamError(BaseModel):
    error: _ErrorDetail = Field(default_factory=_ErrorDetail)


class AnthropicProvider(AnthropicClient, AIProvider):
    supported_attachments: ClassVar[frozenset[str]] = IMAGE_MEDIA_TYPES | {PDF_MEDIA_TYPE}

    async def stream_text(
        self,
        prompt: Prompt,
        *,
        system: str | None = None,
        model: str | None = None,
        max_tokens: int = 1024,
        temperature: float | None = None,
    ) -> AsyncGenerator[StreamEvent]:
        body = self._body(
            [m.model_dump() for m in to_messages(prompt)],
            system=system,
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
            extra={"stream": True},
        )
        used_model = str(body["model"])
        input_tokens: int | None = None
        output_tokens: int | None = None
        stop_reason: str | None = None
        completed = False
        lines = self.call_stream("POST", "/messages", json=body, idempotent=True)
        async with aclosing(parse_sse(lines)) as messages:
            async for message in messages:
                payload = json_event(self.service_name, message)
                kind = payload.get("type")
                if kind == "message_start":
                    start = self._validate(_MessageStart, payload)
                    used_model, input_tokens = start.message.model, start.message.usage.input_tokens
                elif kind == "content_block_delta":
                    delta = self._validate(_BlockDelta, payload).delta
                    if delta.type == "text_delta" and delta.text:
                        yield TextDelta(text=delta.text)
                elif kind == "message_delta":
                    update = self._validate(_MessageDelta, payload)
                    stop_reason = update.delta.stop_reason or stop_reason
                    output_tokens = update.usage.output_tokens or output_tokens
                elif kind == "message_stop":
                    completed = True
                    break
                elif kind == "error":
                    raise self._stream_error(self._validate(_StreamError, payload).error.type)
                # ping, content_block_start/stop and future event types carry no text.
        if not completed:
            raise IntegrationInvalidResponseError(
                self.service_name, "The stream ended before completion", code="AI_STREAM_INCOMPLETE"
            )
        usage = TokenUsage(input_tokens=input_tokens, output_tokens=output_tokens)
        yield StreamEnd(model=used_model, finish_reason=stop_reason, usage=usage)

    def _validate(self, model: type[EventT], payload: dict[str, object]) -> EventT:
        try:
            return model.model_validate(payload)
        except ValidationError:
            raise IntegrationInvalidResponseError(
                self.service_name, "Received a malformed stream event", code="AI_MALFORMED_STREAM"
            ) from None

    def _stream_error(self, error_type: str) -> IntegrationError:
        if error_type == "rate_limit_error":
            return IntegrationRateLimitedError(self.service_name)
        if error_type in {"overloaded_error", "api_error"}:
            return IntegrationUnavailableError(self.service_name)
        return IntegrationRequestError(self.service_name, f"anthropic stream failed ({error_type})")

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
        block_type = "document" if attachment.media_type == PDF_MEDIA_TYPE else "image"
        content: list[dict[str, object]] = [
            {
                "type": block_type,
                "source": {"type": "base64", "media_type": attachment.media_type, "data": attachment.base64},
            },
            {"type": "text", "text": prompt},
        ]
        body = self._body(
            [{"role": "user", "content": content}],
            system=system,
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
        )
        data = await self.call("POST", "/messages", model=_MessageResponse, json=body, idempotent=True)
        return self._text_result(data)
