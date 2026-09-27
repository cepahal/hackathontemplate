from typing import Annotated

from fastapi import APIRouter, Depends

from app import __version__
from app.api.dependencies import get_settings
from app.core.config import Settings
from app.schemas.health import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health(settings: Annotated[Settings, Depends(get_settings)]) -> HealthResponse:
    """Report API liveness. Future database readiness belongs in a separate check."""
    return HealthResponse(environment=settings.app_env, version=__version__)
