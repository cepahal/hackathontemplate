"""User-bound OAuth state and PKCE helpers for future delegated provider connections.

These helpers do not store tokens or implement a callback by themselves.
The Spotify adapter implements the server-to-server OAuth client-credentials flow.
"""

import base64
import hashlib
import hmac
import json
import secrets
import time


def b64(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode()


def pkce_pair() -> tuple[str, str]:
    verifier = secrets.token_urlsafe(48)
    return verifier, b64(hashlib.sha256(verifier.encode()).digest())


def issue_state(user_id: str, provider: str, secret: str) -> str:
    if len(secret) < 32:
        raise ValueError("OAuth state secret must be at least 32 characters")
    payload = b64(
        json.dumps(
            {
                "user_id": user_id,
                "provider": provider,
                "exp": int(time.time()) + 600,
                "nonce": secrets.token_urlsafe(24),
            },
            separators=(",", ":"),
        ).encode()
    )
    signature = b64(hmac.new(secret.encode(), payload.encode(), hashlib.sha256).digest())
    return payload + "." + signature


def verify_state(state: str, user_id: str, provider: str, secret: str) -> dict:
    if len(secret) < 32 or len(state) > 4096:
        raise ValueError("Invalid OAuth state")
    try:
        payload, signature = state.split(".")
        expected = b64(hmac.new(secret.encode(), payload.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(expected, signature):
            raise ValueError("Invalid OAuth state")
        data = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
        if data["user_id"] != user_id or data["provider"] != provider or data["exp"] <= time.time():
            raise ValueError("Invalid OAuth state")
        return data
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError("Invalid OAuth state") from exc
