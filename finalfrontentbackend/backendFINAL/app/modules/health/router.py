from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: Literal["ok"]


# HEAD is accepted because many uptime/keep-alive monitors probe with it by default.
@router.api_route("/health", methods=["GET", "HEAD"], response_model=HealthResponse)
async def health() -> HealthResponse:
    """Liveness only: the API process is serving requests. Does not check Supabase or other services."""
    return HealthResponse(status="ok")
