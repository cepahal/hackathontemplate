from typing import Literal

from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    service: Literal["hackathon-api"] = "hackathon-api"
    environment: Literal["development", "test", "production"]
    version: str
