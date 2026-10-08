"""Request/response models for tasks. Limits mirror databaseFINAL/migrations/004_tasks.sql."""

from datetime import datetime
from typing import Annotated, Self
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, StringConstraints, model_validator

TaskTitle = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
TaskDescription = Annotated[str, StringConstraints(max_length=5000)]
# 1 = low, 2 = medium, 3 = high, 4 = urgent
TaskPriority = Annotated[int, Field(ge=1, le=4, strict=True)]


class TaskCreate(BaseModel):
    # project_id comes from the URL; extra fields (project_id, id, ...) are rejected.
    model_config = ConfigDict(extra="forbid")

    title: TaskTitle
    description: TaskDescription = ""
    completed: bool = False
    priority: TaskPriority = 2
    due_date: AwareDatetime | None = None


class TaskUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: TaskTitle | None = None
    description: TaskDescription | None = None
    completed: bool | None = None
    priority: TaskPriority | None = None
    # null clears the due date.
    due_date: AwareDatetime | None = None

    @model_validator(mode="after")
    def _reject_nulls(self) -> Self:
        for field in self.model_fields_set - {"due_date"}:
            if getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self


class TaskOut(BaseModel):
    id: UUID
    project_id: UUID
    title: str
    description: str
    completed: bool
    priority: int
    due_date: datetime | None
    created_at: datetime
    updated_at: datetime
