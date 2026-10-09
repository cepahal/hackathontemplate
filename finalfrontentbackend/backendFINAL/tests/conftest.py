import os

# Set before `app` is imported so the module-level app never depends on a developer's .env.
os.environ.update(
    {
        "ENVIRONMENT": "test",
        "SUPABASE_URL": "https://test-project.supabase.co",
        "SUPABASE_ANON_KEY": "sb_publishable_test_only",
        "FRONTEND_URL": "http://localhost:3000",
    }
)

import time  # noqa: E402
import uuid  # noqa: E402
from collections.abc import Callable, Iterator  # noqa: E402
from dataclasses import dataclass, field  # noqa: E402

import httpx  # noqa: E402
import jwt  # noqa: E402
import pytest  # noqa: E402
from cryptography.hazmat.primitives.asymmetric import ec  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from pydantic_settings import BaseSettings, PydanticBaseSettingsSource  # noqa: E402

from app.api.deps import get_integrations, get_token_verifier, get_user_db  # noqa: E402
from app.core.config import Settings  # noqa: E402
from app.core.security import TokenVerifier  # noqa: E402
from app.db.supabase import UserDB  # noqa: E402
from app.integrations.http import RetryPolicy  # noqa: E402
from app.integrations.registry import Integrations  # noqa: E402
from app.main import create_app  # noqa: E402
from tests.fakes import InMemoryDB  # noqa: E402

SUPABASE_URL = "https://test-project.supabase.co"
ISSUER = f"{SUPABASE_URL}/auth/v1"
KID = "test-signing-key"
ALICE_ID = uuid.UUID("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
BOB_ID = uuid.UUID("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")
FRONTEND = "http://localhost:3000"


@dataclass
class Jwks:
    """Mock Supabase JWKS endpoint backed by a real EC P-256 key pair."""

    private_key: ec.EllipticCurvePrivateKey = field(default_factory=lambda: ec.generate_private_key(ec.SECP256R1()))
    kid: str = KID
    requests: int = 0
    fail: bool = False

    def document(self) -> dict[str, object]:
        public_jwk = jwt.algorithms.ECAlgorithm.to_jwk(self.private_key.public_key(), as_dict=True)
        return {"keys": [{**public_jwk, "kid": self.kid, "alg": "ES256", "use": "sig"}]}

    def handler(self, request: httpx.Request) -> httpx.Response:
        assert request.url == httpx.URL(f"{ISSUER}/.well-known/jwks.json")
        self.requests += 1
        if self.fail:
            return httpx.Response(503)
        return httpx.Response(200, json=self.document())


TokenFactory = Callable[..., str]


class IsolatedSettings(Settings):
    """Settings built only from explicit values: a developer's os.environ or .env (which may hold
    real API keys) never leaks into tests."""

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls: type[BaseSettings],
        init_settings: PydanticBaseSettingsSource,
        env_settings: PydanticBaseSettingsSource,
        dotenv_settings: PydanticBaseSettingsSource,
        file_secret_settings: PydanticBaseSettingsSource,
    ) -> tuple[PydanticBaseSettingsSource, ...]:
        return (init_settings,)


def build_settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "environment": "test",
        "supabase_url": SUPABASE_URL,
        "supabase_anon_key": "sb_publishable_test_only",
        "frontend_url": FRONTEND,
        **overrides,
    }
    return IsolatedSettings.model_validate(values)


@pytest.fixture
def settings() -> Settings:
    return build_settings()


@pytest.fixture
def jwks() -> Jwks:
    return Jwks()


@pytest.fixture
def make_token(jwks: Jwks) -> TokenFactory:
    def factory(
        user_id: uuid.UUID = ALICE_ID,
        *,
        email: str | None = "alice@example.com",
        role: str = "authenticated",
        app_metadata: dict[str, object] | None = None,
        expires_in: int = 3600,
        audience: str = "authenticated",
        issuer: str = ISSUER,
        kid: str | None = None,
        private_key: ec.EllipticCurvePrivateKey | None = None,
    ) -> str:
        now = int(time.time())
        claims: dict[str, object] = {
            "sub": str(user_id),
            "aud": audience,
            "iss": issuer,
            "iat": now,
            "exp": now + expires_in,
            "role": role,
            "email": email,
            "app_metadata": app_metadata or {"provider": "email"},
            "session_id": str(uuid.uuid4()),
        }
        return jwt.encode(claims, private_key or jwks.private_key, algorithm="ES256", headers={"kid": kid or jwks.kid})

    return factory


@pytest.fixture
def fake_db() -> InMemoryDB:
    db = InMemoryDB()
    db.add_profile(ALICE_ID, "alice@example.com")
    db.add_profile(BOB_ID, "bob@example.com")
    return db


@pytest.fixture
def client_factory(jwks: Jwks) -> Iterator[Callable[..., TestClient]]:
    clients: list[TestClient] = []

    def factory(db: UserDB, settings: Settings | None = None, integrations: Integrations | None = None) -> TestClient:
        settings = settings or build_settings()
        app = create_app(settings)
        # MockTransport holds no sockets, so this client needs no explicit close.
        verifier = TokenVerifier(settings, httpx.AsyncClient(transport=httpx.MockTransport(jwks.handler)))
        app.dependency_overrides[get_token_verifier] = lambda: verifier
        app.dependency_overrides[get_user_db] = lambda: db
        if integrations is not None:
            app.dependency_overrides[get_integrations] = lambda: integrations
        client = TestClient(app)
        client.__enter__()
        clients.append(client)
        return client

    yield factory
    for client in clients:
        client.__exit__(None, None, None)


@pytest.fixture
def instant_retries(monkeypatch: pytest.MonkeyPatch) -> None:
    """Integration retries still happen, but without backoff sleeps."""
    monkeypatch.setattr(RetryPolicy, "delay", lambda self, attempt, response=None: 0.0)


@pytest.fixture
def client(client_factory: Callable[..., TestClient], fake_db: InMemoryDB) -> TestClient:
    return client_factory(fake_db)


@pytest.fixture
def alice(make_token: TokenFactory) -> dict[str, str]:
    return {"Authorization": f"Bearer {make_token(ALICE_ID)}"}


@pytest.fixture
def bob(make_token: TokenFactory) -> dict[str, str]:
    return {"Authorization": f"Bearer {make_token(BOB_ID, email='bob@example.com')}"}
