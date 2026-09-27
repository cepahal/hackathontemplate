import asyncio
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.modules.ai.schemas import DocumentRequest, RAGRequest
from app.modules.ai.workflows import Workflows


class EmbeddingAI:
    settings = SimpleNamespace(embedding_provider="openai", embedding_model="test-embedding")

    def __init__(self):
        self.inputs = []
        self.messages = []

    async def embeddings(self, request):
        self.inputs.extend(request.texts)
        return {
            "provider": "openai",
            "model": "test-embedding",
            "vectors": [[0.01] * 1536 for _ in request.texts],
            "usage": {},
        }

    async def chat(self, request):
        self.messages = request.messages
        return {"text": "Supported answer [1]", "usage": {}}


class DocumentStore:
    owner_id = "test-owner"

    def __init__(self, matches=None, fail_chunks=False):
        self.calls = []
        self.matches = matches or []
        self.fail_chunks = fail_chunks

    def owned(self, **kwargs):
        return {"owner_id": f"eq.{self.owner_id}", **kwargs}

    async def request(self, method, resource, *, params=None, body=None):
        self.calls.append((method, resource, params, body))
        if resource == "document_chunks" and self.fail_chunks:
            raise HTTPException(503, "Chunk insert failed")
        if resource == "rpc/match_document_chunks":
            return self.matches
        return [body] if body else []

    async def get_one(self, *_args):
        raise HTTPException(404, "Project not found")


def test_ingestion_links_all_chunks_to_authenticated_owner_and_embedding_model():
    async def run():
        store, ai = DocumentStore(), EmbeddingAI()
        result = await Workflows(store, ai).ingest(
            DocumentRequest(title="Notes", content="meaningful text " * 500)
        )
        document = store.calls[0][3]
        chunks = store.calls[1][3]
        assert result["chunk_count"] == len(chunks) > 1
        assert document["owner_id"] == store.owner_id
        assert len(ai.inputs) == len(chunks)
        assert all(row["document_id"] == document["id"] for row in chunks)
        assert all(row["owner_id"] == store.owner_id for row in chunks)
        assert all(row["metadata"]["embedding_model"] == "openai:test-embedding" for row in chunks)
        assert all(len(row["content"]) <= 1800 for row in chunks)

    asyncio.run(run())


def test_failed_chunk_insert_compensates_only_the_new_owned_document():
    async def run():
        store = DocumentStore(fail_chunks=True)
        with pytest.raises(HTTPException) as caught:
            await Workflows(store, EmbeddingAI()).ingest(
                DocumentRequest(title="Notes", content="A document")
            )
        assert caught.value.status_code == 503
        inserted_id = store.calls[0][3]["id"]
        assert store.calls[-1][:3] == (
            "DELETE",
            "documents",
            {"owner_id": "eq.test-owner", "id": f"eq.{inserted_id}"},
        )

    asyncio.run(run())


def test_inaccessible_project_stops_ingestion_before_provider_spend_or_writes():
    async def run():
        store, ai = DocumentStore(), EmbeddingAI()
        with pytest.raises(HTTPException) as caught:
            await Workflows(store, ai).ingest(
                DocumentRequest(title="Notes", content="Private", project_id=uuid4())
            )
        assert caught.value.status_code == 404
        assert not ai.inputs and not store.calls

    asyncio.run(run())


def test_rag_preserves_citations_and_applies_embedding_model_and_project_filters():
    async def run():
        project_id = uuid4()
        matches = [
            {
                "document_id": str(uuid4()),
                "content": "Evidence for this question",
                "metadata": {"title": "Source", "chunk_index": 2},
                "similarity": 0.85,
            }
        ]
        store, ai = DocumentStore(matches), EmbeddingAI()
        result = await Workflows(store, ai).rag(RAGRequest(query="Question", project_id=project_id))
        assert result["citations"][0]["document_id"] == matches[0]["document_id"]
        assert result["citations"][0]["excerpt"] == matches[0]["content"]
        assert store.calls[0][3]["filter_project_id"] == str(project_id)
        assert store.calls[0][3]["filter_embedding_model"] == "openai:test-embedding"
        assert "untrusted" in ai.messages[0].content
        assert "[1] Source" in ai.messages[1].content

    asyncio.run(run())


def test_empty_retrieval_does_not_generate_an_unsupported_answer():
    async def run():
        store, ai = DocumentStore(), EmbeddingAI()
        result = await Workflows(store, ai).rag(RAGRequest(query="Question"))
        assert result["citations"] == []
        assert result["usage"] is None
        assert not ai.messages

    asyncio.run(run())
