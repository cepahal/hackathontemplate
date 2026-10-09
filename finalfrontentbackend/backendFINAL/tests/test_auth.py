import base64
import json
import time
import uuid
from collections.abc import Callable, Mapping
from typing import Annotated

import jwt
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi import APIRouter, Depends
from fastapi.testclient import TestClient

from app.api.deps import AdminUser, require_role
from app.core.security import AuthenticatedUser
from tests.conftest import ALICE_ID, ISSUER, Jwks, TokenFactory, build_settings
from tests.fakes import InMemoryDB


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def error_code(client: TestClient, token: str) -> str:
    response = client.get("/api/v1/me", headers=bearer(token))
    assert response.status_code == 401, response.text
    assert response.headers["WWW-Authenticate"] == "Bearer"
    code: str = response.json()["error"]["code"]
    return code


def test_valid_token_resolves_user_and_profile(client: TestClient, make_token: TokenFactory, jwks: Jwks) -> None:
    response = client.get("/api/v1/me", headers=bearer(make_token()))
    assert response.status_code == 200
    me = response.json()
    assert me["id"] == str(ALICE_ID)
    assert me["email"] == "alice@example.com"
    assert me["role"] == "user"
    # JWKS is fetched once and cached.
    client.get("/api/v1/me", headers=bearer(make_token()))
    assert jwks.requests == 1


def test_role_comes_from_app_metadata_only(client: TestClient, make_token: TokenFactory) -> None:
    admin = client.get("/api/v1/me", headers=bearer(make_token(app_metadata={"role": "admin"})))
    assert admin.json()["role"] == "admin"

    # user_metadata is user-editable and must never grant a role.
    token = make_token(app_metadata={"provider": "email"})
    assert client.get("/api/v1/me", headers=bearer(token)).json()["role"] == "user"


def test_expired_token(client: TestClient, make_token: TokenFactory) -> None:
    assert error_code(client, make_token(expires_in=-120)) == "TOKEN_EXPIRED"


def test_wrong_audience_issuer_and_role(client: TestClient, make_token: TokenFactory) -> None:
    assert error_code(client, make_token(audience="something-else")) == "INVALID_TOKEN"
    assert error_code(client, make_token(issuer="https://other-project.supabase.co/auth/v1")) == "INVALID_TOKEN"
    # Legacy anon/service keys are JWTs too; they are not user sessions.
    assert error_code(client, make_token(role="anon")) == "INVALID_TOKEN"
    assert error_code(client, make_token(role="service_role")) == "INVALID_TOKEN"


def test_forged_signature_is_rejected(client: TestClient, make_token: TokenFactory) -> None:
    attacker_key = ec.generate_private_key(ec.SECP256R1())
    assert error_code(client, make_token(private_key=attacker_key)) == "INVALID_TOKEN"


def test_tampered_payload_is_rejected(client: TestClient, make_token: TokenFactory) -> None:
    header, payload, signature = make_token().split(".")
    claims = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
    claims["app_metadata"] = {"role": "admin"}
    forged_payload = base64.urlsafe_b64encode(json.dumps(claims).encode()).rstrip(b"=").decode()
    assert error_code(client, f"{header}.{forged_payload}.{signature}") == "INVALID_TOKEN"


def test_alg_none_and_hs256_without_secret_are_rejected(client: TestClient) -> None:
    claims: dict[str, object] = {
        "sub": str(ALICE_ID),
        "aud": "authenticated",
        "iss": ISSUER,
        "role": "authenticated",
        "exp": int(time.time()) + 3600,
    }

    def b64(data: Mapping[str, object]) -> str:
        return base64.urlsafe_b64encode(json.dumps(data).encode()).rstrip(b"=").decode()

    unsigned = f"{b64({'alg': 'none', 'typ': 'JWT'})}.{b64(claims)}."
    assert error_code(client, unsigned) == "INVALID_TOKEN"

    hs256 = jwt.encode(claims, "guessed-secret-that-is-long-enough-32b", algorithm="HS256")
    assert error_code(client, hs256) == "INVALID_TOKEN"


def test_hs256_accepted_when_legacy_secret_configured(client_factory: Callable[..., TestClient]) -> None:
    secret = "legacy-project-jwt-secret-at-least-32-bytes"
    client = client_factory(InMemoryDB(), build_settings(supabase_jwt_secret=secret))
    claims = {
        "sub": str(ALICE_ID),
        "aud": "authenticated",
        "iss": ISSUER,
        "role": "authenticated",
        "exp": int(time.time()) + 3600,
    }
    token = jwt.encode(claims, secret, algorithm="HS256")
    response = client.get("/api/v1/projects", headers=bearer(token))
    assert response.status_code == 200
    assert response.json() == []


def test_unknown_kid_triggers_one_refresh_then_rejects(
    client: TestClient, make_token: TokenFactory, jwks: Jwks
) -> None:
    assert client.get("/api/v1/me", headers=bearer(make_token())).status_code == 200
    assert jwks.requests == 1
    for _ in range(3):
        assert error_code(client, make_token(kid="rotated-away")) == "INVALID_TOKEN"
    # Rate-limited: unknown kids don't hammer the Auth server.
    assert jwks.requests == 1


def test_jwks_outage_is_503_not_401(client: TestClient, make_token: TokenFactory, jwks: Jwks) -> None:
    jwks.fail = True
    response = client.get("/api/v1/me", headers=bearer(make_token()))
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "AUTH_UNAVAILABLE"


def test_non_uuid_subject_is_rejected(client: TestClient, make_token: TokenFactory, jwks: Jwks) -> None:
    now = int(time.time())
    claims = {"sub": "not-a-uuid", "aud": "authenticated", "iss": ISSUER, "role": "authenticated", "exp": now + 60}
    token = jwt.encode(claims, jwks.private_key, algorithm="ES256", headers={"kid": jwks.kid})
    assert error_code(client, token) == "INVALID_TOKEN"


def test_me_without_profile_is_404(client_factory: Callable[..., TestClient], make_token: TokenFactory) -> None:
    client = client_factory(InMemoryDB())
    response = client.get("/api/v1/me", headers=bearer(make_token(uuid.uuid4())))
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "PROFILE_NOT_FOUND"


def test_role_check_dependency(client_factory: Callable[..., TestClient], make_token: TokenFactory) -> None:
    client = client_factory(InMemoryDB())
    probe = APIRouter()

    @probe.get("/admin-probe")
    async def admin_probe(user: AdminUser) -> dict[str, str]:
        return {"id": str(user.id)}

    @probe.get("/user-probe")
    async def user_probe(user: Annotated[AuthenticatedUser, Depends(require_role("user"))]) -> dict[str, str]:
        return {"role": user.role}

    client.app.include_router(probe)  # type: ignore[attr-defined]

    user_token = bearer(make_token())
    admin_token = bearer(make_token(app_metadata={"role": "admin"}))

    forbidden = client.get("/admin-probe", headers=user_token)
    assert forbidden.status_code == 403
    assert forbidden.json()["error"]["code"] == "FORBIDDEN"
    assert client.get("/admin-probe", headers=admin_token).status_code == 200
    assert client.get("/admin-probe").status_code == 401
    assert client.get("/user-probe", headers=admin_token).json() == {"role": "admin"}
