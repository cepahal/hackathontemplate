"""Builds every integration from Settings. Construction does no I/O, so unconfigured providers
cost nothing until called (and then raise INTEGRATION_NOT_CONFIGURED)."""

from typing import Literal

import httpx

from app.ai.providers.anthropic import AnthropicProvider
from app.ai.providers.base import AIProvider
from app.ai.providers.gemini import GeminiProvider
from app.ai.providers.openai import GrokProvider, OpenAIProvider
from app.core.config import Settings
from app.integrations.email.client import EmailClient, ResendEmailProvider
from app.integrations.github.client import GitHubClient
from app.integrations.maps.client import GeocodingProvider, GoogleGeocoder, MapboxGeocoder, MapsClient
from app.integrations.nessie.client import NessieClient
from app.integrations.notifications.client import NotificationClient
from app.integrations.snowflake.client import SnowflakeClient
from app.integrations.snowflake.cortex import CortexClient
from app.integrations.tigerdata.client import TigerDataClient

AIProviderName = Literal["openai", "gemini", "anthropic", "grok"]
AI_PROVIDER_NAMES: tuple[AIProviderName, ...] = ("openai", "gemini", "anthropic", "grok")


class Integrations:
    def __init__(self, settings: Settings, http: httpx.AsyncClient) -> None:
        self.openai = OpenAIProvider(http, settings.openai_api_key, default_model=settings.openai_model)
        self.gemini = GeminiProvider(http, settings.gemini_api_key, default_model=settings.gemini_model)
        self.anthropic = AnthropicProvider(http, settings.anthropic_api_key, default_model=settings.anthropic_model)
        self.grok = GrokProvider(http, settings.grok_api_key, default_model=settings.grok_model)
        self.github = GitHubClient(http, settings.github_token)
        self.nessie = NessieClient(http, settings.nessie_api_key)
        self.snowflake = SnowflakeClient(
            http,
            settings.snowflake_token,
            account_host=settings.snowflake_account_host,
            token_type=settings.snowflake_token_type,
            warehouse=settings.snowflake_warehouse,
            database=settings.snowflake_database,
            schema=settings.snowflake_schema,
            role=settings.snowflake_role,
        )
        self.snowflake_cortex = CortexClient(
            http,
            settings.snowflake_token,
            account_host=settings.snowflake_account_host,
            token_type=settings.snowflake_token_type,
            default_model=settings.snowflake_cortex_model,
        )
        self.tigerdata = TigerDataClient(settings.tigerdata_dsn, sslrootcert=settings.tigerdata_ssl_root_cert)

        geocoder: GeocodingProvider = (
            GoogleGeocoder(http, settings.maps_api_key)
            if settings.maps_provider == "google"
            else MapboxGeocoder(http, settings.maps_api_key)
        )
        self.maps = MapsClient(geocoder)
        self.email = EmailClient(ResendEmailProvider(http, settings.resend_api_key), default_sender=settings.email_from)
        self.notifications = NotificationClient(
            http, slack_webhook_url=settings.slack_webhook_url, discord_webhook_url=settings.discord_webhook_url
        )

    def ai(self, provider: AIProviderName) -> AIProvider:
        clients: dict[AIProviderName, AIProvider] = {
            "openai": self.openai,
            "gemini": self.gemini,
            "anthropic": self.anthropic,
            "grok": self.grok,
        }
        return clients[provider]

    def status(self) -> dict[str, bool]:
        """Whether each integration has credentials. Never makes network calls or returns secrets."""
        return {
            "openai": self.openai.configured,
            "gemini": self.gemini.configured,
            "anthropic": self.anthropic.configured,
            "grok": self.grok.configured,
            "github": self.github.configured,
            "nessie": self.nessie.configured,
            "snowflake": self.snowflake.configured,
            "snowflake_cortex": self.snowflake_cortex.configured,
            "tigerdata": self.tigerdata.configured,
            "maps": self.maps.configured,
            "email": self.email.configured,
            "slack": self.notifications.configured("slack"),
            "discord": self.notifications.configured("discord"),
        }
