"""Provider-agnostic maps client. Pick the provider with MAPS_PROVIDER (mapbox | google).

Add another provider by subclassing GeocodingProvider; MapsClient and routes stay unchanged.
"""

from abc import ABC, abstractmethod
from typing import ClassVar

from pydantic import BaseModel, Field

from app.integrations.base import ExternalService
from app.integrations.errors import (
    IntegrationAuthError,
    IntegrationRateLimitedError,
    IntegrationRequestError,
)


class GeocodeResult(BaseModel):
    name: str
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    kind: str | None = None


class GeocodingProvider(ExternalService, ABC):
    service_name: ClassVar[str] = "maps"
    env_var: ClassVar[str] = "MAPS_API_KEY"

    def auth_headers(self) -> dict[str, str]:
        return {}  # Map APIs authenticate with a query parameter; see auth_params().

    @abstractmethod
    async def geocode(self, query: str, *, limit: int) -> list[GeocodeResult]: ...


# --- Mapbox Geocoding v6 -------------------------------------------------------------------


class _MapboxProperties(BaseModel):
    name: str | None = None
    full_address: str | None = None
    feature_type: str | None = None


class _MapboxGeometry(BaseModel):
    coordinates: tuple[float, float]


class _MapboxFeature(BaseModel):
    geometry: _MapboxGeometry
    properties: _MapboxProperties


class _MapboxResponse(BaseModel):
    features: list[_MapboxFeature]


class MapboxGeocoder(GeocodingProvider):
    base_url: ClassVar[str] = "https://api.mapbox.com/search/geocode/v6"

    def auth_params(self) -> dict[str, str]:
        return {"access_token": self.credential()}

    async def geocode(self, query: str, *, limit: int) -> list[GeocodeResult]:
        data = await self.call("GET", "/forward", model=_MapboxResponse, params={"q": query, "limit": limit})
        return [
            GeocodeResult(
                name=f.properties.full_address or f.properties.name or query,
                longitude=f.geometry.coordinates[0],
                latitude=f.geometry.coordinates[1],
                kind=f.properties.feature_type,
            )
            for f in data.features
        ]


# --- Google Geocoding API ------------------------------------------------------------------


class _GoogleLocation(BaseModel):
    lat: float
    lng: float


class _GoogleGeometry(BaseModel):
    location: _GoogleLocation


class _GoogleResult(BaseModel):
    formatted_address: str
    geometry: _GoogleGeometry
    types: list[str] = Field(default_factory=list)


class _GoogleResponse(BaseModel):
    status: str
    results: list[_GoogleResult] = Field(default_factory=list)


class GoogleGeocoder(GeocodingProvider):
    base_url: ClassVar[str] = "https://maps.googleapis.com/maps/api"

    def auth_params(self) -> dict[str, str]:
        return {"key": self.credential()}

    async def geocode(self, query: str, *, limit: int) -> list[GeocodeResult]:
        data = await self.call("GET", "/geocode/json", model=_GoogleResponse, params={"address": query})
        # Google reports most failures with HTTP 200 and a status field.
        if data.status == "REQUEST_DENIED":
            raise IntegrationAuthError(self.service_name)
        if data.status == "OVER_QUERY_LIMIT":
            raise IntegrationRateLimitedError(self.service_name)
        if data.status not in {"OK", "ZERO_RESULTS"}:
            raise IntegrationRequestError(self.service_name, f"Geocoding failed with status {data.status}")
        return [
            GeocodeResult(
                name=r.formatted_address,
                latitude=r.geometry.location.lat,
                longitude=r.geometry.location.lng,
                kind=r.types[0] if r.types else None,
            )
            for r in data.results[:limit]
        ]


class MapsClient:
    def __init__(self, geocoder: GeocodingProvider) -> None:
        self._geocoder = geocoder

    @property
    def configured(self) -> bool:
        return self._geocoder.configured

    async def geocode(self, query: str, *, limit: int = 5) -> list[GeocodeResult]:
        query = query.strip()
        if not 1 <= len(query) <= 256:
            raise ValueError("query must be 1-256 characters")
        if not 1 <= limit <= 10:
            raise ValueError("limit must be 1-10")
        return await self._geocoder.geocode(query, limit=limit)
