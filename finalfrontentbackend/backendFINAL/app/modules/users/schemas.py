from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.core.security import Role


class MeResponse(BaseModel):
    """The caller's profile (public.profiles). `role` comes from the verified token's app_metadata."""

    id: UUID
    email: str | None
    display_name: str | None
    avatar_url: str | None
    role: Role
    created_at: datetime
    updated_at: datetime
