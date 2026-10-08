"""Request bodies for /api/v1/ai. Hard caps here bound parsing; the configurable limits
(AI_MAX_PROMPT_CHARS, AI_MAX_CONTEXT_CHARS) are enforced by AIService with a 413.

There is deliberately no `model` field: models come from server configuration only, and
`provider` must be one of the configured providers."""

from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints

from app.ai.structured import StructuredSchemaName
from app.integrations.registry import AIProviderName

HARD_MAX_PROMPT_CHARS = 200_000
HARD_MAX_CONTEXT_CHARS = 500_000

PromptText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=HARD_MAX_PROMPT_CHARS)]
ContextText = Annotated[str, StringConstraints(max_length=HARD_MAX_CONTEXT_CHARS)]


class GenerateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    prompt: PromptText
    context: ContextText | None = None
    provider: AIProviderName | None = None


class StructuredRequest(GenerateRequest):
    output_schema: StructuredSchemaName = "generated_plan"
