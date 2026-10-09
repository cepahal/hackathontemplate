"""In-memory stand-in for the PostgREST user-scoped database.

It deliberately does NOT emulate Row Level Security: every row is visible to every caller.
Tests that pass against it therefore prove the service layer scopes queries by owner itself.
Constraint errors are raised through the same `database_error` mapping as the real client.
"""

import itertools
import uuid
from datetime import UTC, datetime, timedelta

from app.db.supabase import Filters, FilterValue, OrderBy, Row, Values, database_error

_BASE_TIME = datetime(2026, 1, 1, tzinfo=UTC)

DEFAULTS: dict[str, dict[str, object]] = {
    "projects": {"description": "", "status": "active"},
    "tasks": {"description": "", "completed": False, "priority": 2, "due_date": None},
    "profiles": {"display_name": None, "avatar_url": None, "role": "user"},
}


def _matches(row: Row, filters: Filters | None) -> bool:
    for column, expected in (filters or {}).items():
        actual = row.get(column)
        if expected is None or isinstance(expected, bool):
            if actual is not expected:
                return False
        elif str(actual) != str(expected):
            return False
    return True


class InMemoryDB:
    def __init__(self) -> None:
        self.tables: dict[str, list[Row]] = {
            "profiles": [],
            "projects": [],
            "tasks": [],
            "activity": [],
            "ai_generations": [],
        }
        self.calls: list[tuple[str, str, dict[str, FilterValue]]] = []
        self._clock = itertools.count(1)

    def _now(self) -> str:
        return (_BASE_TIME + timedelta(seconds=next(self._clock))).isoformat()

    def add_profile(self, user_id: uuid.UUID, email: str) -> Row:
        now = self._now()
        row: Row = {**DEFAULTS["profiles"], "id": str(user_id), "email": email, "created_at": now, "updated_at": now}
        self.tables["profiles"].append(row)
        return row

    async def select(
        self,
        table: str,
        *,
        filters: Filters | None = None,
        order: OrderBy | None = None,
        limit: int | None = None,
        offset: int | None = None,
    ) -> list[Row]:
        self.calls.append(("select", table, dict(filters or {})))
        rows = [dict(row) for row in self.tables[table] if _matches(row, filters)]
        for column, direction in reversed(order or []):
            rows.sort(key=lambda row: str(row[column]), reverse=direction == "desc")
        start = offset or 0
        return rows[start : start + limit] if limit is not None else rows[start:]

    async def insert(self, table: str, values: Values) -> Row:
        self.calls.append(("insert", table, {}))
        now = self._now()
        row: Row = {
            "id": str(uuid.uuid4()),
            **DEFAULTS.get(table, {}),
            **values,
            "created_at": now,
            "updated_at": now,
        }
        self._check_constraints(table, row, exclude_id=None)
        self.tables[table].append(row)
        return dict(row)

    async def update(self, table: str, *, filters: Filters, values: Values) -> list[Row]:
        self.calls.append(("update", table, dict(filters)))
        updated = []
        for row in self.tables[table]:
            if _matches(row, filters):
                candidate = {**row, **values, "updated_at": self._now()}
                self._check_constraints(table, candidate, exclude_id=str(row["id"]))
                row.update(candidate)
                updated.append(dict(row))
        return updated

    async def delete(self, table: str, *, filters: Filters) -> list[Row]:
        self.calls.append(("delete", table, dict(filters)))
        deleted = [row for row in self.tables[table] if _matches(row, filters)]
        self.tables[table] = [row for row in self.tables[table] if not _matches(row, filters)]
        if table == "projects":
            ids = {row["id"] for row in deleted}
            self.tables["tasks"] = [task for task in self.tables["tasks"] if task["project_id"] not in ids]
        return [dict(row) for row in deleted]

    def _check_constraints(self, table: str, row: Row, *, exclude_id: str | None) -> None:
        if table == "projects":
            for other in self.tables["projects"]:
                same_name = str(other["name"]).lower() == str(row["name"]).lower()
                if other["id"] != exclude_id and other["owner_id"] == row["owner_id"] and same_name:
                    raise database_error(409, {"code": "23505", "message": "duplicate key"})
        if table == "tasks" and not any(p["id"] == row["project_id"] for p in self.tables["projects"]):
            raise database_error(409, {"code": "23503", "message": "foreign key violation"})


class ExplodingDB(InMemoryDB):
    """Simulates an unexpected bug inside the data layer."""

    async def select(
        self,
        table: str,
        *,
        filters: Filters | None = None,
        order: OrderBy | None = None,
        limit: int | None = None,
        offset: int | None = None,
    ) -> list[Row]:
        raise RuntimeError("boom: secret internals must not leak")
