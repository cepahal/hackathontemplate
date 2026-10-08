from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query, Response, status

from app.api.deps import DB, CurrentUser
from app.core.errors import ErrorResponse
from app.modules.projects import service
from app.modules.projects.schemas import ProjectCreate, ProjectOut, ProjectStatus, ProjectUpdate

router = APIRouter(
    prefix="/projects",
    tags=["projects"],
    responses={401: {"model": ErrorResponse}, 422: {"model": ErrorResponse}},
)
NOT_FOUND: dict[int | str, dict[str, object]] = {404: {"model": ErrorResponse}}


@router.get("", response_model=list[ProjectOut])
async def list_projects(
    user: CurrentUser,
    db: DB,
    status_filter: Annotated[ProjectStatus | None, Query(alias="status")] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0, le=10_000)] = 0,
) -> list[ProjectOut]:
    return await service.list_projects(db, user, status=status_filter, limit=limit, offset=offset)


@router.post(
    "",
    response_model=ProjectOut,
    status_code=status.HTTP_201_CREATED,
    responses={409: {"model": ErrorResponse}},
)
async def create_project(body: ProjectCreate, user: CurrentUser, db: DB) -> ProjectOut:
    return await service.create_project(db, user, body)


@router.get("/{project_id}", response_model=ProjectOut, responses=NOT_FOUND)
async def get_project(project_id: UUID, user: CurrentUser, db: DB) -> ProjectOut:
    return await service.get_project(db, user, project_id)


@router.patch(
    "/{project_id}",
    response_model=ProjectOut,
    responses={**NOT_FOUND, 400: {"model": ErrorResponse}, 409: {"model": ErrorResponse}},
)
async def update_project(project_id: UUID, body: ProjectUpdate, user: CurrentUser, db: DB) -> ProjectOut:
    return await service.update_project(db, user, project_id, body)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT, responses=NOT_FOUND)
async def delete_project(project_id: UUID, user: CurrentUser, db: DB) -> Response:
    await service.delete_project(db, user, project_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
