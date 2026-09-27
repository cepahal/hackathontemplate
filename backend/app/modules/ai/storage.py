"""User-JWT Supabase access. Never uses a service-role key."""

from urllib.parse import urlsplit

import httpx
from fastapi import HTTPException

from .config import AISettings


class UserStore:
    def __init__(self, token: str, owner_id: str, settings: AISettings | None = None):
        self.settings = settings or AISettings()
        self.owner_id = str(owner_id)
        self.token = token
        self.url = self.settings.supabase_url.rstrip("/")
        parsed = urlsplit(self.url)
        if not self.url or not self.settings.supabase_anon_key:
            raise HTTPException(503, "Configure SUPABASE_URL and SUPABASE_ANON_KEY")
        if not parsed.hostname or (
            parsed.scheme != "https"
            and not (parsed.scheme == "http" and parsed.hostname in {"localhost", "127.0.0.1"})
        ):
            raise HTTPException(503, "SUPABASE_URL must use HTTPS or a local development address")
        if parsed.username or parsed.password or parsed.query or parsed.fragment:
            raise HTTPException(503, "Invalid SUPABASE_URL configuration")

    async def request(self, method: str, resource: str, *, params=None, body=None):
        headers = {
            "apikey": self.settings.supabase_anon_key,
            "Authorization": f"Bearer {self.token}",
            "Prefer": "return=representation",
        }
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                response = await client.request(
                    method,
                    f"{self.url}/rest/v1/{resource}",
                    headers=headers,
                    params=params,
                    json=body,
                )
        except httpx.TransportError as exc:
            raise HTTPException(503, "Document and agent storage is unavailable") from exc
        if response.status_code in {401, 403}:
            raise HTTPException(403, "Storage access denied for this user")
        if response.status_code == 409:
            raise HTTPException(409, "Storage record already exists or conflicts with current data")
        if response.is_error:
            raise HTTPException(
                503, "Storage request failed; check database migrations and policies"
            )
        if not response.content:
            return []
        try:
            return response.json()
        except ValueError as exc:
            raise HTTPException(502, "Storage returned an invalid response") from exc

    def owned(self, **extra):
        return {"owner_id": f"eq.{self.owner_id}", **extra}

    async def get_one(self, table: str, record_id: str):
        records = await self.request(
            "GET", table, params=self.owned(id=f"eq.{record_id}", limit="1")
        )
        if not records:
            raise HTTPException(404, "Record not found")
        return records[0]
