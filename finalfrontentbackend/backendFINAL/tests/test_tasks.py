import uuid

import pytest
from fastapi.testclient import TestClient

from tests.fakes import InMemoryDB


def make_project(client: TestClient, headers: dict[str, str], name: str = "Project") -> str:
    response = client.post("/api/v1/projects", headers=headers, json={"name": name})
    assert response.status_code == 201, response.text
    return str(response.json()["id"])


def make_task(client: TestClient, headers: dict[str, str], project_id: str, **body: object) -> dict[str, object]:
    response = client.post(f"/api/v1/projects/{project_id}/tasks", headers=headers, json={"title": "Task", **body})
    assert response.status_code == 201, response.text
    data: dict[str, object] = response.json()
    return data


def test_tasks_require_auth(client: TestClient) -> None:
    project_id, task_id = uuid.uuid4(), uuid.uuid4()
    assert client.get(f"/api/v1/projects/{project_id}/tasks").status_code == 401
    assert client.post(f"/api/v1/projects/{project_id}/tasks", json={"title": "x"}).status_code == 401
    assert client.patch(f"/api/v1/tasks/{task_id}", json={"completed": True}).status_code == 401
    assert client.delete(f"/api/v1/tasks/{task_id}").status_code == 401


def test_create_task_with_defaults(client: TestClient, alice: dict[str, str]) -> None:
    project_id = make_project(client, alice)
    task = make_task(client, alice, project_id, title="  Write README  ")
    assert task["project_id"] == project_id
    assert task["title"] == "Write README"
    assert task["completed"] is False
    assert task["priority"] == 2
    assert task["due_date"] is None


def test_create_task_with_all_fields(client: TestClient, alice: dict[str, str]) -> None:
    project_id = make_project(client, alice)
    task = make_task(
        client,
        alice,
        project_id,
        title="Ship",
        description="Deploy to prod",
        completed=True,
        priority=4,
        due_date="2026-12-01T17:00:00+00:00",
    )
    assert task["priority"] == 4
    assert task["completed"] is True
    assert str(task["due_date"]).startswith("2026-12-01T17:00:00")


def test_list_tasks_of_own_project(client: TestClient, alice: dict[str, str]) -> None:
    first = make_project(client, alice, "First")
    second = make_project(client, alice, "Second")
    make_task(client, alice, first, title="A")
    make_task(client, alice, first, title="B", completed=True)
    make_task(client, alice, second, title="Other project")

    titles = [t["title"] for t in client.get(f"/api/v1/projects/{first}/tasks", headers=alice).json()]
    assert titles == ["B", "A"]

    open_only = client.get(f"/api/v1/projects/{first}/tasks", headers=alice, params={"completed": "false"}).json()
    assert [t["title"] for t in open_only] == ["A"]


def test_cannot_list_or_add_tasks_in_someone_elses_project(
    client: TestClient, alice: dict[str, str], bob: dict[str, str], fake_db: InMemoryDB
) -> None:
    project_id = make_project(client, alice)
    make_task(client, alice, project_id)

    listing = client.get(f"/api/v1/projects/{project_id}/tasks", headers=bob)
    assert listing.status_code == 404
    assert listing.json()["error"]["code"] == "PROJECT_NOT_FOUND"

    planted = client.post(f"/api/v1/projects/{project_id}/tasks", headers=bob, json={"title": "Planted"})
    assert planted.status_code == 404
    assert [t["title"] for t in fake_db.tables["tasks"]] == ["Task"]


def test_cannot_update_or_delete_someone_elses_task(
    client: TestClient, alice: dict[str, str], bob: dict[str, str]
) -> None:
    project_id = make_project(client, alice)
    task = make_task(client, alice, project_id, title="Alice's")
    path = f"/api/v1/tasks/{task['id']}"

    for response in (
        client.patch(path, headers=bob, json={"completed": True}),
        client.delete(path, headers=bob),
    ):
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "TASK_NOT_FOUND"

    remaining = client.get(f"/api/v1/projects/{project_id}/tasks", headers=alice).json()
    assert remaining[0]["title"] == "Alice's"
    assert remaining[0]["completed"] is False


def test_update_and_delete_own_task(client: TestClient, alice: dict[str, str]) -> None:
    project_id = make_project(client, alice)
    task = make_task(client, alice, project_id, due_date="2026-12-01T00:00:00Z")
    path = f"/api/v1/tasks/{task['id']}"

    updated = client.patch(path, headers=alice, json={"completed": True, "priority": 3, "due_date": None})
    assert updated.status_code == 200
    assert updated.json()["completed"] is True
    assert updated.json()["priority"] == 3
    assert updated.json()["due_date"] is None
    assert updated.json()["title"] == "Task"

    assert client.delete(path, headers=alice).status_code == 204
    assert client.get(f"/api/v1/projects/{project_id}/tasks", headers=alice).json() == []
    assert client.delete(path, headers=alice).status_code == 404


def test_deleting_project_removes_its_tasks(client: TestClient, alice: dict[str, str]) -> None:
    project_id = make_project(client, alice)
    task = make_task(client, alice, project_id)
    assert client.delete(f"/api/v1/projects/{project_id}", headers=alice).status_code == 204
    assert client.patch(f"/api/v1/tasks/{task['id']}", headers=alice, json={"completed": True}).status_code == 404


def test_missing_project_and_task_are_404(client: TestClient, alice: dict[str, str]) -> None:
    missing_project = client.post(f"/api/v1/projects/{uuid.uuid4()}/tasks", headers=alice, json={"title": "x"})
    assert missing_project.status_code == 404
    assert missing_project.json()["error"]["code"] == "PROJECT_NOT_FOUND"

    missing_task = client.patch(f"/api/v1/tasks/{uuid.uuid4()}", headers=alice, json={"completed": True})
    assert missing_task.status_code == 404
    assert missing_task.json()["error"] == {
        "code": "TASK_NOT_FOUND",
        "message": "Task not found",
        "request_id": missing_task.headers["X-Request-ID"],
    }


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"title": ""},
        {"title": "x" * 201},
        {"title": "ok", "priority": 0},
        {"title": "ok", "priority": 5},
        {"title": "ok", "priority": "3"},
        {"title": "ok", "priority": True},
        {"title": "ok", "due_date": "2026-12-01T10:00:00"},
        {"title": "ok", "due_date": "tomorrow"},
        {"title": "ok", "project_id": str(uuid.uuid4())},
        {"title": "ok", "description": "x" * 5001},
    ],
)
def test_create_task_validation(client: TestClient, alice: dict[str, str], body: dict[str, object]) -> None:
    project_id = make_project(client, alice)
    response = client.post(f"/api/v1/projects/{project_id}/tasks", headers=alice, json=body)
    assert response.status_code == 422, body
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_update_task_validation(client: TestClient, alice: dict[str, str]) -> None:
    project_id = make_project(client, alice)
    path = f"/api/v1/tasks/{make_task(client, alice, project_id)['id']}"

    assert client.patch(path, headers=alice, json={}).json()["error"]["code"] == "EMPTY_UPDATE"
    assert client.patch(path, headers=alice, json={"title": None}).status_code == 422
    assert client.patch(path, headers=alice, json={"completed": None}).status_code == 422
    assert client.patch(path, headers=alice, json={"project_id": str(uuid.uuid4())}).status_code == 422
    assert client.patch("/api/v1/tasks/nope", headers=alice, json={"completed": True}).status_code == 422
