"""Authenticated, bounded, single-process collaborative room example.

Use Supabase Realtime for durable multi-worker deployments. Tokens arrive in the
first WebSocket frame, never in URLs. Access is rechecked before every broadcast.
"""

import asyncio
import json
from contextlib import suppress
from dataclasses import dataclass, field
from uuid import UUID, uuid4

import anyio
import httpx
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.modules.identity.settings import IdentitySettings

router = APIRouter(tags=["realtime"])


@dataclass
class Peer:
    socket: WebSocket
    token: str
    user_id: str


@dataclass
class Room:
    peers: dict[str, Peer] = field(default_factory=dict)
    state: dict = field(default_factory=dict)
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)


rooms: dict[str, Room] = {}


async def access(token: str, project_id: str, *, edit: bool = False) -> str | None:
    if not token or len(token) > 8192 or any(character.isspace() for character in token):
        return None
    try:
        canonical_project_id = str(UUID(project_id))
        settings = IdentitySettings()
        if not settings.supabase_url or not settings.supabase_anon_key.get_secret_value():
            return None
        headers = {
            "apikey": settings.supabase_anon_key.get_secret_value(),
            "Authorization": f"Bearer {token}",
        }
        base = str(settings.supabase_url).rstrip("/")
        async with httpx.AsyncClient(timeout=8, follow_redirects=False) as client:
            identity = await client.get(base + "/auth/v1/user", headers=headers)
            if identity.status_code != 200:
                return None
            user_id = str(UUID(identity.json()["id"]))
            response = await client.get(
                base + "/rest/v1/projects",
                headers=headers,
                params={"id": f"eq.{canonical_project_id}", "select": "id,owner_id"},
            )
            if response.status_code != 200:
                return None
            projects = response.json()
            if not isinstance(projects, list) or len(projects) != 1:
                return None
            project = projects[0]
            if not isinstance(project, dict) or str(UUID(project["id"])) != canonical_project_id:
                return None
            owner_id = str(UUID(project["owner_id"]))
            if edit and owner_id != user_id:
                membership = await client.get(
                    base + "/rest/v1/project_members",
                    headers=headers,
                    params={
                        "project_id": f"eq.{canonical_project_id}",
                        "user_id": f"eq.{user_id}",
                        "role": "eq.editor",
                        "select": "user_id,role",
                    },
                )
                if membership.status_code != 200:
                    return None
                members = membership.json()
                if (
                    not isinstance(members, list)
                    or len(members) != 1
                    or not isinstance(members[0], dict)
                    or members[0].get("user_id") != user_id
                    or members[0].get("role") != "editor"
                ):
                    return None
            return user_id
    except (httpx.HTTPError, ValueError, KeyError, TypeError, AttributeError):
        return None


async def close_socket(socket: WebSocket, code: int) -> None:
    with suppress(RuntimeError, WebSocketDisconnect, TimeoutError, OSError):
        await asyncio.wait_for(socket.close(code=code), timeout=1)


async def read_frame(socket: WebSocket, timeout: float, limit: int) -> dict:
    event = await asyncio.wait_for(socket.receive(), timeout=timeout)
    if event["type"] == "websocket.disconnect":
        raise WebSocketDisconnect(event.get("code", 1000))
    text = event.get("text")
    if not isinstance(text, str) or len(text.encode("utf-8")) > limit:
        raise ValueError("Expected a bounded text frame")
    message = json.loads(text)
    if not isinstance(message, dict):
        raise ValueError("Expected a JSON object")
    return message


async def broadcast(room: Room, project_id: str, message: dict):
    original_count = len(room.peers)

    async def deliver(peer_id: str, peer: Peer):
        try:
            allowed = await asyncio.wait_for(access(peer.token, project_id), timeout=20)
            if allowed != peer.user_id:
                room.peers.pop(peer_id, None)
                await close_socket(peer.socket, 4403)
                return
            await asyncio.wait_for(peer.socket.send_json(message), timeout=5)
        except (RuntimeError, WebSocketDisconnect, TimeoutError, OSError):
            room.peers.pop(peer_id, None)
            await close_socket(peer.socket, 1013)

    # Authorize/send concurrently so one slow peer cannot serially stall every recipient.
    await asyncio.gather(*(deliver(peer_id, peer) for peer_id, peer in list(room.peers.items())))
    if room.peers and len(room.peers) != original_count:
        presence = {"type": "presence", "count": len(room.peers)}

        async def refresh_presence(peer_id: str, peer: Peer):
            try:
                await asyncio.wait_for(peer.socket.send_json(presence), timeout=5)
            except (RuntimeError, WebSocketDisconnect, TimeoutError, OSError):
                room.peers.pop(peer_id, None)
                await close_socket(peer.socket, 1013)

        await asyncio.gather(
            *(refresh_presence(peer_id, peer) for peer_id, peer in list(room.peers.items()))
        )


@router.websocket("/realtime/projects/{project_id}")
async def project_room(socket: WebSocket, project_id: UUID):
    await socket.accept()
    room_id, peer_id = str(project_id), str(uuid4())
    room = None
    try:
        first = await read_frame(socket, timeout=10, limit=10_000)
        token = first.get("token", "")
        if (
            first.get("type") != "authenticate"
            or not isinstance(token, str)
            or not token
            or len(token) > 8192
        ):
            await close_socket(socket, 4401)
            return
        user_id = await access(token, room_id)
        if not user_id:
            await close_socket(socket, 4403)
            return
        if room_id not in rooms and len(rooms) >= 100:
            await close_socket(socket, 1013)
            return
        room = rooms.setdefault(room_id, Room())
        async with room.lock:
            if len(room.peers) >= 16:
                await close_socket(socket, 1013)
                return
            room.peers[peer_id] = Peer(socket, token, user_id)
            await asyncio.wait_for(
                socket.send_json({"type": "snapshot", "data": room.state, "peer_id": peer_id}),
                timeout=5,
            )
            await broadcast(room, room_id, {"type": "presence", "count": len(room.peers)})
        while True:
            message = await read_frame(socket, timeout=60, limit=8192)
            if message.get("type") == "ping":
                if await access(token, room_id) != user_id:
                    await close_socket(socket, 4403)
                    break
                await asyncio.wait_for(socket.send_json({"type": "pong"}), timeout=5)
                await asyncio.sleep(0.1)
            elif message.get("type") == "state" and isinstance(message.get("data"), dict):
                if await access(token, room_id, edit=True) != user_id:
                    await asyncio.wait_for(
                        socket.send_json({"type": "error", "message": "Editor access required."}),
                        timeout=5,
                    )
                    continue
                async with room.lock:
                    room.state = message["data"]
                    await broadcast(
                        room, room_id, {"type": "state", "data": room.state, "user_id": user_id}
                    )
                await asyncio.sleep(0.1)
            else:
                await asyncio.wait_for(
                    socket.send_json({"type": "error", "message": "Expected ping or state."}),
                    timeout=5,
                )
    except WebSocketDisconnect:
        pass
    except TimeoutError:
        await close_socket(socket, 4408)
    except (ValueError, TypeError, AttributeError, KeyError, RecursionError, RuntimeError):
        await close_socket(socket, 4400)
    finally:
        if room:
            # Remove synchronously even if the hosting ASGI task is being cancelled.
            removed = room.peers.pop(peer_id, None)
            if not room.peers and rooms.get(room_id) is room:
                rooms.pop(room_id, None)
            elif removed:
                # Disconnect cancellation must not interrupt the remaining peers' update.
                # The shield is bounded so shutdown cannot wait indefinitely.
                with anyio.move_on_after(35, shield=True):
                    async with room.lock:
                        await broadcast(
                            room, room_id, {"type": "presence", "count": len(room.peers)}
                        )
