"""Run from backend with: python -m uvicorn app.main:app --reload."""

import logging
from time import perf_counter
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import RequestResponseEndpoint
from starlette.responses import Response

from app import __version__
from app.api.router import api_router
from app.api.routes.health import router as health_router
from app.core.config import Settings
from app.core.errors import error_response, register_exception_handlers
from app.core.limits import RequestSizeLimitMiddleware

logger = logging.getLogger("uvicorn.error")


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()
    logger.setLevel(settings.log_level)
    app = FastAPI(
        title="Hackathon API",
        version=__version__,
        description=(
            "Authenticated hackathon APIs for projects, AI, integrations, billing and realtime."
        ),
        docs_url="/docs",
        redoc_url="/redoc",
    )
    app.state.settings = settings
    register_exception_handlers(app)

    @app.middleware("http")
    async def request_context(request: Request, call_next: RequestResponseEndpoint) -> Response:
        request.state.request_id = str(uuid4())
        started = perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            logger.exception("Unhandled request error request_id=%s", request.state.request_id)
            response = error_response(
                request, 500, "internal_error", "An unexpected server error occurred."
            )
        response.headers["X-Request-ID"] = request.state.request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Cache-Control"] = "no-store"
        logger.info(
            "%s %s status=%s duration_ms=%.1f request_id=%s",
            request.method,
            request.url.path,
            response.status_code,
            (perf_counter() - started) * 1000,
            request.state.request_id,
        )
        return response

    app.add_middleware(RequestSizeLimitMiddleware)
    # Add CORS last so that it also wraps error responses from request_context.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization", "Idempotency-Key"],
        expose_headers=["X-Request-ID"],
    )
    app.include_router(health_router)
    app.include_router(api_router, prefix="/api/v1")
    return app


app = create_app()
