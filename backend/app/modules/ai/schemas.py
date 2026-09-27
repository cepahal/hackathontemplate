"""Bounded public inputs shared by all three providers."""

import base64
import binascii
import json
from typing import Any, Literal
from uuid import UUID

from jsonschema import Draft202012Validator, SchemaError
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

Provider = Literal["openai", "anthropic", "gemini"]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Message(StrictModel):
    role: Literal["system", "user", "assistant"]
    content: str = Field(min_length=1, max_length=20000)


class ChatRequest(StrictModel):
    provider: Provider = "openai"
    model: str | None = Field(default=None, pattern=r"^[a-zA-Z0-9_.:-]{1,100}$")
    messages: list[Message] = Field(min_length=1, max_length=30)
    json_schema: dict[str, Any] | None = None
    max_tokens: int = Field(default=1024, ge=16, le=4096)

    @field_validator("messages")
    @classmethod
    def bound_total_text(cls, value):
        if sum(len(message.content) for message in value) > 60000:
            raise ValueError("Messages exceed the 60000-character request limit")
        if not any(message.role == "user" for message in value):
            raise ValueError("At least one user message is required")
        return value

    @field_validator("json_schema")
    @classmethod
    def validate_schema(cls, value):
        if value is None:
            return value
        if len(json.dumps(value)) > 16000:
            raise ValueError("JSON schema exceeds 16000 characters")

        def inspect(node, depth=0):
            if depth > 12:
                raise ValueError("JSON schema is too deeply nested")
            if isinstance(node, dict):
                # Avoid remote resolution and attacker-controlled regular expressions.
                if any(
                    key in node for key in ("$ref", "$dynamicRef", "pattern", "patternProperties")
                ):
                    raise ValueError(
                        "References and regex patterns are unsupported in JSON schemas"
                    )
                for child in node.values():
                    inspect(child, depth + 1)
            elif isinstance(node, list):
                for child in node:
                    inspect(child, depth + 1)

        inspect(value)
        try:
            Draft202012Validator.check_schema(value)
        except SchemaError as exc:
            raise ValueError("Invalid JSON schema") from exc
        return value


class VisionRequest(StrictModel):
    provider: Provider = "openai"
    model: str | None = Field(default=None, pattern=r"^[a-zA-Z0-9_.:-]{1,100}$")
    prompt: str = Field(min_length=1, max_length=10000)
    media_type: Literal["image/png", "image/jpeg", "image/webp"]
    image_base64: str = Field(min_length=4, max_length=4194304)

    @model_validator(mode="after")
    def validate_image(self):
        try:
            raw = base64.b64decode(self.image_base64, validate=True)
        except (ValueError, binascii.Error) as exc:
            raise ValueError("Image must contain valid base64 without a data URL prefix") from exc
        valid = {
            "image/png": raw.startswith(b"\x89PNG\r\n\x1a\n"),
            "image/jpeg": raw.startswith(b"\xff\xd8\xff"),
            "image/webp": raw.startswith(b"RIFF") and raw[8:12] == b"WEBP",
        }
        if not raw or len(raw) > 3 * 1024 * 1024 or not valid[self.media_type]:
            raise ValueError("Image must match its media type and be at most 3 MiB")
        return self


class EmbeddingRequest(StrictModel):
    provider: Provider = "openai"
    model: str | None = Field(default=None, pattern=r"^[a-zA-Z0-9_.:-]{1,100}$")
    texts: list[str] = Field(min_length=1, max_length=32)

    @field_validator("texts")
    @classmethod
    def bound_texts(cls, value):
        if any(not text.strip() or len(text) > 8000 for text in value):
            raise ValueError("Each embedding input must contain 1-8000 characters")
        if sum(map(len, value)) > 100000:
            raise ValueError("Embedding batch exceeds 100000 characters")
        return value


class DocumentRequest(StrictModel):
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1, max_length=50000)
    project_id: UUID | None = None


class RAGRequest(StrictModel):
    query: str = Field(min_length=1, max_length=4000)
    top_k: int = Field(default=5, ge=1, le=10)
    project_id: UUID | None = None
    provider: Provider = "openai"
    model: str | None = Field(default=None, pattern=r"^[a-zA-Z0-9_.:-]{1,100}$")


class AgentRequest(StrictModel):
    goal: str = Field(min_length=1, max_length=4000)
    provider: Provider = "openai"
    model: str | None = Field(default=None, pattern=r"^[a-zA-Z0-9_.:-]{1,100}$")
    max_steps: int = Field(default=3, ge=1, le=5)


class ApprovalRequest(StrictModel):
    approve: bool
