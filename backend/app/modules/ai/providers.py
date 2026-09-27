"""Small HTTP adapters with a common result and real provider SSE streaming."""

import asyncio
import json
import math
import re
from contextlib import asynccontextmanager

import httpx
from fastapi import HTTPException
from jsonschema import Draft202012Validator, ValidationError

from .config import AISettings
from .schemas import ChatRequest, EmbeddingRequest, VisionRequest

RETRY_STATUSES = {429, 500, 502, 503, 504, 529}


def sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


async def event_data(response: httpx.Response):
    """Assemble complete SSE data fields, including multiline events."""
    parts = []
    size = 0
    async for line in response.aiter_lines():
        if not line:
            if parts:
                yield "\n".join(parts)
                parts, size = [], 0
        elif line.startswith("data:"):
            value = line[5:].lstrip(" ")
            size += len(value)
            if size > 200000:
                raise HTTPException(502, "AI provider sent an oversized stream event")
            parts.append(value)
    if parts:
        yield "\n".join(parts)


class AIService:
    def __init__(self, settings: AISettings | None = None, client: httpx.AsyncClient | None = None):
        self.settings = settings or AISettings()
        self.client = client

    @asynccontextmanager
    async def connection(self):
        if self.client is not None:
            yield self.client
        else:
            async with httpx.AsyncClient(timeout=self.settings.ai_timeout_seconds) as client:
                yield client

    def resolve(self, provider: str, model: str | None = None):
        key = getattr(self.settings, f"{provider}_api_key", "")
        if not key:
            raise HTTPException(503, f"Configure {provider.upper()}_API_KEY on the backend")
        model = model or getattr(self.settings, f"{provider}_model", "")
        if not model:
            raise HTTPException(503, f"Configure {provider.upper()}_MODEL or supply a model ID")
        if not re.fullmatch(r"[a-zA-Z0-9_.:-]{1,100}", model):
            raise HTTPException(422, "Invalid provider model ID")
        headers = {"Content-Type": "application/json"}
        if provider == "openai":
            headers["Authorization"] = f"Bearer {key}"
            url = "https://api.openai.com/v1/chat/completions"
        elif provider == "anthropic":
            headers.update({"x-api-key": key, "anthropic-version": "2023-06-01"})
            url = "https://api.anthropic.com/v1/messages"
        elif provider == "gemini":
            headers["x-goog-api-key"] = key
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        else:
            raise HTTPException(422, "Unsupported provider")
        return model, url, headers

    async def retry_delay(self, attempt: int, response=None):
        delay = 0.25 * 2**attempt
        if response is not None:
            try:
                delay = min(5.0, max(delay, float(response.headers.get("retry-after", "0"))))
            except ValueError:
                pass
        await asyncio.sleep(delay)

    @staticmethod
    def provider_error(status: int):
        if status == 429:
            return HTTPException(429, "AI provider rate limit reached; retry later")
        if status in {401, 403}:
            return HTTPException(503, "AI provider rejected its server credential or model access")
        if status in {400, 404, 422}:
            return HTTPException(
                502, "AI provider rejected the model, schema, or request capability"
            )
        return HTTPException(502, "AI provider is unavailable")

    async def request_json(self, url: str, headers: dict, body: dict):
        async with self.connection() as client:
            for attempt in range(self.settings.ai_max_retries + 1):
                try:
                    response = await client.post(url, headers=headers, json=body)
                except httpx.TransportError as exc:
                    if attempt < self.settings.ai_max_retries:
                        await self.retry_delay(attempt)
                        continue
                    raise HTTPException(
                        502, "AI provider timed out or could not be reached"
                    ) from exc
                if (
                    response.status_code in RETRY_STATUSES
                    and attempt < self.settings.ai_max_retries
                ):
                    await self.retry_delay(attempt, response)
                    continue
                if response.is_error:
                    raise self.provider_error(response.status_code)
                try:
                    if len(response.content) > 2 * 1024 * 1024:
                        raise ValueError("Oversized response")
                    value = response.json()
                    if not isinstance(value, dict):
                        raise ValueError("Expected object")
                    return value
                except ValueError as exc:
                    raise HTTPException(502, "AI provider returned an invalid response") from exc

    def usage(self, provider: str, model: str, raw: dict):
        if not isinstance(raw, dict):
            raw = {}
        if provider == "openai":
            input_tokens, output_tokens = raw.get("prompt_tokens"), raw.get("completion_tokens")
        elif provider == "anthropic":
            input_tokens, output_tokens = raw.get("input_tokens"), raw.get("output_tokens")
        else:
            input_tokens = raw.get("promptTokenCount")
            output_tokens = raw.get("candidatesTokenCount")
            thoughts = raw.get("thoughtsTokenCount", 0)
            if isinstance(output_tokens, int) and isinstance(thoughts, int):
                output_tokens += thoughts
        input_tokens = input_tokens if isinstance(input_tokens, int) and input_tokens >= 0 else None
        output_tokens = (
            output_tokens if isinstance(output_tokens, int) and output_tokens >= 0 else None
        )
        prices = self.settings.ai_prices_per_million.get(f"{provider}:{model}")
        cost = None
        cache_used = raw.get("cache_read_input_tokens", 0) or raw.get(
            "cache_creation_input_tokens", 0
        )
        if prices and input_tokens is not None and output_tokens is not None and not cache_used:
            cost = (input_tokens * prices["input"] + output_tokens * prices["output"]) / 1_000_000
            if not math.isfinite(cost):
                cost = None
        return {
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "estimated_cost_usd": cost,
        }

    def payload(self, request: ChatRequest, model: str, image: VisionRequest | None = None):
        messages = [message.model_dump() for message in request.messages]
        if request.provider == "openai":
            if image:
                messages[-1]["content"] = [
                    {"type": "text", "text": image.prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{image.media_type};base64,{image.image_base64}"
                        },
                    },
                ]
            body = {
                "model": model,
                "messages": messages,
                "max_completion_tokens": request.max_tokens,
            }
            if request.json_schema is not None:
                body["response_format"] = {
                    "type": "json_schema",
                    "json_schema": {
                        "name": "result",
                        "strict": True,
                        "schema": request.json_schema,
                    },
                }
            return body
        system = "\n".join(item["content"] for item in messages if item["role"] == "system")
        regular = [item for item in messages if item["role"] != "system"]
        if request.provider == "anthropic":
            if image:
                regular[-1]["content"] = [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": image.media_type,
                            "data": image.image_base64,
                        },
                    },
                    {"type": "text", "text": image.prompt},
                ]
            body = {"model": model, "messages": regular, "max_tokens": request.max_tokens}
            if system:
                body["system"] = system
            if request.json_schema is not None:
                body["tools"] = [
                    {
                        "name": "structured_response",
                        "description": "Return the result",
                        "input_schema": request.json_schema,
                    }
                ]
                body["tool_choice"] = {"type": "tool", "name": "structured_response"}
            return body
        contents = [
            {
                "role": "model" if item["role"] == "assistant" else "user",
                "parts": [{"text": item["content"]}],
            }
            for item in regular
        ]
        if image:
            contents[-1]["parts"].append(
                {"inlineData": {"mimeType": image.media_type, "data": image.image_base64}}
            )
        body = {"contents": contents, "generationConfig": {"maxOutputTokens": request.max_tokens}}
        if system:
            body["systemInstruction"] = {"parts": [{"text": system}]}
        if request.json_schema is not None:
            body["generationConfig"].update(
                {"responseMimeType": "application/json", "responseJsonSchema": request.json_schema}
            )
        return body

    async def chat(self, request: ChatRequest, image: VisionRequest | None = None):
        model, url, headers = self.resolve(request.provider, request.model)
        raw = await self.request_json(url, headers, self.payload(request, model, image))
        structured = None
        try:
            if request.provider == "openai":
                text = raw["choices"][0]["message"].get("content")
                usage = raw.get("usage", {})
            elif request.provider == "anthropic":
                text = "".join(block["text"] for block in raw["content"] if block["type"] == "text")
                if request.json_schema is not None:
                    structured = next(
                        block["input"]
                        for block in raw["content"]
                        if block["type"] == "tool_use"
                        and block.get("name") == "structured_response"
                    )
                    text = json.dumps(structured)
                usage = raw.get("usage", {})
            else:
                text = "".join(
                    part.get("text", "")
                    for part in raw["candidates"][0]["content"]["parts"]
                    if not part.get("thought")
                )
                usage = raw.get("usageMetadata", {})
            if not isinstance(text, str) or not text.strip():
                raise ValueError("Empty or refused response")
            if request.json_schema is not None:
                structured = json.loads(text) if structured is None else structured
                json.dumps(structured, allow_nan=False)
                Draft202012Validator(request.json_schema).validate(structured)
        except (KeyError, IndexError, TypeError, ValueError, StopIteration, ValidationError) as exc:
            raise HTTPException(
                502, "AI response was empty, refused, or failed its JSON schema"
            ) from exc
        return {
            "provider": request.provider,
            "model": model,
            "text": text,
            "structured": structured,
            "usage": self.usage(request.provider, model, usage),
        }

    async def stream(self, request: ChatRequest):
        model, url, headers = self.resolve(request.provider, request.model)
        body = self.payload(request, model)
        if request.provider == "gemini":
            url = url.replace(":generateContent", ":streamGenerateContent?alt=sse")
        else:
            body["stream"] = True
            if request.provider == "openai":
                body["stream_options"] = {"include_usage": True}
        usage = {}
        completed = False
        total_chars = 0
        async with self.connection() as client:
            # Retries happen only before consuming any event; never replay partial output.
            for attempt in range(self.settings.ai_max_retries + 1):
                try:
                    async with client.stream("POST", url, headers=headers, json=body) as response:
                        if (
                            response.status_code in RETRY_STATUSES
                            and attempt < self.settings.ai_max_retries
                        ):
                            await response.aread()
                            await self.retry_delay(attempt, response)
                            continue
                        if response.is_error:
                            raise self.provider_error(response.status_code)
                        async for data in event_data(response):
                            if data == "[DONE]":
                                completed = True
                                break
                            try:
                                event = json.loads(data)
                                if "error" in event or event.get("type") == "error":
                                    raise HTTPException(502, "AI provider interrupted the stream")
                                delta = ""
                                if request.provider == "openai":
                                    choices = event.get("choices", [])
                                    if choices:
                                        delta = choices[0].get("delta", {}).get("content") or ""
                                    if event.get("usage"):
                                        usage = event["usage"]
                                elif request.provider == "anthropic":
                                    if event.get("type") == "content_block_delta":
                                        delta = event.get("delta", {}).get("text", "")
                                    if event.get("type") == "message_start":
                                        usage.update(event.get("message", {}).get("usage", {}))
                                    if event.get("usage"):
                                        usage.update(event["usage"])
                                    completed |= event.get("type") == "message_stop"
                                else:
                                    candidates = event.get("candidates", [])
                                    if candidates:
                                        candidate = candidates[0]
                                        delta = "".join(
                                            part.get("text", "")
                                            for part in candidate.get("content", {}).get(
                                                "parts", []
                                            )
                                            if not part.get("thought")
                                        )
                                        completed |= candidate.get("finishReason") in {
                                            "STOP",
                                            "MAX_TOKENS",
                                        }
                                    usage = event.get("usageMetadata", usage)
                                if delta:
                                    total_chars += len(delta)
                                    if total_chars > 100000:
                                        raise HTTPException(
                                            502, "AI stream exceeded its output limit"
                                        )
                                    yield sse("delta", {"delta": delta})
                            except (ValueError, KeyError, TypeError, AttributeError) as exc:
                                raise HTTPException(
                                    502, "AI provider sent an invalid stream event"
                                ) from exc
                        if not completed:
                            raise HTTPException(502, "AI stream ended before a completion event")
                        if total_chars == 0:
                            raise HTTPException(502, "AI stream returned no text or was refused")
                        yield sse(
                            "done",
                            {
                                "provider": request.provider,
                                "model": model,
                                "usage": self.usage(request.provider, model, usage),
                            },
                        )
                        return
                except httpx.TransportError as exc:
                    # Once streaming begins, retries could repeat already displayed output.
                    raise HTTPException(502, "AI stream connection was interrupted") from exc

    async def embeddings(self, request: EmbeddingRequest):
        if request.provider == "anthropic":
            raise HTTPException(422, "Anthropic embeddings are unsupported; use OpenAI or Gemini")
        default_model = (
            "text-embedding-3-small" if request.provider == "openai" else "gemini-embedding-001"
        )
        model, _, headers = self.resolve(request.provider, request.model or default_model)
        if request.provider == "openai":
            raw = await self.request_json(
                "https://api.openai.com/v1/embeddings",
                headers,
                {
                    "model": model,
                    "input": request.texts,
                    "dimensions": 1536,
                    "encoding_format": "float",
                },
            )
            try:
                vectors = [
                    item["embedding"]
                    for item in sorted(raw["data"], key=lambda item: item["index"])
                ]
            except (KeyError, TypeError) as exc:
                raise HTTPException(502, "Invalid embedding response") from exc
            usage = raw.get("usage", {})
        else:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:batchEmbedContents"
            raw = await self.request_json(
                url,
                headers,
                {
                    "requests": [
                        {
                            "model": f"models/{model}",
                            "content": {"parts": [{"text": text}]},
                            "embedContentConfig": {"outputDimensionality": 1536},
                        }
                        for text in request.texts
                    ]
                },
            )
            try:
                vectors = [item["values"] for item in raw["embeddings"]]
            except (KeyError, TypeError) as exc:
                raise HTTPException(502, "Invalid embedding response") from exc
            usage = raw.get("usageMetadata", {})
        if len(vectors) != len(request.texts) or any(
            not isinstance(vector, list)
            or len(vector) != 1536
            or any(type(value) not in (int, float) or not math.isfinite(value) for value in vector)
            or not any(value != 0 for value in vector)
            for vector in vectors
        ):
            raise HTTPException(502, "Embedding response has invalid values or dimensions")
        return {
            "provider": request.provider,
            "model": model,
            "dimensions": 1536,
            "vectors": vectors,
            "usage": self.usage(request.provider, model, usage),
        }
