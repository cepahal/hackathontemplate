"""Task business logic. A task is accessible only through a project the caller owns."""

from uuid import UUID

from app.core.errors import BadRequestError, DatabaseError, NotFoundError
from app.core.security import AuthenticatedUser
from app.db.supabase import Row, UserDB
from app.modules.projects import service as projects_service
from app.modules.tasks.schemas import TaskCreate, TaskOut, TaskUpdate

TABLE = "tasks"


def task_not_found() -> NotFoundError:
    return NotFoundError("Task not found", code="TASK_NOT_FOUND")


async def _get_owned_task(db: UserDB, user: AuthenticatedUser, task_id: UUID) -> Row:
    rows = await db.select(TABLE, filters={"id": task_id}, limit=1)
    if not rows:
        raise task_not_found()
    task = rows[0]
    # Someone else's task looks exactly like a missing one, so IDs can't be probed.
    if await projects_service.find_project(db, user, UUID(str(task["project_id"]))) is None:
        raise task_not_found()
    return task


async def list_tasks(
    db: UserDB, user: AuthenticatedUser, project_id: UUID, *, completed: bool | None, limit: int, offset: int
) -> list[TaskOut]:
    await projects_service.get_project(db, user, project_id)
    filters: dict[str, UUID | bool] = {"project_id": project_id}
    if completed is not None:
        filters["completed"] = completed
    rows = await db.select(TABLE, filters=filters, order=[("created_at", "desc")], limit=limit, offset=offset)
    return [TaskOut.model_validate(row) for row in rows]


async def create_task(db: UserDB, user: AuthenticatedUser, project_id: UUID, data: TaskCreate) -> TaskOut:
    await projects_service.get_project(db, user, project_id)
    values = {**data.model_dump(mode="json"), "project_id": str(project_id)}
    try:
        row = await db.insert(TABLE, values)
    except DatabaseError as exc:
        if exc.pg_code == "23503":  # project deleted between the check and the insert
            raise projects_service.project_not_found() from None
        raise
    return TaskOut.model_validate(row)


async def update_task(db: UserDB, user: AuthenticatedUser, task_id: UUID, data: TaskUpdate) -> TaskOut:
    values = data.model_dump(mode="json", exclude_unset=True)
    if not values:
        raise BadRequestError("Provide at least one field to update", code="EMPTY_UPDATE")
    task = await _get_owned_task(db, user, task_id)
    rows = await db.update(TABLE, filters={"id": task_id, "project_id": str(task["project_id"])}, values=values)
    if not rows:
        raise task_not_found()
    return TaskOut.model_validate(rows[0])


async def delete_task(db: UserDB, user: AuthenticatedUser, task_id: UUID) -> None:
    task = await _get_owned_task(db, user, task_id)
    rows = await db.delete(TABLE, filters={"id": task_id, "project_id": str(task["project_id"])})
    if not rows:
        raise task_not_found()
