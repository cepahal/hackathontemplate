"""Reusable async HTTP client for external APIs.

- Fixed base URL per client; only relative paths are accepted (no user-controlled URLs → no SSRF).
- Timeouts, retries with exponential backoff + jitter for transient failures, Retry-After support.
- Non-idempotent requests (POST/PATCH) are only retried when the request provably never reached
  the server, on 429, or when the caller marks the call idempotent (e.g. with an idempotency key).
- Structured errors (app.integrations.errors) and logs that never include headers, query strings,
  bodies or credentials.
"""

import asyncio
import logging
import random
import re
import time
from collections.abc import AsyncGenerator, Awaitable, Callable, Mapping
from dataclasses import dataclass, field
from typing import Literal, TypedDict, TypeVar, Unpack

import httpx
from pydantic import BaseModel, ValidationError

from app.integrations.errors import (
    IntegrationAuthError,
    IntegrationInvalidResponseError,
    IntegrationRateLimitedError,
    IntegrationRequestError,
    IntegrationTimeoutError,
    IntegrationUnavailableError,
)

logger = logging.getLogger(__name__)

HttpMethod = Literal["GET", "POST", "PUT", "PATCH", "DELETE"]
QueryValue = str | int | float | bool | None
QueryParams = Mapping[str, QueryValue]
JsonBody = Mapping[str, object] | list[object]
ModelT = TypeVar("ModelT", bound=BaseModel)


class RequestOptions(TypedDict, total=False):
    params: QueryParams | None
    json: JsonBody | None
    headers: Mapping[str, str] | None
    timeout_seconds: float | None
    idempotent: bool | None


IDEMPOTENT_METHODS: frozenset[str] = frozenset({"GET", "PUT", "DELETE"})
# Raised before any byte reached the server: safe to retry for every method.
NOT_SENT_ERRORS: tuple[type[httpx.TransportError], ...] = (httpx.ConnectError, httpx.ConnectTimeout, httpx.PoolTimeout)

_SECRET_PATTERN = re.compile(
    r"(sk-[A-Za-z0-9_-]{8,}|xai-[A-Za-z0-9]{8,}|gh[pousr]_[A-Za-z0-9]{8,}|github_pat_[A-Za-z0-9_]{8,}"
    r"|AIza[0-9A-Za-z_-]{8,}|re_[A-Za-z0-9_]{8,}|pk\.[A-Za-z0-9._-]{8,}|Bearer\s+\S+)"
)


def redact(text: str) -> str:
    return _SECRET_PATTERN.sub("[REDACTED]", text)


@dataclass(frozen=True, slots=True)
class RetryPolicy:
    max_attempts: int = 3
    base_delay_seconds: float = 0.5
    max_delay_seconds: float = 8.0
    retry_statuses: frozenset[int] = field(default_factory=lambda: frozenset({429, 500, 502, 503, 504}))

    def delay(self, attempt: int, response: httpx.Response | None = None) -> float:
        if response is not None:
            retry_after = response.headers.get("retry-after", "")
            if retry_after.isdigit():
                return min(float(retry_after), self.max_delay_seconds)
        backoff = min(self.max_delay_seconds, self.base_delay_seconds * 2 ** (attempt - 1))
        return random.uniform(0, backoff)  # noqa: S311 - jitter, not cryptography


NO_RETRY = RetryPolicy(max_attempts=1)


class HttpClient:
    def __init__(
        self,
        http: httpx.AsyncClient,
        *,
        service: str,
        base_url: str,
        headers: Mapping[str, str] | None = None,
        timeout_seconds: float = 15.0,
        retry: RetryPolicy | None = None,
        log_paths: bool = True,
        max_response_bytes: int = 5_000_000,
        sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
    ) -> None:
        self._http = http
        self.service = service
        self._base_url = base_url.rstrip("/")
        self._headers = dict(headers or {})
        self._timeout = timeout_seconds
        self._retry = retry or RetryPolicy()
        self._log_paths = log_paths
        self._max_bytes = max_response_bytes
        self._sleep = sleep

    def _url(self, path: str) -> str:
        if "://" in path or path.startswith(("//", "\\")) or ".." in path.split("/"):
            raise ValueError(f"{self.service}: only paths relative to the configured base URL are allowed")
        return f"{self._base_url}/{path.lstrip('/')}" if path else self._base_url

    def _log_path(self, path: str) -> str:
        return path.split("?", 1)[0] or "/" if self._log_paths else "<redacted>"

    async def request(
        self,
        method: HttpMethod,
        path: str = "",
        *,
        params: QueryParams | None = None,
        json: JsonBody | None = None,
        headers: Mapping[str, str] | None = None,
        timeout_seconds: float | None = None,
        idempotent: bool | None = None,
    ) -> httpx.Response:
        url = self._url(path)
        log_path = self._log_path(path)
        retry_after_send = method in IDEMPOTENT_METHODS if idempotent is None else idempotent
        query = {key: value for key, value in (params or {}).items() if value is not None}
        attempts = self._retry.max_attempts

        for attempt in range(1, attempts + 1):
            started = time.perf_counter()
            try:
                response = await self._http.request(
                    method,
                    url,
                    params=query,
                    json=json,
                    headers={**self._headers, **(headers or {})},
                    timeout=timeout_seconds or self._timeout,
                )
            except NOT_SENT_ERRORS as exc:
                failure: Exception = exc
                retryable = True
            except httpx.TransportError as exc:
                failure = exc
                retryable = retry_after_send
            else:
                self._log_response(method, log_path, response.status_code, started, attempt)
                status = response.status_code
                may_retry = retry_after_send or status == 429
                if status in self._retry.retry_statuses and may_retry and attempt < attempts:
                    await self._sleep(self._retry.delay(attempt, response))
                    continue
                if response.is_error:
                    raise self._error_for(response, method, log_path)
                if len(response.content) > self._max_bytes:
                    raise IntegrationInvalidResponseError(self.service, "Response was larger than allowed")
                return response

            self._log_failure(method, log_path, failure, attempt, attempts)
            if retryable and attempt < attempts:
                await self._sleep(self._retry.delay(attempt))
                continue
            raise self._transport_error(failure)

        raise AssertionError("unreachable")  # pragma: no cover

    async def stream_lines(
        self,
        method: HttpMethod,
        path: str = "",
        *,
        params: QueryParams | None = None,
        json: JsonBody | None = None,
        headers: Mapping[str, str] | None = None,
        timeout_seconds: float | None = None,
        idempotent: bool | None = None,
    ) -> AsyncGenerator[str]:
        """Streams the response body line by line (SSE / NDJSON APIs).

        Retries follow request()'s rules but only until a successful response starts: once a line
        has been yielded nothing is retried. `timeout_seconds` bounds connecting and each read (the
        gap between chunks), not the whole stream; callers enforce an overall deadline.
        """
        url = self._url(path)
        log_path = self._log_path(path)
        retry_after_send = method in IDEMPOTENT_METHODS if idempotent is None else idempotent
        query = {key: value for key, value in (params or {}).items() if value is not None}
        attempts = self._retry.max_attempts

        for attempt in range(1, attempts + 1):
            started = time.perf_counter()
            retry_delay: float | None = None
            try:
                async with self._http.stream(
                    method,
                    url,
                    params=query,
                    json=json,
                    headers={**self._headers, **(headers or {})},
                    timeout=timeout_seconds or self._timeout,
                ) as response:
                    self._log_response(method, log_path, response.status_code, started, attempt)
                    status = response.status_code
                    may_retry = retry_after_send or status == 429
                    if status in self._retry.retry_statuses and may_retry and attempt < attempts:
                        retry_delay = self._retry.delay(attempt, response)
                    elif response.is_error:
                        await response.aread()
                        raise self._error_for(response, method, log_path)
                    else:
                        received = 0
                        async for line in response.aiter_lines():
                            received += len(line) + 1
                            if received > self._max_bytes:
                                raise IntegrationInvalidResponseError(self.service, "Stream was larger than allowed")
                            yield line
                        return
            except NOT_SENT_ERRORS as exc:
                self._log_failure(method, log_path, exc, attempt, attempts)
                if attempt >= attempts:
                    raise self._transport_error(exc) from None
                retry_delay = self._retry.delay(attempt)
            except httpx.TransportError as exc:
                self._log_failure(method, log_path, exc, attempt, attempts)
                raise self._transport_error(exc) from None
            if retry_delay is not None:
                await self._sleep(retry_delay)

    def _log_response(self, method: str, log_path: str, status: int, started: float, attempt: int) -> None:
        elapsed_ms = (time.perf_counter() - started) * 1000
        logger.info("%s %s %s -> %s (%.0f ms, attempt %d)", self.service, method, log_path, status, elapsed_ms, attempt)

    def _log_failure(self, method: str, log_path: str, failure: Exception, attempt: int, attempts: int) -> None:
        logger.warning(
            "%s %s %s failed: %s (attempt %d/%d)",
            self.service,
            method,
            log_path,
            type(failure).__name__,
            attempt,
            attempts,
        )

    def _transport_error(self, failure: Exception) -> Exception:
        if isinstance(failure, httpx.TimeoutException):
            return IntegrationTimeoutError(self.service)
        return IntegrationUnavailableError(self.service)

    async def request_json(
        self,
        method: HttpMethod,
        path: str,
        *,
        model: type[ModelT],
        params: QueryParams | None = None,
        json: JsonBody | None = None,
        headers: Mapping[str, str] | None = None,
        timeout_seconds: float | None = None,
        idempotent: bool | None = None,
    ) -> ModelT:
        has_accept = any(key.lower() == "accept" for key in self._headers)
        response = await self.request(
            method,
            path,
            params=params,
            json=json,
            headers={**({} if has_accept else {"Accept": "application/json"}), **(headers or {})},
            timeout_seconds=timeout_seconds,
            idempotent=idempotent,
        )
        try:
            payload = response.json()
        except ValueError:
            logger.warning("%s %s %s returned non-JSON content", self.service, method, self._log_path(path))
            raise IntegrationInvalidResponseError(self.service, "Response was not valid JSON") from None
        try:
            return model.model_validate(payload)
        except ValidationError as exc:
            logger.warning(
                "%s %s %s response failed validation (%d errors, first at %s)",
                self.service,
                method,
                self._log_path(path),
                exc.error_count(),
                ".".join(str(part) for part in exc.errors()[0]["loc"]) if exc.errors() else "?",
            )
            raise IntegrationInvalidResponseError(self.service, "Response did not match the expected shape") from None

    async def get(self, path: str = "", **options: Unpack[RequestOptions]) -> httpx.Response:
        return await self.request("GET", path, **options)

    async def post(self, path: str = "", **options: Unpack[RequestOptions]) -> httpx.Response:
        return await self.request("POST", path, **options)

    async def put(self, path: str = "", **options: Unpack[RequestOptions]) -> httpx.Response:
        return await self.request("PUT", path, **options)

    async def patch(self, path: str = "", **options: Unpack[RequestOptions]) -> httpx.Response:
        return await self.request("PATCH", path, **options)

    async def delete(self, path: str = "", **options: Unpack[RequestOptions]) -> httpx.Response:
        return await self.request("DELETE", path, **options)

    def _error_for(self, response: httpx.Response, method: str, log_path: str) -> Exception:
        status = response.status_code
        logger.warning(
            "%s %s %s -> %s: %s", self.service, method, log_path, status, _provider_message(response) or "(no message)"
        )
        rate_limited = status == 429 or (status == 403 and response.headers.get("x-ratelimit-remaining") == "0")
        if rate_limited:
            return IntegrationRateLimitedError(self.service, upstream_status=status)
        if status in (401, 403):
            return IntegrationAuthError(self.service, upstream_status=status)
        if status >= 500:
            return IntegrationUnavailableError(self.service, upstream_status=status)
        return IntegrationRequestError(self.service, upstream_status=status)


def _provider_message(response: httpx.Response) -> str | None:
    """A short, redacted error message from the provider, for server logs only."""
    try:
        payload = response.json()
    except ValueError:
        return redact(response.text[:200]) if response.text else None
    message: object = None
    if isinstance(payload, dict):
        error = payload.get("error")
        if isinstance(error, dict):
            message = error.get("message") or error.get("type")
        elif isinstance(error, str):
            message = error
        message = message or payload.get("message") or payload.get("status")
    return redact(str(message)[:300]) if message else None
