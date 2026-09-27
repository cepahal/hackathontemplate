import asyncio
from copy import deepcopy
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.modules.ai.workflows import Workflows


class FakeStore:
    """Simulates conditional owner-scoped REST updates, not a real RLS verification."""

    def __init__(self, records, owner_id="user-a"):
        self.owner_id = owner_id
        self.records = records
        self.project_inserts = 0
        self.fail_after_insert = False

    def owned(self, **extra):
        return {"owner_id": f"eq.{self.owner_id}", **extra}

    async def get_one(self, table, record_id):
        rows = await self.request("GET", table, params=self.owned(id=f"eq.{record_id}"))
        if not rows:
            raise HTTPException(404, "Record not found")
        return rows[0]

    async def request(self, method, resource, *, params=None, body=None):
        table = self.records.setdefault(resource, [])
        if method == "POST":
            if resource == "projects":
                self.project_inserts += 1
            table.append(deepcopy(body))
            if self.fail_after_insert and resource == "projects":
                self.fail_after_insert = False
                raise HTTPException(503, "Connection lost after insertion")
            return [deepcopy(body)]
        assert params["owner_id"] == f"eq.{self.owner_id}"
        rows = [
            row
            for row in table
            if all(
                row.get(key) == value[3:]
                for key, value in params.items()
                if isinstance(value, str) and value.startswith("eq.")
            )
        ]
        if method == "PATCH":
            for row in rows:
                row.update(deepcopy(body))
        return deepcopy(rows)


class NoAI:
    pass


def pending_run():
    return {
        "id": str(uuid4()),
        "owner_id": "user-a",
        "status": "awaiting_approval",
        "state": {
            "steps": [],
            "pending_action": {
                "tool": "create_project",
                "arguments": {
                    "id": str(uuid4()),
                    "name": "Reviewed project",
                    "description": "Exact proposal",
                },
            },
        },
    }


def test_approval_executes_reviewed_action_once_and_persists_result():
    async def run():
        row = pending_run()
        store = FakeStore({"agent_runs": [row]})
        flow = Workflows(store, NoAI())
        completed = await flow.approve(row["id"], True)
        assert completed["status"] == "completed"
        assert "pending_action" not in completed["state"]
        assert completed["state"]["reviewed_action"]["tool"] == "create_project"
        assert completed["state"]["result"]["project"]["name"] == "Reviewed project"
        assert store.project_inserts == 1
        with pytest.raises(HTTPException) as error:
            await flow.approve(row["id"], True)
        assert error.value.status_code == 409
        assert store.project_inserts == 1

    asyncio.run(run())


def test_rejection_never_creates_project():
    async def run():
        row = pending_run()
        store = FakeStore({"agent_runs": [row]})
        result = await Workflows(store, NoAI()).approve(row["id"], False)
        assert result["status"] == "rejected"
        assert "pending_action" not in result["state"]
        assert store.project_inserts == 0

    asyncio.run(run())


def test_another_user_cannot_read_or_approve_run():
    async def run():
        row = pending_run()
        store = FakeStore({"agent_runs": [row]}, owner_id="user-b")
        with pytest.raises(HTTPException) as error:
            await Workflows(store, NoAI()).approve(row["id"], True)
        assert error.value.status_code == 404
        assert store.project_inserts == 0
        assert row["status"] == "awaiting_approval"

    asyncio.run(run())


def test_uncertain_write_retry_recovers_without_duplicate_project():
    async def run():
        row = pending_run()
        store = FakeStore({"agent_runs": [row]})
        store.fail_after_insert = True
        flow = Workflows(store, NoAI())
        with pytest.raises(HTTPException):
            await flow.approve(row["id"], True)
        assert row["status"] == "awaiting_approval"
        result = await flow.approve(row["id"], True)
        assert result["status"] == "completed"
        assert store.project_inserts == 1
        assert len(store.records["projects"]) == 1

    asyncio.run(run())


def test_lost_approval_claim_does_not_execute_action():
    class ContendedStore(FakeStore):
        async def request(self, method, resource, *, params=None, body=None):
            if method == "PATCH" and params.get("status") == "eq.awaiting_approval":
                return []
            return await super().request(method, resource, params=params, body=body)

    async def run():
        row = pending_run()
        store = ContendedStore({"agent_runs": [row]})
        with pytest.raises(HTTPException) as error:
            await Workflows(store, NoAI()).approve(row["id"], True)
        assert error.value.status_code == 409
        assert store.project_inserts == 0

    asyncio.run(run())


def test_large_step_history_stays_within_provider_message_limit():
    from app.modules.ai.schemas import AgentRequest

    class ReadOnlyAgent:
        def resolve(self, *_args):
            return None

        async def chat(self, request):
            assert all(len(message.content) <= 20000 for message in request.messages)
            return {
                "structured": {
                    "action": "project_summary",
                    "message": "M" * 4000,
                    "query": "Q" * 4000,
                    "name": "",
                    "description": "D" * 5000,
                },
                "usage": {},
            }

    async def run():
        store = FakeStore(
            {
                "projects": [
                    {
                        "id": str(uuid4()),
                        "owner_id": "user-a",
                        "name": "N" * 120,
                        "description": "D" * 5000,
                    }
                    for _ in range(10)
                ]
            }
        )
        result = await Workflows(store, ReadOnlyAgent()).start_agent(
            AgentRequest(goal="G" * 4000, max_steps=5)
        )
        assert result["status"] == "completed"
        assert len(result["state"]["steps"]) == 5

    asyncio.run(run())
