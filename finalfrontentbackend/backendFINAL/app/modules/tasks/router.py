from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query, Response, status

from app.api.deps import DB, CurrentUser
from app.core.errors import ErrorResponse
from app.modules.tasks import service
from app.modules.tasks.schemas import TaskCreate, TaskOut, TaskUpdate

router = APIRouter(
    tags=["tasks"],
    responses={401: {"model": ErrorResponse}, 404: {"model": ErrorResponse}, 422: {"model": ErrorResponse}},
)


@router.get("/projects/{project_id}/tasks", response_model=list[TaskOut])
async def list_tasks(
    project_id: UUID,
    user: CurrentUser,
    db: DB,
    completed: bool | None = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
    offset: Annotated[int, Query(ge=0, le=10_000)] = 0,
) -> list[TaskOut]:
    return await service.list_tasks(db, user, project_id, completed=completed, limit=limit, offset=offset)


@router.post("/projects/{project_id}/tasks", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
async def create_task(project_id: UUID, body: TaskCreate, user: CurrentUser, db: DB) -> TaskOut:
    return await service.create_task(db, user, project_id, body)


@router.patch("/tasks/{task_id}", response_model=TaskOut, responses={400: {"model": ErrorResponse}})
async def update_task(task_id: UUID, body: TaskUpdate, user: CurrentUser, db: DB) -> TaskOut:
    return await service.update_task(db, user, task_id, body)


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(task_id: UUID, user: CurrentUser, db: DB) -> Response:
    await service.delete_task(db, user, task_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
