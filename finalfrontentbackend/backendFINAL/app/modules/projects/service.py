"""Project business logic. Every query is scoped to the caller's own projects, in addition to
the RLS policies the database applies to the caller's token."""

from uuid import UUID

from app.core.errors import BadRequestError, ConflictError, DatabaseError, NotFoundError
from app.core.security import AuthenticatedUser
from app.db.supabase import Filters, UserDB
from app.modules.projects.schemas import ProjectCreate, ProjectOut, ProjectStatus, ProjectUpdate

TABLE = "projects"


def _owned(user: AuthenticatedUser, **filters: str | UUID) -> Filters:
    """Ownership scope for project queries. Extend here (and in RLS) to give admins wider access."""
    return {**filters, "owner_id": user.id}


def project_not_found() -> NotFoundError:
    return NotFoundError("Project not found", code="PROJECT_NOT_FOUND")


def _name_taken() -> ConflictError:
    return ConflictError("You already have a project with this name", code="PROJECT_NAME_TAKEN")


async def list_projects(
    db: UserDB, user: AuthenticatedUser, *, status: ProjectStatus | None, limit: int, offset: int
) -> list[ProjectOut]:
    filters = _owned(user, status=status) if status else _owned(user)
    rows = await db.select(TABLE, filters=filters, order=[("created_at", "desc")], limit=limit, offset=offset)
    return [ProjectOut.model_validate(row) for row in rows]


async def find_project(db: UserDB, user: AuthenticatedUser, project_id: UUID) -> ProjectOut | None:
    rows = await db.select(TABLE, filters=_owned(user, id=project_id), limit=1)
    return ProjectOut.model_validate(rows[0]) if rows else None


async def get_project(db: UserDB, user: AuthenticatedUser, project_id: UUID) -> ProjectOut:
    project = await find_project(db, user, project_id)
    if project is None:
        raise project_not_found()
    return project


async def create_project(db: UserDB, user: AuthenticatedUser, data: ProjectCreate) -> ProjectOut:
    values = {**data.model_dump(mode="json"), "owner_id": str(user.id)}
    try:
        row = await db.insert(TABLE, values)
    except DatabaseError as exc:
        if exc.pg_code == "23505":
            raise _name_taken() from None
        raise
    return ProjectOut.model_validate(row)


async def update_project(db: UserDB, user: AuthenticatedUser, project_id: UUID, data: ProjectUpdate) -> ProjectOut:
    values = data.model_dump(mode="json", exclude_unset=True)
    if not values:
        raise BadRequestError("Provide at least one field to update", code="EMPTY_UPDATE")
    try:
        rows = await db.update(TABLE, filters=_owned(user, id=project_id), values=values)
    except DatabaseError as exc:
        if exc.pg_code == "23505":
            raise _name_taken() from None
        raise
    if not rows:
        raise project_not_found()
    return ProjectOut.model_validate(rows[0])


async def delete_project(db: UserDB, user: AuthenticatedUser, project_id: UUID) -> None:
    rows = await db.delete(TABLE, filters=_owned(user, id=project_id))
    if not rows:
        raise project_not_found()
