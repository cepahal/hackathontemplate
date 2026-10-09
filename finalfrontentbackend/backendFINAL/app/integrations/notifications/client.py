"""Slack / Discord incoming-webhook notifications.

Webhook URLs are credentials: they come only from the environment (hosts pinned in Settings)
and their paths are never logged.
"""

from typing import ClassVar, Literal

import httpx
from pydantic import SecretStr

from app.integrations.base import ExternalService
from app.integrations.errors import IntegrationNotConfiguredError

Channel = Literal["slack", "discord"]


class _Webhook(ExternalService):
    log_paths: ClassVar[bool] = False

    def auth_headers(self) -> dict[str, str]:
        return {}  # The secret is the URL itself.

    def resolve_base_url(self) -> str:
        return self.credential()


class SlackWebhook(_Webhook):
    service_name: ClassVar[str] = "slack"
    env_var: ClassVar[str] = "SLACK_WEBHOOK_URL"

    async def send(self, text: str) -> None:
        # Escape Slack control characters so user text can't produce @channel mentions or links.
        escaped = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        await self.call_raw("POST", json={"text": escaped})


class DiscordWebhook(_Webhook):
    service_name: ClassVar[str] = "discord"
    env_var: ClassVar[str] = "DISCORD_WEBHOOK_URL"

    async def send(self, text: str) -> None:
        await self.call_raw("POST", json={"content": text[:2000], "allowed_mentions": {"parse": []}})


class NotificationClient:
    def __init__(
        self, http: httpx.AsyncClient, *, slack_webhook_url: SecretStr | None, discord_webhook_url: SecretStr | None
    ) -> None:
        self._channels: dict[Channel, SlackWebhook | DiscordWebhook] = {
            "slack": SlackWebhook(http, slack_webhook_url),
            "discord": DiscordWebhook(http, discord_webhook_url),
        }

    def configured(self, channel: Channel) -> bool:
        return self._channels[channel].configured

    async def send(self, channel: Channel, text: str) -> None:
        if not 1 <= len(text.strip()) <= 2000:
            raise ValueError("text must be 1-2000 characters")
        webhook = self._channels[channel]
        if not webhook.configured:
            raise IntegrationNotConfiguredError(channel, webhook.env_var)
        await webhook.send(text)
