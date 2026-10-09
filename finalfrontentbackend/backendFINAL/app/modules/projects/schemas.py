"""Request/response models for projects. Limits mirror databaseFINAL/migrations/003_projects.sql."""

from datetime import datetime
from typing import Annotated, Literal, Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, StringConstraints, model_validator

ProjectStatus = Literal["active", "paused", "completed", "archived"]
ProjectName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
ProjectDescription = Annotated[str, StringConstraints(max_length=2000)]


class ProjectCreate(BaseModel):
    # extra="forbid": clients cannot send owner_id, id or timestamps.
    model_config = ConfigDict(extra="forbid")

    name: ProjectName
    description: ProjectDescription = ""
    status: ProjectStatus = "active"


class ProjectUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: ProjectName | None = None
    description: ProjectDescription | None = None
    status: ProjectStatus | None = None

    @model_validator(mode="after")
    def _reject_nulls(self) -> Self:
        for field in self.model_fields_set:
            if getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self


class ProjectOut(BaseModel):
    id: UUID
    owner_id: UUID
    name: str
    description: str
    status: ProjectStatus
    created_at: datetime
    updated_at: datetime
