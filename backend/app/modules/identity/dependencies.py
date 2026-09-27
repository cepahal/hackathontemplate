from collections.abc import AsyncIterator
from typing import Annotated

import httpx
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import ValidationError

from app.modules.identity.client import SupabaseGateway
from app.modules.identity.schemas import AuthenticatedUser
from app.modules.identity.settings import IdentitySettings

bearer = HTTPBearer(auto_error=False)


def get_access_token(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> str:
    if (
        credentials is None
        or credentials.scheme.lower() != "bearer"
        or not credentials.credentials
        or len(credentials.credentials) > 8192
        or any(character.isspace() for character in credentials.credentials)
    ):
        raise HTTPException(401, "Sign in to continue.", headers={"WWW-Authenticate": "Bearer"})
    return credentials.credentials


def get_identity_settings() -> IdentitySettings:
    try:
        settings = IdentitySettings()
    except (ValidationError, ValueError) as exc:
        raise HTTPException(503, "Supabase identity configuration is invalid.") from exc
    if not settings.supabase_url or not settings.supabase_anon_key.get_secret_value():
        raise HTTPException(503, "Supabase identity is not configured.")
    return settings


async def get_supabase_gateway(
    token: Annotated[str, Depends(get_access_token)],
    settings: Annotated[IdentitySettings, Depends(get_identity_settings)],
) -> AsyncIterator[SupabaseGateway]:
    async with httpx.AsyncClient(timeout=httpx.Timeout(10.0), follow_redirects=False) as client:
        yield SupabaseGateway(settings, client, token)


async def get_current_user(
    gateway: Annotated[SupabaseGateway, Depends(get_supabase_gateway)],
) -> AuthenticatedUser:
    # Supabase validates expiry/signature/session; client-supplied IDs are never accepted.
    data = await gateway.request("GET", "/auth/v1/user")
    if not isinstance(data, dict):
        raise HTTPException(502, "The identity service returned an invalid user.")
    metadata = data.get("app_metadata")
    role = "admin" if isinstance(metadata, dict) and metadata.get("role") == "admin" else "user"
    try:
        return AuthenticatedUser(id=data.get("id"), email=data.get("email"), role=role)
    except ValidationError as exc:
        raise HTTPException(502, "The identity service returned an invalid user.") from exc


async def require_admin(
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
) -> AuthenticatedUser:
    if user.role != "admin":
        raise HTTPException(403, "Administrator access is required.")
    return user
