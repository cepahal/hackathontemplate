import asyncio

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.modules import realtime
from app.modules.identity.settings import IdentitySettings

OWNER = "22222222-2222-4222-8222-222222222222"
OTHER = "33333333-3333-4333-8333-333333333333"
PROJECT = "44444444-4444-4444-8444-444444444444"
URL = f"/api/v1/realtime/projects/{PROJECT}"


@pytest.fixture(autouse=True)
def clean_rooms():
    realtime.rooms.clear()
    yield
    realtime.rooms.clear()


def websocket_app():
    app = FastAPI()
    app.include_router(realtime.router, prefix="/api/v1")
    return app


def allow_owner(monkeypatch):
    async def access(token, project_id, *, edit=False):
        return OWNER if token == "owner-token" else None

    monkeypatch.setattr(realtime, "access", access)


def authenticate(socket, token="owner-token"):
    socket.send_json({"type": "authenticate", "token": token})
    snapshot = socket.receive_json()
    assert snapshot["type"] == "snapshot"
    assert socket.receive_json()["type"] == "presence"
    return snapshot


def test_websocket_authentication_and_state_roundtrip(monkeypatch):
    allow_owner(monkeypatch)
    with TestClient(websocket_app()) as client:
        with client.websocket_connect(URL) as socket:
            assert authenticate(socket)["data"] == {}
            socket.send_json({"type": "state", "data": {"title": "Shared board"}})
            message = socket.receive_json()
            assert message == {"type": "state", "data": {"title": "Shared board"}, "user_id": OWNER}
            assert "owner-token" not in str(message)
            socket.send_json({"type": "ping"})
            assert socket.receive_json() == {"type": "pong"}
    assert not realtime.rooms


@pytest.mark.parametrize(
    "first", [{"type": "state", "data": {}}, {"type": "authenticate", "token": ""}]
)
def test_first_frame_must_authenticate(monkeypatch, first):
    allow_owner(monkeypatch)
    with TestClient(websocket_app()) as client:
        with client.websocket_connect(URL) as socket:
            socket.send_json(first)
            with pytest.raises(WebSocketDisconnect) as caught:
                socket.receive_json()
            assert caught.value.code == 4401
    assert not realtime.rooms


def test_invalid_token_is_denied(monkeypatch):
    allow_owner(monkeypatch)
    with TestClient(websocket_app()) as client:
        with client.websocket_connect(URL) as socket:
            socket.send_json({"type": "authenticate", "token": "invalid"})
            with pytest.raises(WebSocketDisconnect) as caught:
                socket.receive_json()
            assert caught.value.code == 4403


@pytest.mark.parametrize("binary", [False, True])
def test_malformed_or_binary_frame_closes_cleanly(monkeypatch, binary):
    allow_owner(monkeypatch)
    with TestClient(websocket_app()) as client:
        with client.websocket_connect(URL) as socket:
            if binary:
                socket.send_bytes(b"binary is not accepted")
            else:
                socket.send_text("[1,2,3]")
            with pytest.raises(WebSocketDisconnect) as caught:
                socket.receive_json()
            assert caught.value.code == 4400


def test_viewer_can_join_but_cannot_change_state(monkeypatch):
    async def access(token, project_id, *, edit=False):
        return None if edit else OTHER

    monkeypatch.setattr(realtime, "access", access)
    with TestClient(websocket_app()) as client:
        with client.websocket_connect(URL) as socket:
            authenticate(socket, "viewer-token")
            socket.send_json({"type": "state", "data": {"title": "Forbidden"}})
            assert socket.receive_json()["type"] == "error"
            assert realtime.rooms[PROJECT].state == {}


def test_revoked_access_is_rechecked_on_ping(monkeypatch):
    allowed = True

    async def access(token, project_id, *, edit=False):
        return OWNER if allowed else None

    monkeypatch.setattr(realtime, "access", access)
    with TestClient(websocket_app()) as client:
        with client.websocket_connect(URL) as socket:
            authenticate(socket)
            allowed = False
            socket.send_json({"type": "ping"})
            with pytest.raises(WebSocketDisconnect) as caught:
                socket.receive_json()
            assert caught.value.code == 4403


def test_remaining_peers_receive_presence_when_a_peer_leaves(monkeypatch):
    allow_owner(monkeypatch)
    with TestClient(websocket_app()) as client:
        with client.websocket_connect(URL) as first:
            authenticate(first)
            with client.websocket_connect(URL) as second:
                authenticate(second)
                assert first.receive_json() == {"type": "presence", "count": 2}
            assert first.receive_json() == {"type": "presence", "count": 1}


def test_state_frame_has_byte_limit(monkeypatch):
    allow_owner(monkeypatch)
    with TestClient(websocket_app()) as client:
        with client.websocket_connect(URL) as socket:
            authenticate(socket)
            socket.send_json({"type": "state", "data": {"text": "a" * 9000}})
            with pytest.raises(WebSocketDisconnect) as caught:
                socket.receive_json()
            assert caught.value.code == 4400


def mock_upstream(monkeypatch, projects, members=None):
    settings = IdentitySettings(
        _env_file=None, supabase_url="https://example.supabase.co", supabase_anon_key="public-test"
    )
    original_client = httpx.AsyncClient

    def transport(request):
        assert request.headers["authorization"] == "Bearer valid-token"
        if request.url.path == "/auth/v1/user":
            return httpx.Response(200, json={"id": OWNER})
        if request.url.path == "/rest/v1/projects":
            return httpx.Response(200, json=projects)
        return httpx.Response(200, json=members or [])

    monkeypatch.setattr(realtime, "IdentitySettings", lambda: settings)
    monkeypatch.setattr(
        realtime.httpx,
        "AsyncClient",
        lambda **kwargs: original_client(transport=httpx.MockTransport(transport), **kwargs),
    )


@pytest.mark.parametrize(
    "projects", [[], [{}], [None], {"id": PROJECT}, [{"id": OTHER, "owner_id": OWNER}]]
)
def test_malformed_or_hidden_project_response_never_grants_access(monkeypatch, projects):
    mock_upstream(monkeypatch, projects)
    assert asyncio.run(realtime.access("valid-token", PROJECT)) is None


def test_shared_editor_permission_is_verified_through_membership(monkeypatch):
    mock_upstream(
        monkeypatch,
        [{"id": PROJECT, "owner_id": OTHER}],
        members=[{"user_id": OWNER, "role": "editor"}],
    )
    assert asyncio.run(realtime.access("valid-token", PROJECT, edit=True)) == OWNER


def test_shared_viewer_cannot_acquire_edit_permission(monkeypatch):
    mock_upstream(monkeypatch, [{"id": PROJECT, "owner_id": OTHER}])
    assert asyncio.run(realtime.access("valid-token", PROJECT, edit=True)) is None


def test_dead_or_revoked_peer_does_not_abort_broadcast(monkeypatch):
    class Socket:
        def __init__(self, fail_close=False):
            self.messages = []
            self.fail_close = fail_close

        async def close(self, code):
            if self.fail_close:
                raise RuntimeError("already closed")

        async def send_json(self, message):
            self.messages.append(message)

    async def access(token, project_id, *, edit=False):
        return OWNER if token == "valid" else None

    monkeypatch.setattr(realtime, "access", access)
    good, closed = Socket(), Socket(fail_close=True)
    room = realtime.Room(
        peers={
            "closed": realtime.Peer(closed, "revoked", OTHER),
            "good": realtime.Peer(good, "valid", OWNER),
        }
    )
    asyncio.run(realtime.broadcast(room, PROJECT, {"type": "state", "data": {}}))
    assert "closed" not in room.peers
    assert good.messages[0] == {"type": "state", "data": {}}
    assert good.messages[-1] == {"type": "presence", "count": 1}
