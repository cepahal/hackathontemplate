"""Verify signed events before parsing or processing them."""

import hashlib
import hmac
import time


def verify_stripe_signature(
    body: bytes, signature: str, secret: str, *, now: float | None = None, tolerance: int = 300
) -> None:
    parts: dict[str, list[str]] = {}
    for part in signature.split(","):
        key, _, value = part.partition("=")
        parts.setdefault(key.strip(), []).append(value.strip())
    try:
        timestamp = int(parts["t"][0])
    except (KeyError, ValueError, IndexError) as exc:
        raise ValueError("Invalid webhook signature") from exc
    if abs((time.time() if now is None else now) - timestamp) > tolerance:
        raise ValueError("Expired webhook signature")
    expected = hmac.new(
        secret.encode(), str(timestamp).encode() + b"." + body, hashlib.sha256
    ).hexdigest()
    if not any(hmac.compare_digest(expected, candidate) for candidate in parts.get("v1", [])):
        raise ValueError("Invalid webhook signature")


def verify_github_signature(body: bytes, signature: str, secret: str) -> None:
    expected = "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise ValueError("Invalid webhook signature")
