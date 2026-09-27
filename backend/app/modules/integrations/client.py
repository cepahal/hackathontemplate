"""Bounded retries for reads only. Non-idempotent writes are never automatically retried."""

import asyncio
import math
import time
from collections import OrderedDict

import httpx
from fastapi import HTTPException

_cache: OrderedDict[str, tuple[float, dict]] = OrderedDict()


def cached(key: str):
    entry = _cache.get(key)
    if entry and entry[0] > time.monotonic():
        _cache.move_to_end(key)
        return entry[1]
    _cache.pop(key, None)
    return None


def remember(key: str, data: dict, ttl: int = 60):
    _cache[key] = (time.monotonic() + ttl, data)
    _cache.move_to_end(key)
    while len(_cache) > 256:
        _cache.popitem(last=False)


async def provider_request(method: str, url: str, **kwargs):
    attempts = 3 if method == "GET" else 1
    async with httpx.AsyncClient(timeout=12, follow_redirects=False) as client:
        for attempt in range(attempts):
            try:
                response = await client.request(method, url, **kwargs)
            except httpx.HTTPError as exc:
                if attempt + 1 < attempts:
                    await asyncio.sleep(0.25 * (2**attempt))
                    continue
                raise HTTPException(502, "External provider unavailable.") from exc
            if response.status_code in {429, 500, 502, 503, 504} and attempt + 1 < attempts:
                try:
                    delay = float(response.headers.get("Retry-After", "1"))
                    delay = min(max(delay, 0.1), 2) if math.isfinite(delay) else 1
                except ValueError:
                    delay = 1
                await asyncio.sleep(delay)
                continue
            if response.status_code == 429:
                raise HTTPException(
                    429, "External provider rate limit exceeded.", headers={"Retry-After": "5"}
                )
            if not 200 <= response.status_code < 300:
                raise HTTPException(
                    502,
                    "External provider rejected the request; check credentials and permissions.",
                )
            try:
                if len(response.content) > 2_000_000:
                    raise ValueError("Oversized response")
                return response.json(), response.headers
            except ValueError as exc:
                raise HTTPException(502, "External provider returned invalid JSON.") from exc
    raise HTTPException(502, "External provider unavailable.")
