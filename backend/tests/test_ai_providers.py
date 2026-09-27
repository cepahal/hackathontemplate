import asyncio
import base64
import json

import httpx
import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.modules.ai.config import AISettings
from app.modules.ai.providers import AIService
from app.modules.ai.schemas import ChatRequest, EmbeddingRequest, VisionRequest
from app.modules.ai.workflows import chunk_text


def settings(**overrides):
    return AISettings(
        _env_file=None,
        openai_api_key="test",
        anthropic_api_key="test",
        gemini_api_key="test",
        openai_model="test-model",
        anthropic_model="test-model",
        gemini_model="test-model",
        **overrides,
    )


def request(provider="openai", **extra):
    return ChatRequest(provider=provider, messages=[{"role": "user", "content": "Hello"}], **extra)


@pytest.mark.parametrize(
    "provider,payload",
    [
        (
            "openai",
            {
                "choices": [{"message": {"content": "Hello"}}],
                "usage": {"prompt_tokens": 10, "completion_tokens": 3},
            },
        ),
        (
            "anthropic",
            {
                "content": [{"type": "text", "text": "Hello"}],
                "usage": {"input_tokens": 10, "output_tokens": 3},
            },
        ),
        (
            "gemini",
            {
                "candidates": [{"content": {"parts": [{"text": "Hello"}]}}],
                "usageMetadata": {"promptTokenCount": 10, "candidatesTokenCount": 3},
            },
        ),
    ],
)
def test_provider_request_and_normalized_usage(provider, payload):
    async def run():
        def handle(req):
            body = json.loads(req.content)
            assert req.url.scheme == "https"
            if provider == "openai":
                assert req.headers["authorization"] == "Bearer test"
                assert body["messages"][0]["content"] == "Hello"
            elif provider == "anthropic":
                assert req.headers["anthropic-version"] == "2023-06-01"
            else:
                assert req.headers["x-goog-api-key"] == "test"
                assert body["contents"][0]["parts"][0]["text"] == "Hello"
            return httpx.Response(200, json=payload)

        async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as client:
            result = await AIService(settings(), client).chat(request(provider))
            assert result["text"] == "Hello"
            assert result["usage"] == {
                "input_tokens": 10,
                "output_tokens": 3,
                "estimated_cost_usd": None,
            }

    asyncio.run(run())


def test_retry_transient_error_but_never_retry_bad_credentials():
    async def run():
        calls = []

        def handle(req):
            calls.append(req)
            if len(calls) == 1:
                return httpx.Response(429, headers={"retry-after": "0"})
            return httpx.Response(200, json={"choices": [{"message": {"content": "OK"}}]})

        async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as client:
            service = AIService(settings(), client)

            async def no_wait(*_args):
                pass

            service.retry_delay = no_wait
            assert (await service.chat(request()))["text"] == "OK"
            assert len(calls) == 2
        calls.clear()

        def reject(req):
            calls.append(req)
            return httpx.Response(401, json={"message": "secret key must not be echoed"})

        async with httpx.AsyncClient(transport=httpx.MockTransport(reject)) as client:
            with pytest.raises(HTTPException) as error:
                await AIService(settings(), client).chat(request())
            assert error.value.status_code == 503
            assert "secret key" not in error.value.detail
            assert len(calls) == 1

    asyncio.run(run())


def test_structured_response_is_validated_locally():
    schema = {
        "type": "object",
        "properties": {"value": {"type": "integer"}},
        "required": ["value"],
        "additionalProperties": False,
    }

    async def run():
        transport = httpx.MockTransport(
            lambda _: httpx.Response(
                200, json={"choices": [{"message": {"content": '{"value":"not an integer"}'}}]}
            )
        )
        async with httpx.AsyncClient(transport=transport) as client:
            with pytest.raises(HTTPException) as error:
                await AIService(settings(), client).chat(request(json_schema=schema))
            assert error.value.status_code == 502

    asyncio.run(run())


def test_schema_cannot_fetch_remote_references():
    with pytest.raises(ValidationError):
        request(json_schema={"$ref": "https://example.invalid/private"})


def test_stream_preserves_framing_and_usage():
    async def run():
        payload = "\n".join(
            [
                "data: " + json.dumps({"choices": [{"delta": {"content": "Hello\nworld"}}]}),
                "",
                "data: "
                + json.dumps(
                    {"choices": [], "usage": {"prompt_tokens": 4, "completion_tokens": 3}}
                ),
                "",
                "data: [DONE]",
                "",
            ]
        )
        async with httpx.AsyncClient(
            transport=httpx.MockTransport(lambda _: httpx.Response(200, text=payload))
        ) as client:
            events = [event async for event in AIService(settings(), client).stream(request())]
        assert len(events) == 2
        assert events[0].startswith("event: delta\ndata: ")
        assert json.loads(events[0].split("data: ")[1])["delta"] == "Hello\nworld"
        assert json.loads(events[1].split("data: ")[1])["usage"]["input_tokens"] == 4

    asyncio.run(run())


def test_truncated_stream_is_not_reported_as_success():
    async def run():
        async with httpx.AsyncClient(
            transport=httpx.MockTransport(
                lambda _: httpx.Response(200, text='data: {"choices":[]}\n\n')
            )
        ) as client:
            with pytest.raises(HTTPException, match="completion event"):
                _ = [event async for event in AIService(settings(), client).stream(request())]

    asyncio.run(run())


def test_multiline_provider_sse_is_one_complete_event():
    async def run():
        payload = (
            'data: {"choices": [\ndata: {"delta":{"content":"OK"}}\ndata: ]}\n\ndata: [DONE]\n\n'
        )
        async with httpx.AsyncClient(
            transport=httpx.MockTransport(lambda _: httpx.Response(200, text=payload))
        ) as client:
            events = [event async for event in AIService(settings(), client).stream(request())]
        assert len(events) == 2
        assert json.loads(events[0].split("data: ")[1])["delta"] == "OK"

    asyncio.run(run())


@pytest.mark.parametrize(
    "provider,payload",
    [
        (
            "anthropic",
            'data: {"type":"message_start","message":{"usage":{"input_tokens":2}}}\n\n'
            'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"OK"}}\n\n'
            'data: {"type":"message_delta","usage":{"output_tokens":1}}\n\n'
            'data: {"type":"message_stop"}\n\n',
        ),
        (
            "gemini",
            'data: {"candidates":[{"content":{"parts":[{"text":"OK"}]},'
            '"finishReason":"STOP"}],"usageMetadata":{"promptTokenCount":2,"candidatesTokenCount":1}}\n\n',
        ),
    ],
)
def test_anthropic_and_gemini_stream_normalization(provider, payload):
    async def run():
        async with httpx.AsyncClient(
            transport=httpx.MockTransport(lambda _: httpx.Response(200, text=payload))
        ) as client:
            events = [
                event async for event in AIService(settings(), client).stream(request(provider))
            ]
        assert json.loads(events[0].split("data: ")[1])["delta"] == "OK"
        usage = json.loads(events[-1].split("data: ")[1])["usage"]
        assert usage["input_tokens"] == 2
        assert usage["output_tokens"] == 1

    asyncio.run(run())


def test_embeddings_reject_wrong_dimension_and_unsupported_provider():
    async def run():
        async with httpx.AsyncClient(
            transport=httpx.MockTransport(
                lambda _: httpx.Response(200, json={"data": [{"index": 0, "embedding": [1, 2]}]})
            )
        ) as client:
            with pytest.raises(HTTPException) as error:
                await AIService(settings(), client).embeddings(EmbeddingRequest(texts=["hello"]))
            assert error.value.status_code == 502
            with pytest.raises(HTTPException) as error:
                await AIService(settings(), client).embeddings(
                    EmbeddingRequest(provider="anthropic", texts=["hello"])
                )
            assert error.value.status_code == 422

    asyncio.run(run())


def test_cost_is_only_computed_from_explicit_prices():
    service = AIService(
        settings(ai_prices_per_million={"openai:test-model": {"input": 2, "output": 4}})
    )
    assert (
        service.usage("openai", "test-model", {"prompt_tokens": 1000, "completion_tokens": 500})[
            "estimated_cost_usd"
        ]
        == 0.004
    )
    assert service.usage("openai", "test-model", {})["estimated_cost_usd"] is None


def test_vision_rejects_mismatched_or_invalid_base64():
    with pytest.raises(ValidationError):
        VisionRequest(prompt="Describe", media_type="image/png", image_base64="not base64!")
    with pytest.raises(ValidationError):
        VisionRequest(
            prompt="Describe",
            media_type="image/png",
            image_base64=base64.b64encode(b"not a png").decode(),
        )


def test_chunking_covers_text_with_overlap_and_is_bounded():
    text = "0123456789" * 5000
    chunks = chunk_text(text)
    assert len(chunks) == 32
    assert chunks[0][-200:] == chunks[1][:200]
    assert chunks[-1].endswith(text[-200:])
    assert all(len(chunk) <= 1800 for chunk in chunks)
