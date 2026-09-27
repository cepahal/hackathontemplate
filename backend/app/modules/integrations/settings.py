from pydantic_settings import BaseSettings, SettingsConfigDict

from app.core.config import BACKEND_DIR


class IntegrationSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")
    github_token: str = ""
    github_webhook_secret: str = ""
    google_maps_api_key: str = ""
    discord_bot_token: str = ""
    slack_bot_token: str = ""
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_from_number: str = ""
    spotify_client_id: str = ""
    spotify_client_secret: str = ""
    youtube_api_key: str = ""
    oauth_state_secret: str = ""
