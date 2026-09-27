from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

ProjectName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]


class AuthenticatedUser(BaseModel):
    id: UUID
    email: str | None = None
    role: Literal["user", "admin"] = "user"


class ProjectCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: ProjectName
    description: str = Field(default="", max_length=5000)


class ProjectUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: ProjectName | None = None
    description: str | None = Field(default=None, max_length=5000)

    @model_validator(mode="after")
    def require_changes(self) -> "ProjectUpdate":
        if not self.model_fields_set:
            raise ValueError("Supply at least one field to update")
        if any(getattr(self, key) is None for key in self.model_fields_set):
            raise ValueError("Project fields cannot be null; use an empty description to clear it")
        return self


class Project(BaseModel):
    id: UUID
    owner_id: UUID
    name: str
    description: str
    created_at: datetime
    updated_at: datetime


class ProjectList(BaseModel):
    items: list[Project]
    limit: int
    offset: int


class MemberCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_id: UUID
    role: Literal["viewer", "editor"] = "viewer"


class ProjectMember(BaseModel):
    project_id: UUID
    user_id: UUID
    role: Literal["viewer", "editor"]
    created_at: datetime


class MemberList(BaseModel):
    items: list[ProjectMember]
    limit: int
    offset: int


class Notification(BaseModel):
    id: UUID
    owner_id: UUID
    title: str
    message: str
    data: dict
    read_at: datetime | None = None
    created_at: datetime


class NotificationList(BaseModel):
    items: list[Notification]
    limit: int
    offset: int


class NotificationUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    read: bool
