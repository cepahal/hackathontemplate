"""Shared FastAPI dependencies: settings, authentication, role checks, user-scoped DB."""

from collections.abc import Awaitable, Callable
from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import Settings
from app.core.errors import ForbiddenError, UnauthorizedError
from app.core.rate_limit import RateLimiter
from app.core.security import AuthenticatedUser, Role, TokenVerifier, has_role
from app.db.supabase import SupabaseRest, UserDB
from app.integrations.registry import Integrations

bearer_scheme = HTTPBearer(auto_error=False, description="Supabase access token of the signed-in user")


def get_settings(request: Request) -> Settings:
    settings: Settings = request.app.state.settings
    return settings


def get_token_verifier(request: Request) -> TokenVerifier:
    verifier: TokenVerifier = request.app.state.token_verifier
    return verifier


def get_supabase(request: Request) -> SupabaseRest:
    supabase: SupabaseRest = request.app.state.supabase
    return supabase


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    verifier: Annotated[TokenVerifier, Depends(get_token_verifier)],
) -> AuthenticatedUser:
    """Reads `Authorization: Bearer <token>`, verifies it and returns the user it belongs to.
    Missing, malformed, expired or forged tokens are rejected with 401."""
    if credentials is None:
        raise UnauthorizedError("Missing bearer token", code="UNAUTHORIZED")
    return await verifier.verify(credentials.credentials)


def require_role(minimum: Role) -> Callable[[AuthenticatedUser], Awaitable[AuthenticatedUser]]:
    """Dependency factory: authenticated user whose role ranks at least `minimum` (user < admin)."""

    async def dependency(
        user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    ) -> AuthenticatedUser:
        if not has_role(user.role, minimum):
            raise ForbiddenError(f"Requires the {minimum} role")
        return user

    dependency.__name__ = f"require_{minimum}"
    return dependency


require_user = require_role("user")
require_admin = require_role("admin")

CurrentUser = Annotated[AuthenticatedUser, Depends(require_user)]
AdminUser = Annotated[AuthenticatedUser, Depends(require_admin)]


def get_user_db(
    user: CurrentUser,
    supabase: Annotated[SupabaseRest, Depends(get_supabase)],
) -> UserDB:
    return supabase.as_user(user.access_token)


DB = Annotated[UserDB, Depends(get_user_db)]


def get_integrations(request: Request) -> Integrations:
    integrations: Integrations = request.app.state.integrations
    return integrations


def get_integration_rate_limiter(request: Request) -> RateLimiter:
    limiter: RateLimiter = request.app.state.integration_rate_limiter
    return limiter


async def rate_limited_user(
    user: CurrentUser,
    limiter: Annotated[RateLimiter, Depends(get_integration_rate_limiter)],
) -> AuthenticatedUser:
    """Signed-in user, limited to INTEGRATIONS_RATE_LIMIT_PER_MINUTE calls (protects paid APIs)."""
    limiter.check(str(user.id))
    return user


IntegrationsDep = Annotated[Integrations, Depends(get_integrations)]
RateLimitedUser = Annotated[AuthenticatedUser, Depends(rate_limited_user)]
