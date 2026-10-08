"""Integration errors. They extend AppError, so routes return the standard JSON error shape.

Provider failures map to 502/503/504 (never 401): a provider rejecting *our* key must not look
like the end user's session expired.
"""

from app.core.errors import AppError


class IntegrationError(AppError):
    status_code = 502
    code = "INTEGRATION_ERROR"

    def __init__(
        self, service: str, message: str | None = None, *, upstream_status: int | None = None, code: str | None = None
    ) -> None:
        details: dict[str, object] = {"service": service}
        if upstream_status is not None:
            details["upstream_status"] = upstream_status
        super().__init__(message or self.default_message(service), code=code, details=details)
        self.service = service
        self.upstream_status = upstream_status

    def default_message(self, service: str) -> str:
        return f"The {service} request failed"


class IntegrationNotConfiguredError(IntegrationError):
    status_code = 503
    code = "INTEGRATION_NOT_CONFIGURED"

    def __init__(self, service: str, env_var: str) -> None:
        super().__init__(service, f"{service} is not configured. Set {env_var} in backendFINAL/.env.")
        self.env_var = env_var
        self.details = {"service": service, "env_var": env_var}


class IntegrationTimeoutError(IntegrationError):
    status_code = 504
    code = "INTEGRATION_TIMEOUT"

    def default_message(self, service: str) -> str:
        return f"{service} did not respond in time"


class IntegrationUnavailableError(IntegrationError):
    status_code = 502
    code = "INTEGRATION_UNAVAILABLE"

    def default_message(self, service: str) -> str:
        return f"{service} is unavailable right now"


class IntegrationRateLimitedError(IntegrationError):
    status_code = 503
    code = "INTEGRATION_RATE_LIMITED"

    def default_message(self, service: str) -> str:
        return f"{service} rate limit reached; try again shortly"


class IntegrationAuthError(IntegrationError):
    status_code = 502
    code = "INTEGRATION_AUTH_FAILED"

    def default_message(self, service: str) -> str:
        return f"{service} rejected the configured credentials, or the provider account lacks access or credits"


class IntegrationRequestError(IntegrationError):
    status_code = 502
    code = "INTEGRATION_REQUEST_FAILED"

    def default_message(self, service: str) -> str:
        return f"{service} rejected the request"


class IntegrationInvalidResponseError(IntegrationError):
    status_code = 502
    code = "INTEGRATION_INVALID_RESPONSE"

    def default_message(self, service: str) -> str:
        return f"{service} returned an unexpected response"
