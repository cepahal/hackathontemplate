import uuid

import pytest
from fastapi.testclient import TestClient

from tests.conftest import ALICE_ID, BOB_ID
from tests.fakes import InMemoryDB


def create(client: TestClient, headers: dict[str, str], **body: object) -> dict[str, object]:
    response = client.post("/api/v1/projects", headers=headers, json={"name": "Demo", **body})
    assert response.status_code == 201, response.text
    data: dict[str, object] = response.json()
    return data


# --- unauthenticated access ---------------------------------------------------------------


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("GET", "/api/v1/projects"),
        ("POST", "/api/v1/projects"),
        ("GET", f"/api/v1/projects/{uuid.uuid4()}"),
        ("PATCH", f"/api/v1/projects/{uuid.uuid4()}"),
        ("DELETE", f"/api/v1/projects/{uuid.uuid4()}"),
        ("GET", "/api/v1/me"),
    ],
)
def test_requires_bearer_token(client: TestClient, fake_db: InMemoryDB, method: str, path: str) -> None:
    response = client.request(method, path, json={"name": "x"})
    assert response.status_code == 401
    assert response.headers["WWW-Authenticate"] == "Bearer"
    assert response.json()["error"] == {
        "code": "UNAUTHORIZED",
        "message": "Missing bearer token",
        "request_id": response.headers["X-Request-ID"],
    }
    assert fake_db.calls == []


def test_rejects_non_bearer_and_garbage_tokens(client: TestClient) -> None:
    basic = client.get("/api/v1/projects", headers={"Authorization": "Basic dXNlcjpwYXNz"})
    assert basic.status_code == 401

    garbage = client.get("/api/v1/projects", headers={"Authorization": "Bearer not-a-jwt"})
    assert garbage.status_code == 401
    assert garbage.json()["error"]["code"] == "INVALID_TOKEN"


# --- creation -----------------------------------------------------------------------------


def test_create_project_owner_comes_from_token(client: TestClient, alice: dict[str, str]) -> None:
    project = create(client, alice, name="  Launch site  ", description="Landing page")
    assert project["owner_id"] == str(ALICE_ID)
    assert project["name"] == "Launch site"
    assert project["status"] == "active"
    assert {"id", "created_at", "updated_at"} <= project.keys()


def test_client_supplied_owner_id_is_rejected(client: TestClient, alice: dict[str, str], fake_db: InMemoryDB) -> None:
    response = client.post("/api/v1/projects", headers=alice, json={"name": "Sneaky", "owner_id": str(BOB_ID)})
    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["field"] == "body.owner_id"
    assert fake_db.tables["projects"] == []


def test_duplicate_name_is_409(client: TestClient, alice: dict[str, str], bob: dict[str, str]) -> None:
    create(client, alice, name="Roadmap")
    response = client.post("/api/v1/projects", headers=alice, json={"name": "ROADMAP"})
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "PROJECT_NAME_TAKEN"
    # Names are unique per owner, not globally.
    create(client, bob, name="Roadmap")


# --- listing ------------------------------------------------------------------------------


def test_list_returns_only_own_projects_newest_first(
    client: TestClient, alice: dict[str, str], bob: dict[str, str]
) -> None:
    create(client, alice, name="First")
    create(client, alice, name="Second", status="paused")
    create(client, bob, name="Bob's")

    names = [p["name"] for p in client.get("/api/v1/projects", headers=alice).json()]
    assert names == ["Second", "First"]

    paused = client.get("/api/v1/projects", headers=alice, params={"status": "paused"}).json()
    assert [p["name"] for p in paused] == ["Second"]

    page = client.get("/api/v1/projects", headers=alice, params={"limit": 1, "offset": 1}).json()
    assert [p["name"] for p in page] == ["First"]

    assert [p["name"] for p in client.get("/api/v1/projects", headers=bob).json()] == ["Bob's"]


def test_list_query_params_are_validated(client: TestClient, alice: dict[str, str]) -> None:
    for params in ({"limit": 0}, {"limit": 101}, {"offset": -1}, {"status": "deleted"}):
        response = client.get("/api/v1/projects", headers=alice, params=params)
        assert response.status_code == 422, params


# --- ownership ----------------------------------------------------------------------------


def test_other_users_project_is_invisible(client: TestClient, alice: dict[str, str], bob: dict[str, str]) -> None:
    project = create(client, alice, name="Private")
    path = f"/api/v1/projects/{project['id']}"

    for response in (
        client.get(path, headers=bob),
        client.patch(path, headers=bob, json={"name": "Hijacked"}),
        client.delete(path, headers=bob),
    ):
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "PROJECT_NOT_FOUND"

    still_there = client.get(path, headers=alice)
    assert still_there.status_code == 200
    assert still_there.json()["name"] == "Private"


def test_queries_are_scoped_by_owner_from_token(client: TestClient, alice: dict[str, str], fake_db: InMemoryDB) -> None:
    project = create(client, alice)
    fake_db.calls.clear()
    client.patch(f"/api/v1/projects/{project['id']}", headers=alice, json={"status": "completed"})
    client.delete(f"/api/v1/projects/{project['id']}", headers=alice)
    for _op, table, filters in fake_db.calls:
        assert table == "projects"
        assert str(filters["owner_id"]) == str(ALICE_ID)


# --- read / update / delete ---------------------------------------------------------------


def test_get_update_delete_own_project(client: TestClient, alice: dict[str, str]) -> None:
    project = create(client, alice, name="Original")
    path = f"/api/v1/projects/{project['id']}"

    assert client.get(path, headers=alice).json()["name"] == "Original"

    updated = client.patch(path, headers=alice, json={"name": "Renamed", "status": "completed"})
    assert updated.status_code == 200
    assert updated.json()["name"] == "Renamed"
    assert updated.json()["status"] == "completed"
    assert updated.json()["description"] == project["description"]

    deleted = client.delete(path, headers=alice)
    assert deleted.status_code == 204
    assert deleted.content == b""
    assert client.get(path, headers=alice).status_code == 404


# --- 404 / validation ---------------------------------------------------------------------


def test_missing_project_is_404(client: TestClient, alice: dict[str, str]) -> None:
    response = client.get(f"/api/v1/projects/{uuid.uuid4()}", headers=alice)
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "PROJECT_NOT_FOUND"
    assert response.json()["error"]["message"] == "Project not found"


def test_invalid_project_id_is_422(client: TestClient, alice: dict[str, str]) -> None:
    response = client.get("/api/v1/projects/not-a-uuid", headers=alice)
    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["field"] == "path.project_id"


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"name": ""},
        {"name": "   "},
        {"name": "x" * 121},
        {"name": "ok", "description": "x" * 2001},
        {"name": "ok", "status": "done"},
        {"name": 123},
    ],
)
def test_create_validation_errors(client: TestClient, alice: dict[str, str], body: dict[str, object]) -> None:
    response = client.post("/api/v1/projects", headers=alice, json=body)
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "VALIDATION_ERROR"
    assert error["details"]
    assert all("input" not in detail for detail in error["details"])


def test_update_validation(client: TestClient, alice: dict[str, str]) -> None:
    path = f"/api/v1/projects/{create(client, alice)['id']}"

    empty = client.patch(path, headers=alice, json={})
    assert empty.status_code == 400
    assert empty.json()["error"]["code"] == "EMPTY_UPDATE"

    null_name = client.patch(path, headers=alice, json={"name": None})
    assert null_name.status_code == 422

    owner_change = client.patch(path, headers=alice, json={"owner_id": str(BOB_ID)})
    assert owner_change.status_code == 422


def test_malformed_json_is_400(client: TestClient, alice: dict[str, str]) -> None:
    response = client.post(
        "/api/v1/projects", headers={**alice, "Content-Type": "application/json"}, content=b'{"name": '
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_JSON"
