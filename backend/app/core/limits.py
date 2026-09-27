"""Bound request size before decoding uploaded images or parsing JSON."""

from starlette.responses import JSONResponse


class RequestSizeLimitMiddleware:
    def __init__(self, app, max_bytes: int = 6_000_000):
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        chunks = []
        size = 0
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            chunk = message.get("body", b"")
            size += len(chunk)
            if size > self.max_bytes:
                response = JSONResponse(
                    {"error": {"code": "payload_too_large", "message": "Request exceeds 6 MB."}},
                    status_code=413,
                )
                await response(scope, receive, send)
                return
            chunks.append(chunk)
            if not message.get("more_body", False):
                break
        delivered = False

        async def replay():
            nonlocal delivered
            if not delivered:
                delivered = True
                return {"type": "http.request", "body": b"".join(chunks), "more_body": False}
            return await receive()

        await self.app(scope, replay, send)
