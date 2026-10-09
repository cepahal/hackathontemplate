"""The real PostgREST client, exercised against a mocked HTTP transport."""

import json
import uuid
from collections.abc import Callable

import httpx
import pytest

from app.core.errors import DatabaseError, UnauthorizedError
from app.db.supabase import PostgrestUserDB, SupabaseRest
from tests.conftest import build_settings

Handler = Callable[[httpx.Request], httpx.Response]
USER_TOKEN = "user.jwt.token"


def make_db(handler: Handler, **settings: object) -> PostgrestUserDB:
    http = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    return SupabaseRest(build_settings(**settings), http).as_user(USER_TOKEN)


async def test_select_sends_user_token_anon_key_and_filters() -> None:
    seen: list[httpx.Request] = []
    owner = uuid.uuid4()

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json=[{"id": "1"}])

    db = make_db(handler, supabase_service_role_key="sb_secret_must_never_be_sent")
    rows = await db.select(
        "projects",
        filters={"owner_id": owner, "status": "active", "archived": False, "deleted_at": None},
        order=[("created_at", "desc")],
        limit=10,
        offset=20,
    )

    assert rows == [{"id": "1"}]
    request = seen[0]
    assert request.method == "GET"
    assert request.url.path == "/rest/v1/projects"
    assert request.headers["apikey"] == "sb_publishable_test_only"
    assert request.headers["Authorization"] == f"Bearer {USER_TOKEN}"
    assert "sb_secret_must_never_be_sent" not in str(request.headers)
    assert list(request.url.params.multi_items()) == [
        ("select", "*"),
        ("owner_id", f"eq.{owner}"),
        ("status", "eq.active"),
        ("archived", "is.false"),
        ("deleted_at", "is.null"),
        ("order", "created_at.desc"),
        ("limit", "10"),
        ("offset", "20"),
    ]


async def test_writes_request_representation() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(201 if request.method == "POST" else 200, json=[{"id": "1", "name": "x"}])

    db = make_db(handler)
    assert await db.insert("projects", {"name": "x"}) == {"id": "1", "name": "x"}
    await db.update("projects", filters={"id": "1"}, values={"name": "y"})
    await db.delete("projects", filters={"id": "1"})

    assert [r.method for r in seen] == ["POST", "PATCH", "DELETE"]
    assert all(r.headers["Prefer"] == "return=representation" for r in seen)
    assert json.loads(seen[0].content) == {"name": "x"}
    assert json.loads(seen[1].content) == {"name": "y"}
    assert seen[1].url.params["id"] == "eq.1"


async def test_update_and_delete_refuse_to_run_without_filters() -> None:
    db = make_db(lambda request: httpx.Response(200, json=[]))
    with pytest.raises(ValueError, match="requires at least one filter"):
        await db.update("projects", filters={}, values={"name": "x"})
    with pytest.raises(ValueError, match="requires at least one filter"):
        await db.delete("projects", filters={})


@pytest.mark.parametrize(
    ("status", "pg_code", "expected_status", "expected_code"),
    [
        (409, "23505", 409, "CONFLICT"),
        (409, "23503", 409, "CONFLICT"),
        (400, "23514", 400, "BAD_REQUEST"),
        (400, "22P02", 400, "BAD_REQUEST"),
        (403, "42501", 403, "FORBIDDEN"),
        (404, "PGRST205", 503, "DATABASE_SCHEMA_MISSING"),
        (500, "XX000", 502, "DATABASE_ERROR"),
    ],
)
async def test_postgrest_errors_are_mapped(status: int, pg_code: str, expected_status: int, expected_code: str) -> None:
    db = make_db(lambda request: httpx.Response(status, json={"code": pg_code, "message": "db says no"}))
    with pytest.raises(DatabaseError) as excinfo:
        await db.select("projects")
    assert excinfo.value.status_code == expected_status
    assert excinfo.value.code == expected_code
    assert excinfo.value.pg_code == pg_code
    assert "db says no" not in excinfo.value.message


async def test_rejected_jwt_is_401() -> None:
    db = make_db(lambda request: httpx.Response(401, json={"code": "PGRST301", "message": "JWT expired"}))
    with pytest.raises(UnauthorizedError):
        await db.select("projects")


async def test_network_failures_are_503() -> None:
    def timeout(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("slow", request=request)

    def refused(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("refused", request=request)

    for handler in (timeout, refused):
        with pytest.raises(DatabaseError) as excinfo:
            await make_db(handler).select("projects")
        assert excinfo.value.status_code == 503
        assert excinfo.value.code == "DATABASE_UNAVAILABLE"


async def test_unexpected_payload_is_502() -> None:
    db = make_db(lambda request: httpx.Response(200, json={"not": "a list"}))
    with pytest.raises(DatabaseError) as excinfo:
        await db.select("projects")
    assert excinfo.value.status_code == 502
