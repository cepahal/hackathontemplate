"""Server-Sent Events in both directions.

Inbound: `parse_sse` turns a provider's SSE body into messages (OpenAI, Gemini and Anthropic all
stream SSE). Outbound: `encode_sse` / `sse_response` stream events from FastAPI to the browser.

Frontend protocol (one JSON object per `data:` line):
    event: start  data: {"id", "provider", "model"}
    event: delta  data: {"text"}
    event: done   data: {"id", "finish_reason", "usage"}
    event: error  data: {"code", "message"}
Exactly one of `done` / `error` ends every stream.
"""

import asyncio
import json
from collections.abc import AsyncGenerator, AsyncIterator
from contextlib import aclosing
from dataclasses import dataclass
from typing import TypeVar

from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.ai.schemas import StreamCompleted, StreamDelta, StreamFailed, StreamOut, StreamStarted
from app.integrations.errors import IntegrationInvalidResponseError, IntegrationTimeoutError

T = TypeVar("T")

SSE_HEADERS = {
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    # Stops nginx-style proxies from buffering the whole response.
    "X-Accel-Buffering": "no",
}


@dataclass(frozen=True, slots=True)
class SSEMessage:
    event: str
    data: str


async def parse_sse(lines: AsyncGenerator[str]) -> AsyncGenerator[SSEMessage]:
    """Minimal WHATWG event-stream parser: `event`/`data` fields, comments, blank-line dispatch.
    Closing this generator closes `lines` (and so the underlying HTTP response)."""
    event = "message"
    data: list[str] = []
    try:
        async for raw in lines:
            line = raw.rstrip("\r")
            if not line:
                if data:
                    yield SSEMessage(event, "\n".join(data))
                event, data = "message", []
                continue
            if line.startswith(":"):
                continue
            field, _, value = line.partition(":")
            value = value.removeprefix(" ")
            if field == "data":
                data.append(value)
            elif field == "event":
                event = value or "message"
        if data:
            yield SSEMessage(event, "\n".join(data))
    finally:
        await lines.aclose()


def json_event(service: str, message: SSEMessage) -> dict[str, object]:
    """Decodes an event's JSON payload. Provider stream content is untrusted: reject anything odd."""
    try:
        payload = json.loads(message.data)
    except ValueError:
        payload = None
    if not isinstance(payload, dict):
        raise IntegrationInvalidResponseError(service, "Received a malformed stream event", code="AI_MALFORMED_STREAM")
    return payload


async def with_deadline(iterator: AsyncGenerator[T], seconds: float, service: str) -> AsyncGenerator[T]:
    """Re-yields `iterator`, failing with INTEGRATION_TIMEOUT once `seconds` have elapsed overall."""
    loop = asyncio.get_running_loop()
    deadline = loop.time() + seconds
    try:
        while True:
            remaining = deadline - loop.time()
            if remaining <= 0:
                raise IntegrationTimeoutError(service, f"{service} stream exceeded {seconds:.0f}s")
            try:
                async with asyncio.timeout(remaining):
                    item = await anext(iterator)
            except StopAsyncIteration:
                return
            except TimeoutError:
                raise IntegrationTimeoutError(service, f"{service} stream exceeded {seconds:.0f}s") from None
            yield item
    finally:
        await iterator.aclose()


def encode_sse(event: str, data: BaseModel | dict[str, object]) -> str:
    payload = data.model_dump_json() if isinstance(data, BaseModel) else json.dumps(data, separators=(",", ":"))
    return f"event: {event}\ndata: {payload}\n\n"


_EVENT_NAMES: dict[type[BaseModel], str] = {
    StreamStarted: "start",
    StreamDelta: "delta",
    StreamCompleted: "done",
    StreamFailed: "error",
}


async def encode_stream(events: AsyncGenerator[StreamOut]) -> AsyncGenerator[str]:
    async with aclosing(events) as source:
        async for event in source:
            yield encode_sse(_EVENT_NAMES[type(event)], event)


def sse_response(body: AsyncIterator[str]) -> StreamingResponse:
    return StreamingResponse(body, media_type="text/event-stream", headers=SSE_HEADERS)
