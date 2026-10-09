"""ASGI entry point: `uvicorn app.main:app --reload --port 8000`."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import API_PREFIX, api_router
from app.core.config import Settings, get_settings
from app.core.errors import register_exception_handlers
from app.core.logging import configure_logging
from app.core.middleware import BodySizeLimitMiddleware, RequestContextMiddleware
from app.core.rate_limit import RateLimiter
from app.core.security import TokenVerifier
from app.db.supabase import SupabaseRest
from app.integrations.registry import Integrations


def ai_body_limits(settings: Settings) -> tuple[int, int]:
    """Largest legitimate /ai bodies: (JSON with max prompt + context, multipart with a max-size file).
    Characters are counted at 4 bytes (UTF-8 worst case); 16 KB covers JSON/multipart framing."""
    prompt_bytes = settings.ai_max_prompt_chars * 4
    framing = 16 * 1024
    json_limit = prompt_bytes + settings.ai_max_context_chars * 4 + framing
    return json_limit, settings.ai_max_file_bytes + prompt_bytes + framing


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        async with (
            httpx.AsyncClient(timeout=settings.supabase_timeout_seconds) as http,
            httpx.AsyncClient(follow_redirects=False) as integrations_http,
        ):
            app.state.supabase = SupabaseRest(settings, http)
            app.state.token_verifier = TokenVerifier(settings, http)
            app.state.integrations = Integrations(settings, integrations_http)
            yield

    docs_enabled = not settings.is_production
    app = FastAPI(
        title="Hackathon API",
        version="1.0.0",
        lifespan=lifespan,
        docs_url=f"{API_PREFIX}/docs" if docs_enabled else None,
        redoc_url=None,
        openapi_url=f"{API_PREFIX}/openapi.json" if docs_enabled else None,
    )
    app.state.settings = settings
    app.state.integration_rate_limiter = RateLimiter(settings.integrations_rate_limit_per_minute, 60.0)

    register_exception_handlers(app)
    # Starlette runs the last-added middleware first: CORS wraps everything, including 500s.
    json_limit, multipart_limit = ai_body_limits(settings)
    app.add_middleware(
        BodySizeLimitMiddleware,
        path_prefix=f"{API_PREFIX}/ai/",
        max_bytes=json_limit,
        max_multipart_bytes=multipart_limit,
    )
    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
        expose_headers=["X-Request-ID"],
        max_age=600,
    )
    app.include_router(api_router)
    return app


app = create_app()
