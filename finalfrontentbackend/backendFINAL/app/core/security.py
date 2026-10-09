"""Supabase access-token verification and role helpers.

Identity always comes from a verified JWT, never from request bodies or query parameters.
Roles come from `app_metadata.role`, which only the service role can write (matches the
frontend's src/lib/roles.ts and the profiles.role mirror in databaseFINAL).
"""

import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Literal
from uuid import UUID

import httpx
import jwt

from app.core.config import Settings
from app.core.errors import ServiceUnavailableError, UnauthorizedError

logger = logging.getLogger(__name__)

Role = Literal["user", "admin"]
ROLE_RANK: dict[Role, int] = {"user": 0, "admin": 1}

JWT_AUDIENCE = "authenticated"
ASYMMETRIC_ALGORITHMS = frozenset({"ES256", "RS256"})


def parse_role(app_metadata: object) -> Role:
    if isinstance(app_metadata, dict) and app_metadata.get("role") == "admin":
        return "admin"
    return "user"


def has_role(role: Role, required: Role) -> bool:
    return ROLE_RANK[role] >= ROLE_RANK[required]


@dataclass(frozen=True, slots=True)
class AuthenticatedUser:
    id: UUID
    email: str | None
    role: Role
    session_id: str | None
    # Forwarded to PostgREST so queries run as this user under RLS. Never logged.
    access_token: str = field(repr=False)


def _invalid_token(message: str = "Invalid access token") -> UnauthorizedError:
    return UnauthorizedError(message, code="INVALID_TOKEN")


class TokenVerifier:
    """Verifies Supabase user JWTs.

    ES256/RS256 tokens (Supabase JWT signing keys) are checked against the project's public
    JWKS, cached in memory. HS256 tokens are accepted only when SUPABASE_JWT_SECRET is set.
    """

    def __init__(
        self,
        settings: Settings,
        http: httpx.AsyncClient,
        *,
        jwks_ttl_seconds: float = 600.0,
        min_refresh_interval_seconds: float = 30.0,
        leeway_seconds: float = 10.0,
    ) -> None:
        self._http = http
        self._jwks_url = settings.jwks_url
        self._issuer = settings.jwt_issuer
        self._hs256_secret = settings.supabase_jwt_secret.get_secret_value() if settings.supabase_jwt_secret else None
        self._ttl = jwks_ttl_seconds
        self._min_refresh = min_refresh_interval_seconds
        self._leeway = leeway_seconds
        self._keys: dict[str, jwt.PyJWK] = {}
        self._fetched_at: float | None = None
        self._lock = asyncio.Lock()

    async def verify(self, token: str) -> AuthenticatedUser:
        try:
            header = jwt.get_unverified_header(token)
        except jwt.InvalidTokenError:
            raise _invalid_token() from None

        alg = header.get("alg")
        key: jwt.PyJWK | str
        if alg in ASYMMETRIC_ALGORITHMS:
            key = await self._signing_key(header.get("kid"), alg)
        elif alg == "HS256" and self._hs256_secret:
            key = self._hs256_secret
        else:
            if alg == "HS256":
                logger.warning("Rejected an HS256 token: set SUPABASE_JWT_SECRET for legacy JWT projects")
            raise _invalid_token()

        try:
            claims = jwt.decode(
                token,
                key,
                algorithms=[alg],
                audience=JWT_AUDIENCE,
                issuer=self._issuer,
                leeway=self._leeway,
                options={"require": ["exp", "sub", "aud", "iss"]},
            )
        except jwt.ExpiredSignatureError:
            raise UnauthorizedError("Access token has expired", code="TOKEN_EXPIRED") from None
        except jwt.InvalidTokenError:
            raise _invalid_token() from None

        return self._to_user(claims, token)

    @staticmethod
    def _to_user(claims: dict[str, object], token: str) -> AuthenticatedUser:
        # The anon/service keys of legacy projects are JWTs signed with the same secret;
        # only real user sessions carry role=authenticated and a user id.
        if claims.get("role") != "authenticated":
            raise _invalid_token("Token is not a signed-in user session")
        try:
            user_id = UUID(str(claims["sub"]))
        except ValueError:
            raise _invalid_token() from None
        email = claims.get("email")
        session_id = claims.get("session_id")
        return AuthenticatedUser(
            id=user_id,
            email=email if isinstance(email, str) and email else None,
            role=parse_role(claims.get("app_metadata")),
            session_id=session_id if isinstance(session_id, str) else None,
            access_token=token,
        )

    async def _signing_key(self, kid: object, alg: str) -> jwt.PyJWK:
        if not isinstance(kid, str) or not kid:
            raise _invalid_token()

        if self._needs_refresh(kid in self._keys):
            async with self._lock:
                if self._needs_refresh(kid in self._keys):
                    await self._refresh()

        key = self._keys.get(kid)
        if key is None or key.algorithm_name != alg:
            raise _invalid_token()
        return key

    def _needs_refresh(self, kid_known: bool) -> bool:
        if self._fetched_at is None:
            return True
        age = time.monotonic() - self._fetched_at
        if age >= self._ttl:
            return True
        # Unknown kid: the project may have rotated keys. Rate-limited so random kids can't
        # make us hammer the Auth server.
        return not kid_known and age >= self._min_refresh

    async def _refresh(self) -> None:
        try:
            response = await self._http.get(self._jwks_url, timeout=5.0)
            response.raise_for_status()
            payload = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            if self._keys:
                logger.warning("JWKS refresh failed (%s); using cached keys", type(exc).__name__)
                self._fetched_at = time.monotonic() - self._ttl + self._min_refresh
                return
            logger.error("Could not fetch Supabase JWKS from %s: %s", self._jwks_url, type(exc).__name__)
            raise ServiceUnavailableError(
                "Could not verify the access token right now", code="AUTH_UNAVAILABLE"
            ) from None

        keys: dict[str, jwt.PyJWK] = {}
        raw_keys = payload.get("keys") if isinstance(payload, dict) else None
        for jwk in raw_keys if isinstance(raw_keys, list) else []:
            if not isinstance(jwk, dict):
                continue
            kid = jwk.get("kid")
            if not isinstance(kid, str) or jwk.get("alg") not in ASYMMETRIC_ALGORITHMS:
                continue
            if jwk.get("use", "sig") != "sig":
                continue
            try:
                keys[kid] = jwt.PyJWK(jwk)
            except (jwt.PyJWKError, jwt.InvalidKeyError):
                logger.warning("Skipping unusable JWKS key %s", kid)
        self._keys = keys
        self._fetched_at = time.monotonic()
