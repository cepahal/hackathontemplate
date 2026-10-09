from app.core.errors import NotFoundError
from app.core.security import AuthenticatedUser
from app.db.supabase import UserDB
from app.modules.users.schemas import MeResponse

TABLE = "profiles"


async def get_me(db: UserDB, user: AuthenticatedUser) -> MeResponse:
    rows = await db.select(TABLE, filters={"id": user.id}, limit=1)
    if not rows:
        raise NotFoundError(
            "Profile not found. It is created by a database trigger on sign-up; "
            "check that databaseFINAL migrations are applied.",
            code="PROFILE_NOT_FOUND",
        )
    return MeResponse.model_validate({**rows[0], "role": user.role})
