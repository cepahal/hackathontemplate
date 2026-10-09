"""/api/v1/ai — authenticated AI endpoints. Generation endpoints are rate limited per user;
request bodies are size-limited before parsing (BodySizeLimitMiddleware)."""

from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from fastapi.responses import StreamingResponse

from app.ai.files import FileKind, IngestedFile, ingest_file
from app.ai.history import AIHistoryRepository
from app.ai.schemas import (
    GeneratedPlan,
    GenerationRecord,
    GenerationType,
    ProviderInfo,
    StructuredGeneration,
    TextGeneration,
)
from app.ai.service import AIService
from app.ai.streaming import encode_stream, sse_response
from app.api.deps import DB, CurrentUser, IntegrationsDep, RateLimitedUser, get_settings
from app.core.config import Settings
from app.core.errors import ErrorResponse
from app.integrations.registry import AIProviderName
from app.modules.ai.schemas import HARD_MAX_PROMPT_CHARS, GenerateRequest, StructuredRequest

ERRORS: dict[int | str, dict[str, object]] = {
    code: {"model": ErrorResponse} for code in (401, 411, 413, 415, 422, 429, 502, 503, 504)
}

router = APIRouter(prefix="/ai", tags=["ai"], responses=ERRORS)

SettingsDep = Annotated[Settings, Depends(get_settings)]
UploadPrompt = Annotated[str, Form(min_length=1, max_length=HARD_MAX_PROMPT_CHARS, pattern=r"\S")]
UploadProvider = Annotated[AIProviderName | None, Form()]

IMAGE_KINDS: frozenset[FileKind] = frozenset({"image"})
FILE_KINDS: frozenset[FileKind] = frozenset({"text", "pdf", "image"})


def get_ai_service(user: CurrentUser, db: DB, integrations: IntegrationsDep, settings: SettingsDep) -> AIService:
    return AIService(integrations, AIHistoryRepository(db, user), settings)


AIServiceDep = Annotated[AIService, Depends(get_ai_service)]


async def _read_upload(upload: UploadFile, settings: Settings, allowed: frozenset[FileKind]) -> IngestedFile:
    data = await upload.read(settings.ai_max_file_bytes + 1)
    return ingest_file(
        upload.filename,
        data,
        allowed_kinds=allowed,
        max_bytes=settings.ai_max_file_bytes,
        max_text_chars=settings.ai_max_context_chars,
    )


@router.get("/providers", response_model=list[ProviderInfo])
async def list_providers(_: CurrentUser, ai: AIServiceDep) -> list[ProviderInfo]:
    """Which providers are configured (booleans and model names only; never keys)."""
    return ai.providers()


@router.post("/generate", response_model=TextGeneration)
async def generate(body: GenerateRequest, _: RateLimitedUser, ai: AIServiceDep) -> TextGeneration:
    return await ai.generate_text(body.prompt, context=body.context, provider=body.provider)


@router.post("/structured", response_model=StructuredGeneration[GeneratedPlan])
async def generate_structured(
    body: StructuredRequest, _: RateLimitedUser, ai: AIServiceDep
) -> StructuredGeneration[GeneratedPlan]:
    return await ai.generate_structured(body.output_schema, body.prompt, context=body.context, provider=body.provider)


@router.post(
    "/stream",
    response_class=StreamingResponse,
    responses={200: {"content": {"text/event-stream": {}}, "description": "SSE: start, delta*, done | error"}},
)
async def stream(body: GenerateRequest, _: RateLimitedUser, ai: AIServiceDep) -> StreamingResponse:
    session = await ai.start_stream(body.prompt, context=body.context, provider=body.provider)
    return sse_response(encode_stream(session.events()))


@router.post("/analyze-image", response_model=TextGeneration)
async def analyze_image(
    _: RateLimitedUser,
    ai: AIServiceDep,
    settings: SettingsDep,
    file: Annotated[UploadFile, File(description="PNG, JPEG, WebP or GIF")],
    prompt: UploadPrompt,
    provider: UploadProvider = None,
) -> TextGeneration:
    image = await _read_upload(file, settings, IMAGE_KINDS)
    return await ai.analyze_image(image, prompt.strip(), provider=provider)


@router.post("/analyze-file", response_model=TextGeneration)
async def analyze_file(
    _: RateLimitedUser,
    ai: AIServiceDep,
    settings: SettingsDep,
    file: Annotated[UploadFile, File(description="TXT/MD, PDF or image")],
    prompt: UploadPrompt,
    provider: UploadProvider = None,
) -> TextGeneration:
    document = await _read_upload(file, settings, FILE_KINDS)
    return await ai.analyze_file(document, prompt.strip(), provider=provider)


@router.get("/history", response_model=list[GenerationRecord])
async def history(
    _: CurrentUser,
    ai: AIServiceDep,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0, le=10_000)] = 0,
    type: Annotated[GenerationType | None, Query()] = None,
) -> list[GenerationRecord]:
    return await ai.history(limit=limit, offset=offset, type=type)
