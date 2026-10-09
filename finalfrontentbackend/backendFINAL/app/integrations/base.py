"""Base adapter for external services.

    authenticate (auth_headers / auth_params) → request (HttpClient) → validate (Pydantic) → typed result

A new provider subclasses ExternalService, sets four class attributes and writes typed methods
that call `self.call(...)`. Credentials are passed in from Settings, never read from code.
"""

from collections.abc import AsyncGenerator, Mapping
from typing import ClassVar

import httpx
from pydantic import SecretStr

from app.integrations.errors import IntegrationNotConfiguredError
from app.integrations.http import HttpClient, HttpMethod, JsonBody, ModelT, QueryParams, RetryPolicy


class ExternalService:
    service_name: ClassVar[str]
    env_var: ClassVar[str]
    base_url: ClassVar[str] = ""
    timeout_seconds: ClassVar[float] = 15.0
    retry: ClassVar[RetryPolicy] = RetryPolicy()
    # Set False when the URL path itself is secret (e.g. webhook URLs).
    log_paths: ClassVar[bool] = True

    def __init__(self, http: httpx.AsyncClient, credential: SecretStr | None) -> None:
        self._http = http
        self._credential = credential
        self._client: HttpClient | None = None

    @property
    def configured(self) -> bool:
        return self._credential is not None and bool(self._credential.get_secret_value())

    def credential(self) -> str:
        value = self._credential.get_secret_value() if self._credential is not None else ""
        if not value:
            raise IntegrationNotConfiguredError(self.service_name, self.env_var)
        return value

    # --- authenticate -------------------------------------------------------------------
    def auth_headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.credential()}"}

    def auth_params(self) -> dict[str, str]:
        return {}

    def default_headers(self) -> dict[str, str]:
        return {"User-Agent": "hackathon-backend/1.0"}

    def resolve_base_url(self) -> str:
        return self.base_url

    # --- request + validate -------------------------------------------------------------
    @property
    def client(self) -> HttpClient:
        if self._client is None:
            self._client = HttpClient(
                self._http,
                service=self.service_name,
                base_url=self.resolve_base_url(),
                headers=self.default_headers(),
                timeout_seconds=self.timeout_seconds,
                retry=self.retry,
                log_paths=self.log_paths,
            )
        return self._client

    async def call(
        self,
        method: HttpMethod,
        path: str,
        *,
        model: type[ModelT],
        params: QueryParams | None = None,
        json: JsonBody | None = None,
        headers: Mapping[str, str] | None = None,
        idempotent: bool | None = None,
    ) -> ModelT:
        """Authenticated JSON request validated into `model`."""
        auth_headers = self.auth_headers()
        return await self.client.request_json(
            method,
            path,
            model=model,
            params={**(params or {}), **self.auth_params()},
            json=json,
            headers={**auth_headers, **(headers or {})},
            idempotent=idempotent,
        )

    def call_stream(
        self,
        method: HttpMethod,
        path: str,
        *,
        params: QueryParams | None = None,
        json: JsonBody | None = None,
        headers: Mapping[str, str] | None = None,
        idempotent: bool | None = None,
    ) -> AsyncGenerator[str]:
        """Authenticated streaming request; yields response lines."""
        auth_headers = self.auth_headers()
        return self.client.stream_lines(
            method,
            path,
            params={**(params or {}), **self.auth_params()},
            json=json,
            headers={**auth_headers, **(headers or {})},
            idempotent=idempotent,
        )

    async def call_raw(
        self,
        method: HttpMethod,
        path: str = "",
        *,
        params: QueryParams | None = None,
        json: JsonBody | None = None,
        headers: Mapping[str, str] | None = None,
        idempotent: bool | None = None,
    ) -> httpx.Response:
        """Authenticated request for endpoints that don't return JSON."""
        auth_headers = self.auth_headers()
        return await self.client.request(
            method,
            path,
            params={**(params or {}), **self.auth_params()},
            json=json,
            headers={**auth_headers, **(headers or {})},
            idempotent=idempotent,
        )
