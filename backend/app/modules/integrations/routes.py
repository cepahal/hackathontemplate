import hashlib
import json
import re
from typing import Annotated, Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field

from app.modules.identity.dependencies import get_current_user
from app.modules.identity.schemas import AuthenticatedUser
from app.modules.integrations.client import cached, provider_request, remember
from app.modules.integrations.settings import IntegrationSettings

router = APIRouter(prefix="/integrations", tags=["integrations"])
CurrentUser = Annotated[AuthenticatedUser, Depends(get_current_user)]


class IntegrationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    operation: str = Field(min_length=1, max_length=40)
    params: dict[str, Any] = Field(default_factory=dict)
    confirm: bool = False


def required(value: str, setting: str) -> str:
    if not value:
        raise HTTPException(503, f"Configure {setting} before using this integration.")
    return value


def text_param(params: dict, name: str, maximum: int = 500) -> str:
    value = params.get(name)
    if not isinstance(value, str) or not value.strip() or len(value) > maximum:
        raise HTTPException(
            422, f"{name} must be a nonempty string of at most {maximum} characters."
        )
    return value.strip()


@router.get("/catalog")
async def catalog(user: CurrentUser):
    s = IntegrationSettings()
    entries = [
        ("github", "GitHub", True, ["repositories"]),
        ("google_maps", "Google Maps", bool(s.google_maps_api_key), ["geocode"]),
        ("discord", "Discord", bool(s.discord_bot_token), ["send_message"]),
        ("slack", "Slack", bool(s.slack_bot_token), ["send_message"]),
        (
            "twilio",
            "Twilio",
            bool(s.twilio_account_sid and s.twilio_auth_token and s.twilio_from_number),
            ["send_sms"],
        ),
        ("spotify", "Spotify", bool(s.spotify_client_id and s.spotify_client_secret), ["search"]),
        ("youtube", "YouTube", bool(s.youtube_api_key), ["search"]),
    ]
    return {
        "items": [
            {"id": key, "name": name, "configured": ready, "operations": ops}
            for key, name, ready, ops in entries
        ]
    }


@router.get("/github/repos")
async def github_repos(
    username: Annotated[str, Query(pattern=r"^[A-Za-z0-9][A-Za-z0-9-]{0,38}$")],
    user: CurrentUser,
    page: Annotated[int, Query(ge=1, le=100)] = 1,
):
    s = IntegrationSettings()
    key = f"github:{username.lower()}:{page}"
    if (entry := cached(key)) is not None:
        return entry
    headers = {"Accept": "application/vnd.github+json"}
    if s.github_token:
        headers["Authorization"] = f"Bearer {s.github_token}"
    data, response_headers = await provider_request(
        "GET",
        f"https://api.github.com/users/{username}/repos",
        headers=headers,
        params={"per_page": 20, "page": page, "sort": "updated", "type": "owner"},
    )
    if not isinstance(data, list) or any(
        not isinstance(item, dict)
        or not isinstance(item.get("id"), int)
        or not isinstance(item.get("name"), str)
        or not isinstance(item.get("html_url"), str)
        for item in data
    ):
        raise HTTPException(502, "GitHub returned an invalid repository response.")
    result = {
        "items": [
            {
                "id": item["id"],
                "name": item["name"],
                "url": item["html_url"],
                "description": item.get("description"),
            }
            for item in data
        ],
        "next_page": page + 1 if 'rel="next"' in response_headers.get("Link", "") else None,
    }
    remember(key, result)
    return result


@router.post("/{provider}/execute")
async def execute(provider: str, payload: IntegrationRequest, user: CurrentUser):
    try:
        return await execute_operation(provider, payload, user)
    except (KeyError, TypeError, ValueError, AttributeError, IndexError) as exc:
        raise HTTPException(502, "External provider returned an invalid response.") from exc


async def execute_operation(provider: str, payload: IntegrationRequest, user: AuthenticatedUser):
    # Shared server credentials must not let ordinary accounts message or spend as the owner.
    if user.role != "admin":
        raise HTTPException(403, "Administrator role required for shared provider integrations.")
    if len(json.dumps(payload.params)) > 10_000:
        raise HTTPException(413, "Integration parameters too large.")
    s = IntegrationSettings()
    p, operation = payload.params, payload.operation
    write = (provider, operation) in {
        ("slack", "send_message"),
        ("discord", "send_message"),
        ("twilio", "send_sms"),
    }
    if write and not payload.confirm:
        raise HTTPException(409, "Review the destination and message, then set confirm=true.")
    cache_key = (
        f"{user.id}:{provider}:{operation}:"
        + hashlib.sha256(json.dumps(p, sort_keys=True).encode()).hexdigest()
    )
    if not write and (entry := cached(cache_key)) is not None:
        return entry
    if provider == "github" and operation == "repositories":
        username = text_param(p, "username", 39)
        if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9-]{0,38}", username):
            raise HTTPException(422, "Invalid GitHub username.")
        return await github_repos(username=username, page=1, user=user)
    if provider == "google_maps" and operation == "geocode":
        data, _ = await provider_request(
            "GET",
            "https://maps.googleapis.com/maps/api/geocode/json",
            params={
                "address": text_param(p, "address"),
                "key": required(s.google_maps_api_key, "GOOGLE_MAPS_API_KEY"),
            },
        )
        if data.get("status") not in {"OK", "ZERO_RESULTS"}:
            raise HTTPException(502, "Google Maps rejected the request.")
        result = {
            "items": [
                {"name": row["formatted_address"], "location": row["geometry"]["location"]}
                for row in data.get("results", [])
            ]
        }
    elif provider == "slack" and operation == "send_message":
        data, _ = await provider_request(
            "POST",
            "https://slack.com/api/chat.postMessage",
            headers={"Authorization": f"Bearer {required(s.slack_bot_token, 'SLACK_BOT_TOKEN')}"},
            json={
                "channel": text_param(p, "channel", 100),
                "text": text_param(p, "text", 3000),
                "unfurl_links": False,
                "unfurl_media": False,
            },
        )
        if not data.get("ok"):
            raise HTTPException(502, "Slack rejected the message.")
        result = {"id": data["ts"], "channel": data["channel"], "status": "sent"}
    elif provider == "discord" and operation == "send_message":
        channel = text_param(p, "channel", 30)
        if not channel.isdigit():
            raise HTTPException(422, "Discord channel must be a numeric ID.")
        data, _ = await provider_request(
            "POST",
            f"https://discord.com/api/v10/channels/{channel}/messages",
            headers={"Authorization": f"Bot {required(s.discord_bot_token, 'DISCORD_BOT_TOKEN')}"},
            json={"content": text_param(p, "text", 2000), "allowed_mentions": {"parse": []}},
        )
        result = {"id": data["id"], "channel": data["channel_id"], "status": "sent"}
    elif provider == "twilio" and operation == "send_sms":
        destination = text_param(p, "to", 16)
        if not re.fullmatch(r"\+[1-9]\d{7,14}", destination):
            raise HTTPException(422, "to must be an E.164 phone number.")
        sid = required(s.twilio_account_sid, "TWILIO_ACCOUNT_SID")
        if not re.fullmatch(r"AC[0-9a-fA-F]{32}", sid):
            raise HTTPException(503, "Invalid TWILIO_ACCOUNT_SID configuration.")
        data, _ = await provider_request(
            "POST",
            f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json",
            auth=httpx.BasicAuth(sid, required(s.twilio_auth_token, "TWILIO_AUTH_TOKEN")),
            data={
                "To": destination,
                "From": required(s.twilio_from_number, "TWILIO_FROM_NUMBER"),
                "Body": text_param(p, "text", 1600),
            },
        )
        result = {"id": data["sid"], "status": data["status"]}
    elif provider == "spotify" and operation == "search":
        token, _ = await provider_request(
            "POST",
            "https://accounts.spotify.com/api/token",
            auth=httpx.BasicAuth(
                required(s.spotify_client_id, "SPOTIFY_CLIENT_ID"),
                required(s.spotify_client_secret, "SPOTIFY_CLIENT_SECRET"),
            ),
            data={"grant_type": "client_credentials"},
        )
        data, _ = await provider_request(
            "GET",
            "https://api.spotify.com/v1/search",
            headers={"Authorization": f"Bearer {token['access_token']}"},
            params={"q": text_param(p, "query", 200), "type": "track", "limit": 10},
        )
        result = {
            "items": [
                {"id": row["id"], "name": row["name"], "url": row["external_urls"].get("spotify")}
                for row in data["tracks"]["items"]
            ]
        }
    elif provider == "youtube" and operation == "search":
        params = {
            "q": text_param(p, "query", 200),
            "part": "snippet",
            "type": "video",
            "maxResults": 10,
            "key": required(s.youtube_api_key, "YOUTUBE_API_KEY"),
        }
        if p.get("page_token"):
            params["pageToken"] = text_param(p, "page_token", 200)
        data, _ = await provider_request(
            "GET", "https://www.googleapis.com/youtube/v3/search", params=params
        )
        result = {
            "items": [
                {
                    "id": row["id"]["videoId"],
                    "name": row["snippet"]["title"],
                    "url": "https://www.youtube.com/watch?v=" + row["id"]["videoId"],
                }
                for row in data.get("items", [])
            ],
            "next_page_token": data.get("nextPageToken"),
        }
    else:
        raise HTTPException(400, "Unsupported provider or operation.")
    if not write:
        remember(cache_key, result)
    return result
