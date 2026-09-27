"""Register future feature routers here; main.py supplies the /api/v1 prefix."""

from fastapi import APIRouter

from app.modules.ai import router as ai_router
from app.modules.commerce import router as commerce_router
from app.modules.identity import router as identity_router
from app.modules.integrations import router as integrations_router
from app.modules.realtime import router as realtime_router

api_router = APIRouter()
api_router.include_router(ai_router)
api_router.include_router(identity_router)
api_router.include_router(commerce_router)
api_router.include_router(integrations_router)
api_router.include_router(realtime_router)
