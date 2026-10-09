"""Provider-agnostic email client with a Resend adapter (https://resend.com/docs/api-reference)."""

import re
from abc import ABC, abstractmethod
from collections.abc import Sequence
from typing import ClassVar

from pydantic import BaseModel, Field, field_validator

from app.integrations.base import ExternalService
from app.integrations.errors import IntegrationNotConfiguredError

_EMAIL = re.compile(r"[^@\s<>,;]+@[^@\s<>,;]+\.[^@\s<>,;]+")


class EmailMessage(BaseModel):
    sender: str
    to: list[str] = Field(min_length=1, max_length=50)
    subject: str = Field(min_length=1, max_length=200)
    html: str = Field(min_length=1, max_length=200_000)
    text: str | None = Field(default=None, max_length=200_000)
    reply_to: str | None = None

    @field_validator("to")
    @classmethod
    def _validate_recipients(cls, value: list[str]) -> list[str]:
        for address in value:
            if not _EMAIL.fullmatch(address):
                raise ValueError(f"invalid email address: {address!r}")
        return value

    @field_validator("subject")
    @classmethod
    def _single_line_subject(cls, value: str) -> str:
        if "\r" in value or "\n" in value:
            raise ValueError("subject must be a single line")
        return value


class EmailResult(BaseModel):
    id: str
    provider: str


class EmailProvider(ExternalService, ABC):
    service_name: ClassVar[str] = "email"

    @abstractmethod
    async def send(self, message: EmailMessage, *, idempotency_key: str | None = None) -> EmailResult: ...


class _ResendResponse(BaseModel):
    id: str


class ResendEmailProvider(EmailProvider):
    env_var: ClassVar[str] = "RESEND_API_KEY"
    base_url: ClassVar[str] = "https://api.resend.com"

    async def send(self, message: EmailMessage, *, idempotency_key: str | None = None) -> EmailResult:
        body: dict[str, object] = {
            "from": message.sender,
            "to": message.to,
            "subject": message.subject,
            "html": message.html,
        }
        if message.text:
            body["text"] = message.text
        if message.reply_to:
            body["reply_to"] = message.reply_to
        headers = {"Idempotency-Key": idempotency_key} if idempotency_key else None
        # Sending is not idempotent: only retry when Resend can deduplicate via the key.
        data = await self.call(
            "POST", "/emails", model=_ResendResponse, json=body, headers=headers, idempotent=idempotency_key is not None
        )
        return EmailResult(id=data.id, provider="resend")


class EmailClient:
    def __init__(self, provider: EmailProvider, *, default_sender: str | None) -> None:
        self._provider = provider
        self._default_sender = default_sender

    @property
    def configured(self) -> bool:
        return self._provider.configured and self._default_sender is not None

    async def send_email(
        self,
        to: str | Sequence[str],
        subject: str,
        html: str,
        *,
        text: str | None = None,
        reply_to: str | None = None,
        sender: str | None = None,
        idempotency_key: str | None = None,
    ) -> EmailResult:
        if not self._provider.configured:
            raise IntegrationNotConfiguredError(self._provider.service_name, self._provider.env_var)
        from_address = sender or self._default_sender
        if from_address is None:
            raise IntegrationNotConfiguredError("email", "EMAIL_FROM")
        message = EmailMessage(
            sender=from_address,
            to=[to] if isinstance(to, str) else list(to),
            subject=subject,
            html=html,
            text=text,
            reply_to=reply_to,
        )
        return await self._provider.send(message, idempotency_key=idempotency_key)
