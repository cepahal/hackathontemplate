"""Provider abstraction for the AI layer.

`AIProvider` extends the integration-level `AIClient` (generate_text / generate_structured, with
the shared HTTP client's timeouts, retries and error mapping) with:

- `stream_text()`   incremental text as `TextDelta` events, ending with one `StreamEnd`
- `analyze_image()` a prompt plus one binary attachment (image, or PDF where supported). Generic
                    on purpose: OCR, description, classification and document analysis are all
                    just different prompts.

Each provider declares which attachment media types it accepts.
"""

import base64
from abc import ABC, abstractmethod
from collections.abc import AsyncGenerator
from dataclasses import dataclass
from typing import ClassVar, Literal

from pydantic import BaseModel

from app.integrations.ai.base import AIClient, Prompt, TextResult, TokenUsage

AttachmentMediaType = Literal["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"]

IMAGE_MEDIA_TYPES: frozenset[str] = frozenset({"image/png", "image/jpeg", "image/webp", "image/gif"})
PDF_MEDIA_TYPE = "application/pdf"


@dataclass(frozen=True, slots=True)
class Attachment:
    """Validated binary input (see app.ai.files). Never constructed from unchecked client data."""

    media_type: AttachmentMediaType
    data: bytes
    filename: str = "attachment"

    @property
    def base64(self) -> str:
        return base64.b64encode(self.data).decode("ascii")

    @property
    def data_url(self) -> str:
        return f"data:{self.media_type};base64,{self.base64}"


class TextDelta(BaseModel):
    text: str


class StreamEnd(BaseModel):
    model: str
    finish_reason: str | None = None
    usage: TokenUsage | None = None


StreamEvent = TextDelta | StreamEnd


class AIProvider(AIClient, ABC):
    supported_attachments: ClassVar[frozenset[str]] = IMAGE_MEDIA_TYPES

    def supports(self, media_type: str) -> bool:
        return media_type in self.supported_attachments

    @abstractmethod
    def stream_text(
        self,
        prompt: Prompt,
        *,
        system: str | None = None,
        model: str | None = None,
        max_tokens: int = 1024,
        temperature: float | None = None,
    ) -> AsyncGenerator[StreamEvent]:
        """Yields TextDelta events, then exactly one StreamEnd. Raises IntegrationError on failure."""

    @abstractmethod
    async def analyze_image(
        self,
        attachment: Attachment,
        prompt: str,
        *,
        system: str | None = None,
        model: str | None = None,
        max_tokens: int = 1024,
        temperature: float | None = None,
    ) -> TextResult: ...

    def _check_attachment(self, attachment: Attachment) -> None:
        if not self.supports(attachment.media_type):
            raise ValueError(f"{self.service_name} does not accept {attachment.media_type} input")
