"""Domain models for the AI layer: generation results, history records, stream events, and the
example structured-output schema `GeneratedPlan`."""

from datetime import datetime
from typing import Any, Generic, Literal, TypeVar
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.integrations.ai.base import TokenUsage

GenerationType = Literal["text", "structured", "stream", "image", "file"]
GenerationStatus = Literal["pending", "completed", "failed", "cancelled"]

SchemaT = TypeVar("SchemaT", bound=BaseModel)


# --- Example structured output ----------------------------------------------------------
# Everything an LLM returns is validated against this before it is stored or returned:
# unknown keys are rejected (extra="forbid"), strings are bounded, enums are closed.


class PlanItem(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    title: str = Field(min_length=1, max_length=200, description="Short, actionable step")
    description: str = Field(default="", max_length=1000, description="Optional detail for the step")
    estimated_time: str = Field(min_length=1, max_length=50, description="Effort for this step, e.g. '2 hours'")


class GeneratedPlan(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    title: str = Field(min_length=1, max_length=200)
    summary: str = Field(min_length=1, max_length=2000)
    items: list[PlanItem] = Field(min_length=1, max_length=20)
    priority: Literal["low", "medium", "high", "critical"]
    estimated_time: str = Field(min_length=1, max_length=50, description="Total effort, e.g. '3 days'")


# --- Results -------------------------------------------------------------------------------


class ProviderInfo(BaseModel):
    name: str
    configured: bool
    default: bool
    model: str
    attachments: list[str]


class TextGeneration(BaseModel):
    id: UUID
    provider: str
    model: str
    text: str
    finish_reason: str | None = None
    usage: TokenUsage | None = None
    created_at: datetime


class StructuredGeneration(BaseModel, Generic[SchemaT]):
    id: UUID
    provider: str
    model: str
    schema_name: str
    data: SchemaT
    created_at: datetime


class GenerationRecord(BaseModel):
    """A row of public.ai_generations (databaseFINAL/migrations/007_ai_history.sql)."""

    id: UUID
    user_id: UUID
    provider: str
    model: str
    type: GenerationType
    status: GenerationStatus
    input: dict[str, Any]
    output: dict[str, Any] | None = None
    created_at: datetime


# --- Stream events (FastAPI → frontend, see app.ai.streaming) ------------------------------


class StreamStarted(BaseModel):
    id: UUID
    provider: str
    model: str


class StreamDelta(BaseModel):
    text: str


class StreamCompleted(BaseModel):
    id: UUID
    finish_reason: str | None = None
    usage: TokenUsage | None = None


class StreamFailed(BaseModel):
    code: str
    message: str


StreamOut = StreamStarted | StreamDelta | StreamCompleted | StreamFailed
