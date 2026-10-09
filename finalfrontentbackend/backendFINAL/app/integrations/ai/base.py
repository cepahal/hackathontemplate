"""Provider-neutral AI interface: generate_text() and generate_structured().

Prompts always come from the caller; nothing here hardcodes instructions. Treat model output as
untrusted data: validate it (generate_structured does) and never let it trigger privileged actions.
"""

import json
import re
from abc import ABC, abstractmethod
from collections.abc import Sequence
from typing import ClassVar, Literal, TypeVar

import httpx
from pydantic import BaseModel, SecretStr, ValidationError

from app.integrations.base import ExternalService
from app.integrations.errors import IntegrationInvalidResponseError

SchemaT = TypeVar("SchemaT", bound=BaseModel)


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


Prompt = str | Sequence[ChatMessage]


class TokenUsage(BaseModel):
    input_tokens: int | None = None
    output_tokens: int | None = None


class TextResult(BaseModel):
    provider: str
    model: str
    text: str
    finish_reason: str | None = None
    usage: TokenUsage | None = None


def to_messages(prompt: Prompt) -> list[ChatMessage]:
    messages = [ChatMessage(role="user", content=prompt)] if isinstance(prompt, str) else list(prompt)
    if not messages or not any(m.content.strip() for m in messages):
        raise ValueError("prompt must not be empty")
    return messages


def json_schema_for(schema: type[BaseModel]) -> dict[str, object]:
    """JSON Schema for `schema` with $refs inlined (several providers reject $defs)."""
    raw = schema.model_json_schema()
    defs = raw.pop("$defs", {})

    def resolve(node: object) -> object:
        if isinstance(node, dict):
            ref = node.get("$ref")
            if isinstance(ref, str) and ref.startswith("#/$defs/"):
                return resolve(defs[ref.removeprefix("#/$defs/")])
            return {key: resolve(value) for key, value in node.items()}
        if isinstance(node, list):
            return [resolve(item) for item in node]
        return node

    resolved = resolve(raw)
    if not isinstance(resolved, dict):
        raise TypeError(f"{schema.__name__} did not produce an object schema")
    return resolved


_FENCE = re.compile(r"^```(?:json)?\s*(.*?)\s*```$", re.DOTALL)


def parse_structured(service: str, raw: str | dict[str, object], schema: type[SchemaT]) -> SchemaT:
    try:
        if isinstance(raw, str):
            match = _FENCE.match(raw.strip())
            raw = json.loads(match.group(1) if match else raw)
        return schema.model_validate(raw)
    except (ValueError, ValidationError):
        raise IntegrationInvalidResponseError(
            service, "Model output did not match the requested schema", code="AI_INVALID_STRUCTURED_OUTPUT"
        ) from None


def require_text(service: str, text: str, finish_reason: str | None) -> str:
    if not text.strip():
        hint = f" (finish reason: {finish_reason})" if finish_reason else ""
        raise IntegrationInvalidResponseError(service, f"Model returned no text{hint}", code="AI_EMPTY_RESPONSE")
    return text


class AIClient(ExternalService, ABC):
    timeout_seconds: ClassVar[float] = 60.0

    def __init__(self, http: httpx.AsyncClient, api_key: SecretStr | None, *, default_model: str) -> None:
        super().__init__(http, api_key)
        self.default_model = default_model

    @abstractmethod
    async def generate_text(
        self,
        prompt: Prompt,
        *,
        system: str | None = None,
        model: str | None = None,
        max_tokens: int = 1024,
        temperature: float | None = None,
    ) -> TextResult: ...

    @abstractmethod
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
        """Returns an instance of `schema`, validated. Raises AI_INVALID_STRUCTURED_OUTPUT otherwise."""
