"""Persistence of AI generations (public.ai_generations, migration 007).

Uses the caller's user-scoped database handle, so RLS applies; every query is additionally
filtered by user_id here, so a policy mistake alone can't leak another user's history.
"""

from typing import Any
from uuid import UUID

from app.ai.schemas import GenerationRecord, GenerationStatus, GenerationType
from app.core.security import AuthenticatedUser
from app.db.supabase import JsonValue, UserDB

TABLE = "ai_generations"


class AIHistoryRepository:
    def __init__(self, db: UserDB, user: AuthenticatedUser) -> None:
        self._db = db
        self._user = user

    async def create(
        self,
        *,
        provider: str,
        model: str,
        type: GenerationType,
        status: GenerationStatus,
        input: dict[str, Any],
        output: dict[str, Any] | None = None,
    ) -> GenerationRecord:
        values: dict[str, JsonValue] = {
            "user_id": str(self._user.id),
            "provider": provider,
            "model": model,
            "type": type,
            "status": status,
            "input": input,
            "output": output,
        }
        return GenerationRecord.model_validate(await self._db.insert(TABLE, values))

    async def finish(
        self, generation_id: UUID, *, status: GenerationStatus, model: str, output: dict[str, Any] | None
    ) -> GenerationRecord | None:
        rows = await self._db.update(
            TABLE,
            filters={"id": generation_id, "user_id": self._user.id, "status": "pending"},
            values={"status": status, "model": model, "output": output},
        )
        return GenerationRecord.model_validate(rows[0]) if rows else None

    async def list(self, *, limit: int, offset: int, type: GenerationType | None = None) -> list[GenerationRecord]:
        filters: dict[str, str | UUID] = {"user_id": self._user.id}
        if type is not None:
            filters["type"] = type
        rows = await self._db.select(TABLE, filters=filters, order=[("created_at", "desc")], limit=limit, offset=offset)
        return [GenerationRecord.model_validate(row) for row in rows]
