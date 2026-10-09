"""Request context middleware (request ID, access log, last-resort 500) and body size limits."""

import logging
import re
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response
from starlette.types import ASGIApp, Receive, Scope, Send

from app.core.errors import error_response
from app.core.logging import reset_request_id, set_request_id

_SAFE_REQUEST_ID = re.compile(r"^[A-Za-z0-9._-]{8,64}$")

logger = logging.getLogger("app.request")


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Logs method/path/status/duration only (never headers, tokens or bodies) and converts
    unhandled exceptions into the standard JSON 500. Added inside CORSMiddleware so browsers
    can read error responses too."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        incoming = request.headers.get("x-request-id", "")
        request_id = incoming if _SAFE_REQUEST_ID.match(incoming) else uuid.uuid4().hex
        token = set_request_id(request_id)
        started = time.perf_counter()
        try:
            try:
                response = await call_next(request)
            except Exception:
                logger.exception("Unhandled error on %s %s", request.method, request.url.path)
                response = error_response(500, "INTERNAL_ERROR", "Internal server error")
            response.headers["X-Request-ID"] = request_id
            logger.info(
                "%s %s -> %s (%.1f ms)",
                request.method,
                request.url.path,
                response.status_code,
                (time.perf_counter() - started) * 1000,
            )
            return response
        finally:
            reset_request_id(token)


class BodySizeLimitMiddleware:
    """Rejects request bodies over the limit on paths under `path_prefix` *before* they are read
    (FastAPI reads bodies before dependencies run, so this can't be a dependency). multipart/form-data
    gets `max_multipart_bytes`, everything else `max_bytes`. Requests with a body must declare
    Content-Length; chunked uploads of unknown size are refused."""

    def __init__(self, app: ASGIApp, *, path_prefix: str, max_bytes: int, max_multipart_bytes: int) -> None:
        self.app = app
        self.path_prefix = path_prefix
        self.max_bytes = max_bytes
        self.max_multipart_bytes = max_multipart_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope["method"] in {"GET", "HEAD", "OPTIONS", "DELETE"}:
            await self.app(scope, receive, send)
            return
        if not str(scope["path"]).startswith(self.path_prefix):
            await self.app(scope, receive, send)
            return
        headers = dict(scope["headers"])
        raw_length = headers.get(b"content-length")
        multipart = headers.get(b"content-type", b"").lower().startswith(b"multipart/form-data")
        limit = self.max_multipart_bytes if multipart else self.max_bytes
        if raw_length is None:
            response = error_response(411, "LENGTH_REQUIRED", "Content-Length header is required")
        elif not raw_length.isdigit() or int(raw_length) > limit:
            limit_kb = limit // 1024
            response = error_response(413, "PAYLOAD_TOO_LARGE", f"Request body must be at most {limit_kb} KB")
        else:
            await self.app(scope, receive, send)
            return
        await response(scope, receive, send)
