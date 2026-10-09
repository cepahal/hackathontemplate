from fastapi import APIRouter

from app.api.deps import DB, CurrentUser
from app.core.errors import ErrorResponse
from app.modules.users import service
from app.modules.users.schemas import MeResponse

router = APIRouter(tags=["users"])


@router.get(
    "/me",
    response_model=MeResponse,
    responses={401: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
)
async def get_me(user: CurrentUser, db: DB) -> MeResponse:
    return await service.get_me(db, user)
