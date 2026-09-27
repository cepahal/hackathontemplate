import json
import re
from typing import Annotated, Literal
from urllib.parse import urlsplit
from uuid import UUID, uuid4

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.modules.commerce.settings import CommerceSettings
from app.modules.commerce.signatures import verify_stripe_signature
from app.modules.identity.dependencies import get_current_user
from app.modules.identity.schemas import AuthenticatedUser

CurrentUser = Annotated[AuthenticatedUser, Depends(get_current_user)]

router = APIRouter(prefix="/billing", tags=["billing"])


class CheckoutRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    price_id: str = Field(pattern=r"^price_[A-Za-z0-9]+$", max_length=100)
    mode: Literal["payment", "subscription"] = "subscription"


def billing_settings() -> CommerceSettings:
    try:
        return CommerceSettings()
    except (ValidationError, ValueError) as exc:
        raise HTTPException(503, "Billing configuration is invalid.") from exc


def configured(settings: CommerceSettings, *, webhook: bool = False) -> None:
    if not settings.stripe_secret_key:
        raise HTTPException(503, "Configure STRIPE_SECRET_KEY before using billing.")
    if (
        settings.stripe_secret_key.startswith(("sk_live_", "rk_live_"))
        and not settings.allow_live_payments
    ):
        raise HTTPException(503, "Live payments are disabled; configure Stripe test keys.")
    if webhook and not settings.stripe_webhook_secret:
        raise HTTPException(503, "Configure STRIPE_WEBHOOK_SECRET.")


async def upstream(method: str, url: str, **kwargs):
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=False) as client:
            response = await client.request(method, url, **kwargs)
        if response.status_code == 429:
            raise HTTPException(429, "Billing provider rate limit; retry later.")
        if not 200 <= response.status_code < 300:
            raise HTTPException(
                502, "Billing provider request failed; inspect server configuration."
            )
        if len(response.content) > 2_000_000:
            raise ValueError("Oversized response")
        return response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(502, "Billing provider unavailable.") from exc


@router.post("/checkout")
async def checkout(
    payload: CheckoutRequest,
    user: CurrentUser,
    idempotency_key: Annotated[UUID | None, Header()] = None,
):
    settings = billing_settings()
    configured(settings)
    if payload.price_id not in settings.stripe_allowed_price_ids:
        raise HTTPException(400, "Price is not in the server's allowed price list.")
    origin = settings.app_public_url.rstrip("/")
    parsed = urlsplit(origin)
    if (
        parsed.scheme != "https"
        or not parsed.hostname
        or parsed.query
        or parsed.fragment
        or parsed.username is not None
        or parsed.password is not None
        or parsed.path not in {"", "/"}
    ):
        raise HTTPException(503, "Configure APP_PUBLIC_URL with your deployed HTTPS frontend URL.")
    fields = {
        "mode": payload.mode,
        "line_items[0][price]": payload.price_id,
        "line_items[0][quantity]": "1",
        "client_reference_id": str(user.id),
        "metadata[user_id]": str(user.id),
        "metadata[price_id]": payload.price_id,
        "success_url": origin + "/?checkout=success",
        "cancel_url": origin + "/?checkout=cancelled",
    }
    if payload.mode == "subscription":
        fields["subscription_data[metadata][user_id]"] = str(user.id)
        fields["subscription_data[metadata][price_id]"] = payload.price_id
    else:
        fields["payment_intent_data[metadata][user_id]"] = str(user.id)
    result = await upstream(
        "POST",
        "https://api.stripe.com/v1/checkout/sessions",
        data=fields,
        headers={
            "Authorization": f"Bearer {settings.stripe_secret_key}",
            "Idempotency-Key": f"checkout:{user.id}:{idempotency_key or uuid4()}",
        },
    )
    if not isinstance(result, dict) or not result.get("url") or not result.get("id"):
        raise HTTPException(502, "Stripe returned an incomplete checkout session.")
    return {"url": result["url"], "session_id": result["id"]}


@router.get("/status")
async def billing_status(request: Request, user: CurrentUser):
    settings = billing_settings()
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise HTTPException(503, "Configure Supabase before reading billing status.")
    headers = {
        "apikey": settings.supabase_anon_key,
        "Authorization": request.headers.get("Authorization", ""),
    }
    result = {}
    for table, key in [("billing_subscriptions", "subscriptions"), ("billing_orders", "orders")]:
        result[key] = await upstream(
            "GET",
            f"{settings.supabase_url.rstrip('/')}/rest/v1/{table}",
            headers=headers,
            params={
                "owner_id": f"eq.{user.id}",
                "select": "*",
                "limit": "50",
                "order": "updated_at.desc",
            },
        )
        if not isinstance(result[key], list) or any(
            not isinstance(row, dict) for row in result[key]
        ):
            raise HTTPException(502, "Billing storage returned an invalid response.")
    return result


def validate_event_object(obj, status_code: int = 400):
    if not isinstance(obj, dict) or not isinstance(obj.get("id"), str):
        raise HTTPException(status_code, "Invalid billing event object.")
    if not re.fullmatch(r"[A-Za-z0-9_]{1,200}", obj["id"]):
        raise HTTPException(status_code, "Invalid billing object ID.")
    if obj.get("metadata") is not None and not isinstance(obj["metadata"], dict):
        raise HTTPException(status_code, "Invalid billing event metadata.")
    for field in ("status", "payment_status", "mode", "customer"):
        if obj.get(field) is not None and not isinstance(obj[field], str):
            raise HTTPException(status_code, "Invalid billing event fields.")


@router.post("/webhook")
async def stripe_webhook(request: Request):
    settings = billing_settings()
    configured(settings, webhook=True)
    body = bytearray()
    async for part in request.stream():
        body.extend(part)
        if len(body) > 1_048_576:
            raise HTTPException(413, "Webhook body too large.")
    try:
        verify_stripe_signature(
            bytes(body), request.headers.get("Stripe-Signature", ""), settings.stripe_webhook_secret
        )
        event = json.loads(body)
        event_id, event_type = event["id"], event["type"]
        created, obj = event["created"], event["data"]["object"]
        if (
            not isinstance(event_id, str)
            or not re.fullmatch(r"evt_[A-Za-z0-9]{1,200}", event_id)
            or not isinstance(event_type, str)
            or len(event_type) > 200
            or type(created) is not int
            or not 0 <= created <= 253402300799
        ):
            raise ValueError("Invalid event")
    except (ValueError, KeyError, TypeError) as exc:
        raise HTTPException(400, "Invalid signed Stripe event.") from exc
    supported = {
        "checkout.session.completed",
        "checkout.session.async_payment_succeeded",
        "checkout.session.async_payment_failed",
        "customer.subscription.created",
        "customer.subscription.updated",
        "customer.subscription.deleted",
    }
    if event_type not in supported:
        return {"received": True, "ignored": True}
    validate_event_object(obj)
    if not settings.supabase_service_role_key or not settings.supabase_url:
        raise HTTPException(
            503, "Configure Supabase webhook storage before accepting billing events."
        )
    # Refresh subscription state instead of trusting an out-of-order event snapshot.
    if event_type.startswith("customer.subscription."):
        obj = await upstream(
            "GET",
            f"https://api.stripe.com/v1/subscriptions/{obj['id']}",
            headers={"Authorization": f"Bearer {settings.stripe_secret_key}"},
        )
        validate_event_object(obj, status_code=502)
        kind, status = "subscription", obj.get("status", "unknown")
    elif obj.get("mode") == "subscription":
        # Subscription events carry the authoritative subscription state.
        return {"received": True, "ignored": True}
    else:
        kind = "order"
        status = "failed" if event_type.endswith("failed") else obj.get("payment_status", "unpaid")
    metadata = obj.get("metadata") or {}
    try:
        if not isinstance(metadata.get("user_id"), str):
            raise ValueError("Invalid owner")
        owner_id = str(UUID(metadata["user_id"]))
    except (KeyError, ValueError, TypeError) as exc:
        raise HTTPException(400, "Billing event has no valid application owner.") from exc
    applied = await upstream(
        "POST",
        f"{settings.supabase_url.rstrip('/')}/rest/v1/rpc/apply_billing_event",
        headers={
            "apikey": settings.supabase_service_role_key,
            "Authorization": f"Bearer {settings.supabase_service_role_key}",
        },
        json={
            "p_event_id": event_id,
            "p_event_type": event_type,
            "p_created": created,
            "p_owner_id": owner_id,
            "p_kind": kind,
            "p_object_id": obj["id"],
            "p_customer_id": obj.get("customer"),
            "p_status": status,
            "p_price_id": metadata.get("price_id"),
        },
    )
    return {"received": True, "applied": applied}


@router.post("/portal")
async def customer_portal(request: Request, user: CurrentUser):
    settings = billing_settings()
    configured(settings)
    origin = settings.app_public_url.rstrip("/")
    parsed = urlsplit(origin)
    if (
        parsed.scheme != "https"
        or not parsed.hostname
        or parsed.username is not None
        or parsed.password is not None
        or parsed.query
        or parsed.fragment
        or parsed.path not in {"", "/"}
    ):
        raise HTTPException(503, "Configure APP_PUBLIC_URL with your deployed HTTPS frontend URL.")
    status = await billing_status(request, user)
    customers = [
        row.get("customer_id") for row in status["subscriptions"] if row.get("customer_id")
    ]
    if not customers:
        raise HTTPException(404, "No subscription customer found for this account.")
    result = await upstream(
        "POST",
        "https://api.stripe.com/v1/billing_portal/sessions",
        headers={"Authorization": f"Bearer {settings.stripe_secret_key}"},
        data={"customer": customers[0], "return_url": origin + "/"},
    )
    if not isinstance(result, dict) or not result.get("url"):
        raise HTTPException(502, "Stripe returned an incomplete portal session.")
    return {"url": result["url"]}
