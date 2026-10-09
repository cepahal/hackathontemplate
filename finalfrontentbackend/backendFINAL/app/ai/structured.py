"""Structured output pipeline:

    validated user input → versioned prompt → provider-native JSON-schema mode → raw JSON
    → Pydantic validation (extra keys rejected, bounds enforced) → typed object → database

Providers are asked for schema-shaped JSON, but that is a hint, not a guarantee: the model's reply
is always parsed and validated here. One retry is made when the reply fails validation, then the
request fails with AI_INVALID_STRUCTURED_OUTPUT (nothing invalid is ever stored as a result).
"""

import logging
from dataclasses import dataclass
from typing import Generic, Literal

from app.ai.prompts import PLAN_V1, PromptTemplate, RenderedPrompt
from app.ai.providers.base import AIProvider
from app.ai.schemas import GeneratedPlan, SchemaT
from app.integrations.errors import IntegrationInvalidResponseError

logger = logging.getLogger(__name__)

StructuredSchemaName = Literal["generated_plan"]

_RETRY_NOTE = (
    "Your previous reply did not match the required JSON schema. Reply again with only a JSON "
    "object that matches the schema exactly: no extra keys, no missing required keys."
)


@dataclass(frozen=True, slots=True)
class StructuredTask(Generic[SchemaT]):
    name: str
    schema: type[SchemaT]
    prompt: PromptTemplate


# Register new structured outputs here (and add the name to StructuredSchemaName).
STRUCTURED_TASKS: dict[StructuredSchemaName, StructuredTask[GeneratedPlan]] = {
    "generated_plan": StructuredTask("generated_plan", GeneratedPlan, PLAN_V1),
}


async def generate_validated(
    provider: AIProvider,
    task: StructuredTask[SchemaT],
    prompt: RenderedPrompt,
    *,
    max_tokens: int,
    attempts: int = 2,
) -> SchemaT:
    system = prompt.system
    for attempt in range(1, attempts + 1):
        try:
            return await provider.generate_structured(prompt.user, task.schema, system=system, max_tokens=max_tokens)
        except IntegrationInvalidResponseError as exc:
            if exc.code != "AI_INVALID_STRUCTURED_OUTPUT" or attempt == attempts:
                raise
            logger.warning(
                "%s returned invalid %s output (attempt %d/%d); retrying",
                provider.service_name,
                task.name,
                attempt,
                attempts,
            )
            system = f"{prompt.system}\n\n{_RETRY_NOTE}"
    raise AssertionError("unreachable")  # pragma: no cover
