"""Gemini provider: streaming (`streamGenerateContent?alt=sse`) + inline image/PDF input on top of
app.integrations.ai.gemini_client."""

from collections.abc import AsyncGenerator
from contextlib import aclosing
from typing import ClassVar

from pydantic import ValidationError

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
from app.integrations.ai.gemini_client import GeminiClient, _GenerateContentResponse
from app.integrations.errors import IntegrationInvalidResponseError, IntegrationUnavailableError


class GeminiProvider(GeminiClient, AIProvider):
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
        model_name = self._model_name(model)
        body = self._body(self._contents(prompt), system=system, max_tokens=max_tokens, temperature=temperature)

        used_model = model_name
        finish_reason: str | None = None
        usage: TokenUsage | None = None
        lines = self.call_stream(
            "POST", f"/models/{model_name}:streamGenerateContent", params={"alt": "sse"}, json=body, idempotent=True
        )
        async with aclosing(parse_sse(lines)) as messages:
            async for message in messages:
                chunk = self._parse_chunk(json_event(self.service_name, message))
                used_model = chunk.modelVersion or used_model
                usage = self._usage(chunk) or usage
                if not chunk.candidates:
                    if chunk.promptFeedback and chunk.promptFeedback.blockReason:
                        self._candidate_text(chunk)  # raises AI_BLOCKED with the reason
                    continue
                text, chunk_finish = self._candidate_text(chunk)
                if text:
                    yield TextDelta(text=text)
                finish_reason = chunk_finish or finish_reason
        if finish_reason is None:
            raise IntegrationInvalidResponseError(
                self.service_name, "The stream ended before completion", code="AI_STREAM_INCOMPLETE"
            )
        yield StreamEnd(model=used_model, finish_reason=finish_reason, usage=usage)

    def _parse_chunk(self, payload: dict[str, object]) -> _GenerateContentResponse:
        if "error" in payload:
            raise IntegrationUnavailableError(self.service_name, "gemini reported an error mid-stream")
        try:
            return _GenerateContentResponse.model_validate(payload)
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
        model_name = self._model_name(model)
        contents: list[dict[str, object]] = [
            {
                "role": "user",
                "parts": [
                    {"inlineData": {"mimeType": attachment.media_type, "data": attachment.base64}},
                    {"text": prompt},
                ],
            }
        ]
        body = self._body(contents, system=system, max_tokens=max_tokens, temperature=temperature)
        text, used_model, finish_reason, usage = await self._generate_body(model_name, body)
        return TextResult(
            provider=self.service_name, model=used_model, text=text, finish_reason=finish_reason, usage=usage
        )
