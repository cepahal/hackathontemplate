"""Server-only Snowflake SQL API client. Never expose execute() as a public SQL endpoint."""

import asyncio
import math
import re
from collections.abc import Mapping
from typing import ClassVar, Literal
from uuid import uuid4

import httpx
from pydantic import BaseModel, ConfigDict, Field, SecretStr, ValidationError

from app.integrations.base import ExternalService
from app.integrations.errors import (
    IntegrationInvalidResponseError,
    IntegrationNotConfiguredError,
    IntegrationRateLimitedError,
    IntegrationTimeoutError,
)
from app.integrations.http import NO_RETRY, HttpClient

SnowflakeTokenType = Literal["PROGRAMMATIC_ACCESS_TOKEN", "OAUTH"]
_DEFAULT_AUTH_TYPE: SnowflakeTokenType = "PROGRAMMATIC_ACCESS_TOKEN"
_HOST = re.compile(r"(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+snowflakecomputing\.com")
_HANDLE = re.compile(r"^[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$")


class SnowflakeBinding(BaseModel):
    """A scalar bind value; caller SQL uses ? placeholders, never string interpolation."""

    model_config = ConfigDict(extra="forbid", strict=True)

    type: Literal["TEXT", "FIXED", "REAL", "BOOLEAN"]
    value: str | None = Field(max_length=100_000)


class SnowflakeColumn(BaseModel):
    name: str
    type: str


class SnowflakeMetadata(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    num_rows: int = Field(alias="numRows", ge=0)
    columns: list[SnowflakeColumn] = Field(alias="rowType")


class SnowflakeResult(BaseModel):
    """First result partition only; num_rows exposes when additional partitions exist."""

    model_config = ConfigDict(populate_by_name=True)

    code: Literal["090001"]
    statement_handle: str = Field(alias="statementHandle", pattern=_HANDLE.pattern)
    metadata: SnowflakeMetadata = Field(alias="resultSetMetaData")
    data: list[list[str | None]]

    @property
    def has_more_rows(self) -> bool:
        return self.metadata.num_rows > len(self.data)


class _PendingStatement(BaseModel):
    statement_handle: str = Field(alias="statementHandle", pattern=_HANDLE.pattern)


class _SnowflakeHttpClient(HttpClient):
    def _error_for(self, response: httpx.Response, method: str, log_path: str) -> Exception:
        # Snowflake diagnostics may contain SQL, bindings or arbitrary credential strings.
        # Preserve the shared status mapping while keeping those bodies out of its logger.
        safe_response = httpx.Response(response.status_code, headers=response.headers)
        return super()._error_for(safe_response, method, log_path)


class SnowflakeClient(ExternalService):
    service_name: ClassVar[str] = "snowflake"
    env_var: ClassVar[str] = "SNOWFLAKE_TOKEN"

    def __init__(
        self,
        http: httpx.AsyncClient,
        token: SecretStr | None,
        *,
        account_host: str | None = None,
        token_type: SnowflakeTokenType = _DEFAULT_AUTH_TYPE,
        warehouse: str | None = None,
        database: str | None = None,
        schema: str | None = None,
        role: str | None = None,
        max_poll_attempts: int = 20,
        poll_interval_seconds: float = 0.5,
        poll_timeout_seconds: float = 45.0,
        statement_timeout_seconds: int = 30,
    ) -> None:
        super().__init__(http, token)
        host = account_host.strip().lower() if account_host else ""
        if host and (len(host) > 253 or not _HOST.fullmatch(host)):
            raise ValueError("SNOWFLAKE_ACCOUNT_HOST must be an account hostname under snowflakecomputing.com")
        if http.follow_redirects:
            raise ValueError("Snowflake requires an HTTP client with redirects disabled")
        if token_type not in ("PROGRAMMATIC_ACCESS_TOKEN", "OAUTH"):
            raise ValueError("invalid Snowflake token type")
        if not 1 <= max_poll_attempts <= 100 or not 1 <= statement_timeout_seconds <= 120:
            raise ValueError("invalid Snowflake polling or statement timeout limit")
        if not math.isfinite(poll_interval_seconds) or not 0 <= poll_interval_seconds <= 10:
            raise ValueError("poll_interval_seconds must be between 0 and 10")
        if not math.isfinite(poll_timeout_seconds) or not 0 < poll_timeout_seconds <= 120:
            raise ValueError("poll_timeout_seconds must be between 0 and 120")
        self._account_host = host
        self._token_type = token_type
        self._context = {"warehouse": warehouse, "database": database, "schema": schema, "role": role}
        for value in self._context.values():
            if value is not None and (not 1 <= len(value) <= 255 or any(ord(c) < 32 for c in value)):
                raise ValueError("invalid Snowflake statement context")
        self._max_poll_attempts = max_poll_attempts
        self._poll_interval_seconds = poll_interval_seconds
        self._poll_timeout_seconds = poll_timeout_seconds
        self._statement_timeout_seconds = statement_timeout_seconds

    @property
    def configured(self) -> bool:
        return super().configured and bool(self._account_host)

    def resolve_base_url(self) -> str:
        if not self._account_host:
            raise IntegrationNotConfiguredError(self.service_name, "SNOWFLAKE_ACCOUNT_HOST")
        return f"https://{self._account_host}/api/v2"

    def auth_headers(self) -> dict[str, str]:
        return {
            **super().auth_headers(),
            "X-Snowflake-Authorization-Token-Type": self._token_type,
            "Accept": "application/json",
        }

    @property
    def client(self) -> HttpClient:
        if self._client is None:
            self._client = _SnowflakeHttpClient(
                self._http,
                service=self.service_name,
                base_url=self.resolve_base_url(),
                headers=self.default_headers(),
                timeout_seconds=self.timeout_seconds,
                retry=NO_RETRY,
                log_paths=False,
            )
        return self._client

    async def execute(
        self, statement: str, *, bindings: Mapping[str, SnowflakeBinding] | None = None
    ) -> SnowflakeResult:
        """Execute one trusted server-side statement. No automatic submission retries."""
        if not statement.strip() or len(statement) > 100_000:
            raise ValueError("statement must be 1-100000 characters")
        body: dict[str, object] = {
            "statement": statement,
            "timeout": self._statement_timeout_seconds,
            "parameters": {"MULTI_STATEMENT_COUNT": "1"},
            **{key: value for key, value in self._context.items() if value is not None},
        }
        if bindings is not None:
            if len(bindings) > 1000 or any(not re.fullmatch(r"[1-9][0-9]{0,3}", key) for key in bindings):
                raise ValueError("bindings must use positive positional indexes (maximum 1000 values)")
            body["bindings"] = {key: value.model_dump() for key, value in bindings.items()}
        try:
            async with asyncio.timeout(self._poll_timeout_seconds):
                response = await self.call_raw(
                    "POST",
                    "/statements",
                    params={"async": "true", "requestId": str(uuid4())},
                    json=body,
                    idempotent=False,
                )
                for attempt in range(self._max_poll_attempts + 1):
                    if response.status_code == 200:
                        return self._result(response)
                    if response.status_code != 202:
                        raise IntegrationInvalidResponseError(self.service_name)
                    handle = self._pending_handle(response)
                    if attempt == self._max_poll_attempts:
                        break
                    await asyncio.sleep(self._poll_interval_seconds)
                    try:
                        response = await self.call_raw("GET", f"/statements/{handle}")
                    except IntegrationRateLimitedError:
                        # Snowflake can use 429 for a still-running statement. Preserve the
                        # previous validated handle and count this toward the same poll budget.
                        continue
        except TimeoutError:
            raise IntegrationTimeoutError(self.service_name) from None
        raise IntegrationTimeoutError(self.service_name)

    def _pending_handle(self, response: httpx.Response) -> str:
        try:
            return _PendingStatement.model_validate(response.json()).statement_handle
        except (ValueError, ValidationError):
            raise IntegrationInvalidResponseError(self.service_name) from None

    def _result(self, response: httpx.Response) -> SnowflakeResult:
        try:
            return SnowflakeResult.model_validate(response.json())
        except (ValueError, ValidationError):
            raise IntegrationInvalidResponseError(self.service_name) from None

    async def read_demo(self) -> SnowflakeResult:
        """A bound, read-only transport probe; does not create or alter account data."""
        return await self.execute("SELECT ? AS API_READY", bindings={"1": SnowflakeBinding(type="TEXT", value="OK")})
