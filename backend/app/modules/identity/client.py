"""User-token REST calls preserve Supabase row-level security."""

from typing import Any

import httpx
from fastapi import HTTPException

from app.modules.identity.settings import IdentitySettings


class SupabaseGateway:
    def __init__(self, settings: IdentitySettings, client: httpx.AsyncClient, token: str):
        self.settings = settings
        self.client = client
        self.token = token

    async def request(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, str | int] | None = None,
        payload: dict[str, Any] | None = None,
        representation: bool = False,
    ) -> Any:
        headers = {
            "apikey": self.settings.supabase_anon_key.get_secret_value(),
            "Authorization": f"Bearer {self.token}",
            "Accept": "application/json",
        }
        if representation:
            headers["Prefer"] = "return=representation"
        try:
            response = await self.client.request(
                method,
                self.settings.supabase_url + path,
                headers=headers,
                params=params,
                json=payload,
            )
        except httpx.TimeoutException as exc:
            raise HTTPException(504, "The identity or database service timed out.") from exc
        except httpx.RequestError as exc:
            raise HTTPException(502, "The identity or database service is unavailable.") from exc

        if response.status_code == 401:
            raise HTTPException(
                401, "Your session is invalid or expired.", headers={"WWW-Authenticate": "Bearer"}
            )
        if response.status_code == 403:
            raise HTTPException(403, "You do not have permission to perform this operation.")
        if response.status_code == 429:
            retry = response.headers.get("Retry-After", "60")
            if not retry.isdecimal() or not 0 < int(retry) <= 3600:
                retry = "60"
            raise HTTPException(
                429, "The service is busy. Try again later.", headers={"Retry-After": retry}
            )
        if response.status_code == 409:
            raise HTTPException(409, "The operation conflicts with existing data.")
        if not 200 <= response.status_code < 300:
            # Upstream bodies may contain SQL, provider internals, or credentials.
            raise HTTPException(502, "The identity or database service rejected the operation.")
        if response.status_code == 204 or not response.content:
            return None
        try:
            return response.json()
        except ValueError as exc:
            raise HTTPException(502, "The service returned an invalid response.") from exc
