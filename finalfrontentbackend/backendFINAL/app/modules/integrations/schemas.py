from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints

from app.integrations.notifications.client import Channel


class IntegrationStatus(BaseModel):
    """True when credentials are present. Says nothing about whether the provider is reachable."""

    openai: bool
    gemini: bool
    anthropic: bool
    grok: bool
    github: bool
    maps: bool
    email: bool
    slack: bool
    discord: bool


class TestEmailRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    subject: Annotated[str, StringConstraints(min_length=1, max_length=200, pattern=r"^[^\r\n]+$")]
    html: Annotated[str, StringConstraints(min_length=1, max_length=20_000)]


class NotificationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    channel: Channel
    text: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]
