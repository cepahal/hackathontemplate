"""Scripted stand-in for external HTTP APIs, built on httpx.MockTransport (no network)."""

import json
from collections.abc import Callable
from typing import Any

import httpx

Reply = httpx.Response | Exception | Callable[[httpx.Request], httpx.Response]


class MockApi:
    """Replies with `replies` in order (the last one repeats) and records every request."""

    def __init__(self, *replies: Reply) -> None:
        self._replies = list(replies) or [httpx.Response(200, json={})]
        self.requests: list[httpx.Request] = []

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        reply = self._replies.pop(0) if len(self._replies) > 1 else self._replies[0]
        if isinstance(reply, Exception):
            raise reply
        if isinstance(reply, httpx.Response):
            return reply
        return reply(request)

    def client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(transport=httpx.MockTransport(self.handler))

    @property
    def last(self) -> httpx.Request:
        return self.requests[-1]

    def body(self, index: int = -1) -> dict[str, Any]:
        payload: dict[str, Any] = json.loads(self.requests[index].content)
        return payload
