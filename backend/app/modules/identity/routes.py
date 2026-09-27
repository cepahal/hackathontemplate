from datetime import UTC, datetime
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import ValidationError

from app.modules.identity.client import SupabaseGateway
from app.modules.identity.dependencies import get_current_user, get_supabase_gateway
from app.modules.identity.schemas import (
    AuthenticatedUser,
    MemberCreate,
    MemberList,
    Notification,
    NotificationList,
    NotificationUpdate,
    Project,
    ProjectCreate,
    ProjectList,
    ProjectMember,
    ProjectUpdate,
)

router = APIRouter(tags=["identity and projects"])
User = Annotated[AuthenticatedUser, Depends(get_current_user)]
Gateway = Annotated[SupabaseGateway, Depends(get_supabase_gateway)]
PROJECT_COLUMNS = "id,owner_id,name,description,created_at,updated_at"


def parse_projects(data: Any) -> list[Project]:
    if not isinstance(data, list):
        raise HTTPException(502, "The database returned an invalid project response.")
    try:
        return [Project.model_validate(item) for item in data]
    except ValidationError as exc:
        raise HTTPException(502, "The database returned an invalid project response.") from exc


def one_project(data: Any) -> Project:
    projects = parse_projects(data)
    if not projects:
        raise HTTPException(404, "Project not found.")
    if len(projects) != 1:
        raise HTTPException(502, "The database returned an invalid project response.")
    return projects[0]


@router.get("/auth/me", response_model=AuthenticatedUser)
async def current_user(user: User) -> AuthenticatedUser:
    return user


@router.get("/projects", response_model=ProjectList)
async def list_projects(
    user: User,
    gateway: Gateway,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0, le=100_000)] = 0,
) -> ProjectList:
    data = await gateway.request(
        "GET",
        "/rest/v1/projects",
        params={
            "select": PROJECT_COLUMNS,
            "order": "created_at.desc,id.desc",
            "limit": limit,
            "offset": offset,
        },
    )
    return ProjectList(items=parse_projects(data), limit=limit, offset=offset)


@router.post("/projects", response_model=Project, status_code=status.HTTP_201_CREATED)
async def create_project(payload: ProjectCreate, user: User, gateway: Gateway) -> Project:
    data = await gateway.request(
        "POST",
        "/rest/v1/projects",
        params={"select": PROJECT_COLUMNS},
        payload={**payload.model_dump(), "owner_id": str(user.id)},
        representation=True,
    )
    return one_project(data)


@router.get("/projects/{project_id}", response_model=Project)
async def read_project(project_id: UUID, user: User, gateway: Gateway) -> Project:
    data = await gateway.request(
        "GET",
        "/rest/v1/projects",
        params={
            "select": PROJECT_COLUMNS,
            "id": f"eq.{project_id}",
            "limit": 1,
        },
    )
    return one_project(data)


@router.patch("/projects/{project_id}", response_model=Project)
async def update_project(
    project_id: UUID, payload: ProjectUpdate, user: User, gateway: Gateway
) -> Project:
    data = await gateway.request(
        "PATCH",
        "/rest/v1/projects",
        params={"id": f"eq.{project_id}", "select": PROJECT_COLUMNS},
        payload=payload.model_dump(exclude_unset=True),
        representation=True,
    )
    return one_project(data)


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(project_id: UUID, user: User, gateway: Gateway) -> Response:
    data = await gateway.request(
        "DELETE",
        "/rest/v1/projects",
        params={"id": f"eq.{project_id}", "owner_id": f"eq.{user.id}", "select": PROJECT_COLUMNS},
        representation=True,
    )
    one_project(data)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


async def ensure_project_owner(project_id: UUID, user: AuthenticatedUser, gateway: SupabaseGateway):
    data = await gateway.request(
        "GET", "/rest/v1/projects", params={"id": f"eq.{project_id}", "select": PROJECT_COLUMNS}
    )
    project = one_project(data)
    if project.owner_id != user.id:
        raise HTTPException(403, "Only the project owner can manage members.")


def parse_members(data: Any) -> list[ProjectMember]:
    if not isinstance(data, list):
        raise HTTPException(502, "The database returned an invalid membership response.")
    try:
        return [ProjectMember.model_validate(item) for item in data]
    except ValidationError as exc:
        raise HTTPException(502, "The database returned an invalid membership response.") from exc


@router.get("/projects/{project_id}/members", response_model=MemberList)
async def list_members(
    project_id: UUID,
    user: User,
    gateway: Gateway,
    limit: Annotated[int, Query(ge=1, le=100)] = 100,
    offset: Annotated[int, Query(ge=0, le=100_000)] = 0,
) -> MemberList:
    await ensure_project_owner(project_id, user, gateway)
    data = await gateway.request(
        "GET",
        "/rest/v1/project_members",
        params={
            "project_id": f"eq.{project_id}",
            "order": "created_at.asc,user_id.asc",
            "limit": limit,
            "offset": offset,
        },
    )
    return MemberList(items=parse_members(data), limit=limit, offset=offset)


@router.post("/projects/{project_id}/members", response_model=ProjectMember, status_code=201)
async def add_member(
    project_id: UUID, payload: MemberCreate, user: User, gateway: Gateway
) -> ProjectMember:
    await ensure_project_owner(project_id, user, gateway)
    if payload.user_id == user.id:
        raise HTTPException(409, "The project owner already has access.")
    data = await gateway.request(
        "POST",
        "/rest/v1/project_members",
        payload={"project_id": str(project_id), **payload.model_dump(mode="json")},
        representation=True,
    )
    members = parse_members(data)
    if len(members) != 1:
        raise HTTPException(502, "The database returned an invalid membership response.")
    return members[0]


@router.delete("/projects/{project_id}/members/{user_id}", status_code=204)
async def remove_member(project_id: UUID, user_id: UUID, user: User, gateway: Gateway) -> Response:
    await ensure_project_owner(project_id, user, gateway)
    data = await gateway.request(
        "DELETE",
        "/rest/v1/project_members",
        params={"project_id": f"eq.{project_id}", "user_id": f"eq.{user_id}"},
        representation=True,
    )
    if not parse_members(data):
        raise HTTPException(404, "Project member not found.")
    return Response(status_code=204)


def parse_notifications(data: Any) -> list[Notification]:
    if not isinstance(data, list):
        raise HTTPException(502, "The database returned an invalid notification response.")
    try:
        return [Notification.model_validate(item) for item in data]
    except ValidationError as exc:
        raise HTTPException(502, "The database returned an invalid notification response.") from exc


@router.get("/notifications", response_model=NotificationList)
async def list_notifications(
    user: User,
    gateway: Gateway,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0, le=100_000)] = 0,
) -> NotificationList:
    data = await gateway.request(
        "GET",
        "/rest/v1/notifications",
        params={
            "owner_id": f"eq.{user.id}",
            "order": "created_at.desc,id.desc",
            "limit": limit,
            "offset": offset,
        },
    )
    return NotificationList(items=parse_notifications(data), limit=limit, offset=offset)


@router.patch("/notifications/{notification_id}", response_model=Notification)
async def mark_notification(
    notification_id: UUID, payload: NotificationUpdate, user: User, gateway: Gateway
) -> Notification:
    data = await gateway.request(
        "PATCH",
        "/rest/v1/notifications",
        params={"id": f"eq.{notification_id}", "owner_id": f"eq.{user.id}"},
        payload={"read_at": datetime.now(UTC).isoformat() if payload.read else None},
        representation=True,
    )
    notifications = parse_notifications(data)
    if not notifications:
        raise HTTPException(404, "Notification not found.")
    if len(notifications) != 1:
        raise HTTPException(502, "The database returned an invalid notification response.")
    return notifications[0]
