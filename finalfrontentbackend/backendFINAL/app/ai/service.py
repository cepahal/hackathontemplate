"""AIService: the one entry point the API uses for AI work.

    request → size checks → provider resolution → versioned prompt → provider adapter (LLM API)
    → validation → ai_generations row → typed result

Not tied to a provider: callers may name one of the *configured* providers (never a model), or
get the default (AI_DEFAULT_PROVIDER, else the first configured one that supports the input).
Failed generations are recorded too (status "failed" with the error code), streams that the
client abandons are recorded as "cancelled".
"""

import logging
from collections.abc import AsyncGenerator, Awaitable
from contextlib import aclosing
from typing import Any

import anyio

from app.ai.files import IngestedFile, UnsupportedFileError
from app.ai.history import AIHistoryRepository
from app.ai.prompts import ASSISTANT_V1, DOCUMENT_ANALYSIS_V1, IMAGE_ANALYSIS_V1, RenderedPrompt
from app.ai.providers.base import AIProvider, StreamEnd, TextDelta
from app.ai.schemas import (
    GeneratedPlan,
    GenerationRecord,
    GenerationStatus,
    GenerationType,
    ProviderInfo,
    StreamCompleted,
    StreamDelta,
    StreamFailed,
    StreamOut,
    StreamStarted,
    StructuredGeneration,
    TextGeneration,
)
from app.ai.streaming import with_deadline
from app.ai.structured import STRUCTURED_TASKS, StructuredSchemaName, generate_validated
from app.core.config import Settings
from app.core.errors import AppError, PayloadTooLargeError
from app.integrations.ai.base import TextResult
from app.integrations.errors import IntegrationNotConfiguredError
from app.integrations.registry import AI_PROVIDER_NAMES, AIProviderName, Integrations

logger = logging.getLogger(__name__)

CONTEXT_PREVIEW_CHARS = 2000
ANY_AI_KEY = "OPENAI_API_KEY, GEMINI_API_KEY, ANTHROPIC_API_KEY or GROK_API_KEY"


def _text_output(result: TextResult) -> dict[str, Any]:
    return {
        "text": result.text,
        "finish_reason": result.finish_reason,
        "usage": result.usage.model_dump() if result.usage else None,
    }


def _error_output(exc: AppError) -> dict[str, Any]:
    return {"error": {"code": exc.code, "message": exc.message}}


class AIService:
    def __init__(self, integrations: Integrations, history: AIHistoryRepository, settings: Settings) -> None:
        self._integrations = integrations
        self._history = history
        self._settings = settings

    # --- providers -----------------------------------------------------------------------

    def providers(self) -> list[ProviderInfo]:
        default = self._default_name()
        return [
            ProviderInfo(
                name=name,
                configured=(provider := self._integrations.ai(name)).configured,
                default=name == default,
                model=provider.default_model,
                attachments=sorted(provider.supported_attachments),
            )
            for name in AI_PROVIDER_NAMES
        ]

    def _default_name(self) -> AIProviderName | None:
        if self._settings.ai_default_provider is not None:
            return self._settings.ai_default_provider
        return next((name for name in AI_PROVIDER_NAMES if self._integrations.ai(name).configured), None)

    def resolve_provider(self, name: AIProviderName | None = None, *, media_type: str | None = None) -> AIProvider:
        """A configured provider (that accepts `media_type`, when given). Never an unconfigured one."""
        if name is None and self._settings.ai_default_provider is not None:
            name = self._settings.ai_default_provider
        if name is not None:
            provider = self._integrations.ai(name)
            if not provider.configured:
                raise IntegrationNotConfiguredError(name, provider.env_var)
            if media_type is not None and not provider.supports(media_type):
                raise UnsupportedFileError(f"{name} cannot read {media_type} input", code="PROVIDER_UNSUPPORTED_INPUT")
            return provider

        configured = [self._integrations.ai(n) for n in AI_PROVIDER_NAMES if self._integrations.ai(n).configured]
        if not configured:
            raise IntegrationNotConfiguredError("ai", ANY_AI_KEY)
        for provider in configured:
            if media_type is None or provider.supports(media_type):
                return provider
        raise UnsupportedFileError(
            f"No configured AI provider can read {media_type} input", code="PROVIDER_UNSUPPORTED_INPUT"
        )

    # --- generation ----------------------------------------------------------------------

    async def generate_text(
        self, user_input: str, *, context: str | None = None, provider: AIProviderName | None = None
    ) -> TextGeneration:
        self._check_sizes(user_input, context)
        ai = self.resolve_provider(provider)
        prompt = ASSISTANT_V1.render(user_input, context)
        call = ai.generate_text(prompt.user, system=prompt.system, max_tokens=self._settings.ai_max_output_tokens)
        return await self._run_text("text", ai, self._input(prompt, user_input, context), call)

    async def generate_structured(
        self,
        schema_name: StructuredSchemaName,
        user_input: str,
        *,
        context: str | None = None,
        provider: AIProviderName | None = None,
    ) -> StructuredGeneration[GeneratedPlan]:
        self._check_sizes(user_input, context)
        task = STRUCTURED_TASKS[schema_name]
        ai = self.resolve_provider(provider)
        prompt = task.prompt.render(user_input, context)
        input_payload = self._input(prompt, user_input, context, schema=schema_name)
        try:
            data = await generate_validated(ai, task, prompt, max_tokens=self._settings.ai_max_output_tokens)
        except AppError as exc:
            await self._record_failure("structured", ai, input_payload, exc)
            raise
        record = await self._history.create(
            provider=ai.service_name,
            model=ai.default_model,
            type="structured",
            status="completed",
            input=input_payload,
            output={"data": data.model_dump(mode="json")},
        )
        return StructuredGeneration[GeneratedPlan](
            id=record.id,
            provider=record.provider,
            model=record.model,
            schema_name=schema_name,
            data=data,
            created_at=record.created_at,
        )

    async def analyze_image(
        self, image: IngestedFile, instruction: str, *, provider: AIProviderName | None = None
    ) -> TextGeneration:
        if image.kind != "image":
            raise UnsupportedFileError("Only images can be analysed here")
        self._check_sizes(instruction, None)
        ai = self.resolve_provider(provider, media_type=image.media_type)
        prompt = IMAGE_ANALYSIS_V1.render(instruction)
        call = ai.analyze_image(
            image.attachment(), prompt.user, system=prompt.system, max_tokens=self._settings.ai_max_output_tokens
        )
        return await self._run_text("image", ai, self._input(prompt, instruction, None, file=image.info()), call)

    async def analyze_file(
        self, file: IngestedFile, instruction: str, *, provider: AIProviderName | None = None
    ) -> TextGeneration:
        """Text files become prompt context; PDFs and images go to the provider as attachments."""
        self._check_sizes(instruction, file.text)
        max_tokens = self._settings.ai_max_output_tokens
        if file.text is not None:
            ai = self.resolve_provider(provider)
            prompt = DOCUMENT_ANALYSIS_V1.render(instruction, file.text)
            call = ai.generate_text(prompt.user, system=prompt.system, max_tokens=max_tokens)
        else:
            ai = self.resolve_provider(provider, media_type=file.media_type)
            prompt = DOCUMENT_ANALYSIS_V1.render(instruction)
            call = ai.analyze_image(file.attachment(), prompt.user, system=prompt.system, max_tokens=max_tokens)
        return await self._run_text("file", ai, self._input(prompt, instruction, None, file=file.info()), call)

    async def start_stream(
        self, user_input: str, *, context: str | None = None, provider: AIProviderName | None = None
    ) -> "StreamSession":
        """Validates and records a pending generation before any bytes are sent, so input and
        configuration errors still return normal HTTP error responses."""
        self._check_sizes(user_input, context)
        ai = self.resolve_provider(provider)
        prompt = ASSISTANT_V1.render(user_input, context)
        record = await self._history.create(
            provider=ai.service_name,
            model=ai.default_model,
            type="stream",
            status="pending",
            input=self._input(prompt, user_input, context),
        )
        return StreamSession(ai, prompt, record, self._history, self._settings)

    async def history(self, *, limit: int, offset: int, type: GenerationType | None = None) -> list[GenerationRecord]:
        return await self._history.list(limit=limit, offset=offset, type=type)

    # --- helpers -------------------------------------------------------------------------

    def _check_sizes(self, user_input: str, context: str | None) -> None:
        if len(user_input) > self._settings.ai_max_prompt_chars:
            raise PayloadTooLargeError(
                f"Prompts are limited to {self._settings.ai_max_prompt_chars} characters", code="PROMPT_TOO_LARGE"
            )
        if context and len(context) > self._settings.ai_max_context_chars:
            raise PayloadTooLargeError(
                f"Context is limited to {self._settings.ai_max_context_chars} characters", code="CONTEXT_TOO_LARGE"
            )

    @staticmethod
    def _input(prompt: RenderedPrompt, user_input: str, context: str | None, **extra: object) -> dict[str, Any]:
        payload: dict[str, Any] = {"prompt": user_input, "prompt_id": prompt.prompt_id, **extra}
        if context:
            payload["context_chars"] = len(context)
            payload["context_preview"] = context[:CONTEXT_PREVIEW_CHARS]
        return payload

    async def _run_text(
        self, type: GenerationType, ai: AIProvider, input_payload: dict[str, Any], call: Awaitable[TextResult]
    ) -> TextGeneration:
        try:
            result = await call
        except AppError as exc:
            await self._record_failure(type, ai, input_payload, exc)
            raise
        record = await self._history.create(
            provider=result.provider,
            model=result.model,
            type=type,
            status="completed",
            input=input_payload,
            output=_text_output(result),
        )
        return TextGeneration(
            id=record.id,
            provider=result.provider,
            model=result.model,
            text=result.text,
            finish_reason=result.finish_reason,
            usage=result.usage,
            created_at=record.created_at,
        )

    async def _record_failure(
        self, type: GenerationType, ai: AIProvider, input_payload: dict[str, Any], exc: AppError
    ) -> None:
        try:
            await self._history.create(
                provider=ai.service_name,
                model=ai.default_model,
                type=type,
                status="failed",
                input=input_payload,
                output=_error_output(exc),
            )
        except AppError as record_exc:
            # Never mask the provider error with a bookkeeping error.
            logger.warning("Could not record failed %s generation: %s", type, record_exc.code)


class StreamSession:
    def __init__(
        self,
        provider: AIProvider,
        prompt: RenderedPrompt,
        record: GenerationRecord,
        history: AIHistoryRepository,
        settings: Settings,
    ) -> None:
        self.provider = provider
        self.prompt = prompt
        self.record = record
        self._history = history
        self._settings = settings

    async def events(self) -> AsyncGenerator[StreamOut]:
        """start → delta* → done | error. Always finalises the history row, even when the client
        disconnects mid-stream (status "cancelled")."""
        parts: list[str] = []
        end: StreamEnd | None = None
        error: AppError | None = None
        status: GenerationStatus = "cancelled"
        try:
            yield StreamStarted(id=self.record.id, provider=self.provider.service_name, model=self.record.model)
            upstream = self.provider.stream_text(
                self.prompt.user, system=self.prompt.system, max_tokens=self._settings.ai_max_output_tokens
            )
            deadline = with_deadline(upstream, self._settings.ai_stream_timeout_seconds, self.provider.service_name)
            async with aclosing(deadline) as events:
                async for event in events:
                    if isinstance(event, TextDelta):
                        parts.append(event.text)
                        yield StreamDelta(text=event.text)
                    else:
                        end = event
            status = "completed"
            yield StreamCompleted(
                id=self.record.id,
                finish_reason=end.finish_reason if end else None,
                usage=end.usage if end else None,
            )
        except AppError as exc:
            status, error = "failed", exc
            yield StreamFailed(code=exc.code, message=exc.message)
        except Exception:
            logger.exception("Unexpected error while streaming from %s", self.provider.service_name)
            status = "failed"
            error = AppError("The stream failed unexpectedly")
            yield StreamFailed(code=error.code, message=error.message)
        finally:
            with anyio.CancelScope(shield=True):
                await self._finish(status, "".join(parts), end, error)

    async def _finish(self, status: GenerationStatus, text: str, end: StreamEnd | None, error: AppError | None) -> None:
        output: dict[str, Any] = {
            "text": text,
            "finish_reason": end.finish_reason if end else None,
            "usage": end.usage.model_dump() if end and end.usage else None,
        }
        if error is not None:
            output.update(_error_output(error))
        try:
            await self._history.finish(
                self.record.id, status=status, model=end.model if end else self.record.model, output=output
            )
        except AppError as exc:
            logger.warning("Could not finalise streamed generation %s: %s", self.record.id, exc.code)
