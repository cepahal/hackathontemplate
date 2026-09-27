from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import StreamingResponse
from pydantic import ValidationError

from app.modules.identity.dependencies import get_access_token, get_current_user
from app.modules.identity.schemas import AuthenticatedUser

from .config import AISettings
from .providers import AIService, sse
from .schemas import (
    AgentRequest,
    ApprovalRequest,
    ChatRequest,
    DocumentRequest,
    EmbeddingRequest,
    RAGRequest,
    VisionRequest,
)
from .storage import UserStore
from .workflows import Workflows

router = APIRouter(prefix="/ai", tags=["AI, documents, and agents"])
User = Annotated[AuthenticatedUser, Depends(get_current_user)]


def get_ai_service() -> AIService:
    try:
        return AIService(AISettings())
    except (ValidationError, ValueError) as exc:
        raise HTTPException(
            503, "AI configuration is invalid; check the backend environment"
        ) from exc


Service = Annotated[AIService, Depends(get_ai_service)]


def get_store(
    user: User, token: Annotated[str, Depends(get_access_token)], ai: Service
) -> UserStore:
    return UserStore(token, str(user.id), ai.settings)


Store = Annotated[UserStore, Depends(get_store)]


def get_workflows(store: Store, ai: Service) -> Workflows:
    return Workflows(store, ai)


Flow = Annotated[Workflows, Depends(get_workflows)]


@router.post("/chat")
async def chat(body: ChatRequest, _user: User, ai: Service):
    return await ai.chat(body)


@router.post("/chat/stream")
async def chat_stream(body: ChatRequest, _user: User, ai: Service):
    ai.resolve(body.provider, body.model)
    if body.json_schema is not None:
        raise HTTPException(422, "Use /ai/chat for a validated structured response")

    async def events():
        try:
            async for event in ai.stream(body):
                yield event
        except HTTPException as exc:
            yield sse("error", {"message": str(exc.detail)})

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/embeddings")
async def embeddings(body: EmbeddingRequest, _user: User, ai: Service):
    return await ai.embeddings(body)


@router.post("/vision")
async def vision(body: VisionRequest, _user: User, ai: Service):
    return await ai.chat(
        ChatRequest(
            provider=body.provider,
            model=body.model,
            messages=[{"role": "user", "content": body.prompt}],
            json_schema=VISION_SCHEMA,
        ),
        image=body,
    )


@router.post("/documents", status_code=201)
async def ingest_document(body: DocumentRequest, flow: Flow):
    return await flow.ingest(body)


@router.get("/documents")
async def documents(store: Store):
    return await store.request(
        "GET",
        "documents",
        params=store.owned(
            select="id,title,project_id,metadata,created_at", order="created_at.desc", limit="100"
        ),
    )


@router.delete("/documents/{document_id}", status_code=204)
async def delete_document(document_id: UUID, store: Store):
    await store.get_one("documents", str(document_id))
    await store.request("DELETE", "documents", params=store.owned(id=f"eq.{document_id}"))
    return Response(status_code=204)


@router.post("/rag/query")
async def rag_query(body: RAGRequest, flow: Flow):
    return await flow.rag(body)


@router.post("/agents/runs", status_code=201)
async def start_agent(body: AgentRequest, flow: Flow):
    return await flow.start_agent(body)


@router.get("/agents/runs")
async def agent_runs(store: Store):
    return await store.request(
        "GET", "agent_runs", params=store.owned(order="created_at.desc", limit="50")
    )


@router.get("/agents/runs/{run_id}")
async def get_agent_run(run_id: UUID, store: Store):
    return await store.get_one("agent_runs", str(run_id))


@router.post("/agents/runs/{run_id}/approve")
async def approve_run(run_id: UUID, body: ApprovalRequest, flow: Flow):
    return await flow.approve(str(run_id), body.approve)


VISION_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "summary": {"type": "string"},
        "detected_text": {"type": "string"},
        "objects": {"type": "array", "items": {"type": "string"}},
        "uncertainties": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["summary", "detected_text", "objects", "uncertainties"],
}
