import hashlib
import hmac
import json
import time
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.main import create_app
from app.modules.commerce import routes
from app.modules.commerce.settings import CommerceSettings
from app.modules.commerce.signatures import verify_stripe_signature
from app.modules.identity.dependencies import get_current_user
from app.modules.identity.schemas import AuthenticatedUser

OWNER = "10000000-0000-4000-8000-000000000001"


@pytest.fixture
def billing(monkeypatch):
    settings = CommerceSettings(
        _env_file=None,
        stripe_secret_key="sk_test_example",
        stripe_webhook_secret="whsec_test",
        stripe_allowed_price_ids=["price_test"],
        app_public_url="https://app.example.com",
        supabase_url="https://test.supabase.co",
        supabase_anon_key="public-key",
        supabase_service_role_key="service-test-key",
    )
    monkeypatch.setattr(routes, "billing_settings", lambda: settings)

    async def unexpected(*_args, **_kwargs):
        raise AssertionError("Unexpected external request")

    monkeypatch.setattr(routes, "upstream", unexpected)
    app = create_app()
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(id=UUID(OWNER))
    with TestClient(app) as client:
        yield client, settings


def event():
    return {
        "id": "evt_test",
        "type": "checkout.session.completed",
        "created": int(time.time()),
        "data": {
            "object": {
                "id": "cs_test",
                "mode": "payment",
                "payment_status": "paid",
                "customer": "cus_test",
                "metadata": {"user_id": OWNER, "price_id": "price_test"},
            }
        },
    }


def post_event(client, data, timestamp=None):
    body = json.dumps(data).encode()
    timestamp = int(time.time()) if timestamp is None else timestamp
    signature = hmac.new(
        b"whsec_test", str(timestamp).encode() + b"." + body, hashlib.sha256
    ).hexdigest()
    return client.post(
        "/api/v1/billing/webhook",
        content=body,
        headers={
            "Stripe-Signature": f"t={timestamp},v1={signature}",
            "Content-Type": "application/json",
        },
    )


def test_checkout_binds_owner_price_and_retry_key(billing, monkeypatch):
    client, _ = billing
    key = str(uuid4())
    captured = []

    async def stripe(method, url, **kwargs):
        assert method == "POST" and url == "https://api.stripe.com/v1/checkout/sessions"
        captured.append(kwargs)
        return {"id": "cs_test", "url": "https://checkout.stripe.com/c/pay/test"}

    monkeypatch.setattr(routes, "upstream", stripe)
    for _ in range(2):
        result = client.post(
            "/api/v1/billing/checkout",
            json={"price_id": "price_test"},
            headers={"Idempotency-Key": key},
        )
        assert result.status_code == 200
    assert captured[0]["headers"]["Idempotency-Key"] == captured[1]["headers"]["Idempotency-Key"]
    assert captured[0]["data"]["metadata[user_id]"] == OWNER
    assert captured[0]["data"]["subscription_data[metadata][user_id]"] == OWNER
    assert captured[0]["data"]["success_url"] == "https://app.example.com/?checkout=success"


@pytest.mark.parametrize(
    "body,status",
    [
        ({"price_id": "price_other"}, 400),
        ({"price_id": "price_test", "owner_id": OWNER}, 422),
        ({"price_id": "price_test", "mode": "invalid"}, 422),
    ],
)
def test_checkout_rejects_unapproved_input_without_external_calls(billing, body, status):
    assert billing[0].post("/api/v1/billing/checkout", json=body).status_code == status


@pytest.mark.parametrize("key", ["sk_live_example", "rk_live_example"])
def test_live_mode_requires_explicit_opt_in(billing, key):
    client, settings = billing
    settings.stripe_secret_key = key
    assert (
        client.post("/api/v1/billing/checkout", json={"price_id": "price_test"}).status_code == 503
    )


def test_checkout_rejects_invalid_idempotency_key(billing):
    response = billing[0].post(
        "/api/v1/billing/checkout",
        json={"price_id": "price_test"},
        headers={"Idempotency-Key": "bad"},
    )
    assert response.status_code == 422


@pytest.mark.parametrize(
    "field,value",
    [
        ("supabase_url", "http://untrusted.example"),
        ("supabase_url", "https://user:secret@example.com"),
        ("app_public_url", "https://example.com/redirect"),
        ("supabase_anon_key", "sb_secret_private"),
    ],
)
def test_billing_config_rejects_unsafe_origins_and_public_secrets(field, value):
    with pytest.raises(ValidationError):
        CommerceSettings(_env_file=None, **{field: value})


def test_webhook_rejects_missing_tampered_and_expired_signatures(billing):
    client, _ = billing
    assert client.post("/api/v1/billing/webhook", json=event()).status_code == 400
    assert post_event(client, event(), int(time.time()) - 301).status_code == 400
    assert (
        client.post(
            "/api/v1/billing/webhook", content=b"{}", headers={"Stripe-Signature": "t=1,v1=bad"}
        ).status_code
        == 400
    )


@pytest.mark.parametrize("created", [True, -1, "123", float("inf"), None, 10**40])
def test_signed_malformed_timestamps_fail_cleanly(billing, created):
    data = event()
    data["created"] = created
    assert post_event(billing[0], data).status_code == 400


@pytest.mark.parametrize("metadata", [[], "bad", {"user_id": 123}, {"user_id": "not-uuid"}, {}])
def test_signed_malformed_metadata_fails_cleanly(billing, metadata):
    data = event()
    data["data"]["object"]["metadata"] = metadata
    assert post_event(billing[0], data).status_code == 400


def test_order_event_uses_atomic_service_role_rpc_and_duplicate_result(billing, monkeypatch):
    captured = []

    async def rpc(method, url, **kwargs):
        assert method == "POST" and url.endswith("/rest/v1/rpc/apply_billing_event")
        captured.append(kwargs)
        return len(captured) == 1

    monkeypatch.setattr(routes, "upstream", rpc)
    first = post_event(billing[0], event())
    second = post_event(billing[0], event())
    assert first.json() == {"received": True, "applied": True}
    assert second.json() == {"received": True, "applied": False}
    assert captured[0]["json"]["p_owner_id"] == OWNER
    assert captured[0]["json"]["p_status"] == "paid"
    assert captured[0]["headers"]["apikey"] == "service-test-key"


def test_subscription_webhook_refreshes_authoritative_status(billing, monkeypatch):
    data = event()
    data["type"] = "customer.subscription.updated"
    data["data"]["object"].update(id="sub_test", status="past_due")
    calls = []

    async def upstream(method, url, **kwargs):
        calls.append((method, url, kwargs))
        if method == "GET":
            return {**data["data"]["object"], "status": "active"}
        return True

    monkeypatch.setattr(routes, "upstream", upstream)
    assert post_event(billing[0], data).status_code == 200
    assert calls[0][1] == "https://api.stripe.com/v1/subscriptions/sub_test"
    assert calls[1][2]["json"]["p_status"] == "active"


def test_billing_status_and_portal_use_only_owned_customer(billing, monkeypatch):
    client, _ = billing
    calls = []

    async def upstream(method, url, **kwargs):
        calls.append((method, url, kwargs))
        if method == "GET":
            assert kwargs["params"]["owner_id"] == f"eq.{OWNER}"
            assert kwargs["headers"]["Authorization"] == "Bearer user-token"
            assert kwargs["headers"]["apikey"] == "public-key"
            return [{"customer_id": "cus_owned"}] if url.endswith("billing_subscriptions") else []
        assert kwargs["data"]["customer"] == "cus_owned"
        return {"url": "https://billing.stripe.com/p/session/test"}

    monkeypatch.setattr(routes, "upstream", upstream)
    response = client.post(
        "/api/v1/billing/portal",
        json={"customer": "cus_attacker"},
        headers={"Authorization": "Bearer user-token"},
    )
    assert response.status_code == 200
    assert len(calls) == 3


def test_rotating_signature_accepts_any_valid_v1_value():
    body, timestamp = b"payload", 100
    digest = hmac.new(b"secret", b"100.payload", hashlib.sha256).hexdigest()
    verify_stripe_signature(body, f"t={timestamp},v1=old,v1={digest}", "secret", now=100)
    with pytest.raises(ValueError):
        verify_stripe_signature(b"changed", f"t={timestamp},v1={digest}", "secret", now=100)


def test_checkout_and_portal_require_authentication():
    with TestClient(create_app()) as client:
        assert (
            client.post("/api/v1/billing/checkout", json={"price_id": "price_test"}).status_code
            == 401
        )
        assert client.post("/api/v1/billing/portal").status_code == 401
