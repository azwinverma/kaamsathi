"""Firebase Cloud Messaging (HTTP v1) adapter.

Disabled unless both ``FCM_PROJECT_ID`` and ``FCM_SERVICE_ACCOUNT_JSON`` are set. The service account
JSON may be given inline or as a path to the file. OAuth access tokens are minted with a self-signed
RS256 JWT (``cryptography``; no Google SDK) and cached for ~55 minutes.
"""

from __future__ import annotations

import base64
import json
import logging
import time
from functools import lru_cache
from pathlib import Path

import requests
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger("kaamsathi.push")

SCOPE = "https://www.googleapis.com/auth/firebase.messaging"
DEFAULT_TOKEN_URI = "https://oauth2.googleapis.com/token"
SEND_URL = "https://fcm.googleapis.com/v1/projects/{project}/messages:send"
CACHE_KEY = "fcm:access-token"
TIMEOUT = 10


class PushError(Exception):
    pass


def enabled() -> bool:
    return bool(getattr(settings, "FCM_PROJECT_ID", "") and getattr(settings, "FCM_SERVICE_ACCOUNT_JSON", ""))


@lru_cache(maxsize=4)
def _load_account(raw: str) -> dict:
    text = raw.strip()
    if not text.startswith("{"):
        text = Path(text).read_text()
    data = json.loads(text)
    for key in ("client_email", "private_key"):
        if not data.get(key):
            raise PushError(f"FCM service account JSON lacks '{key}'.")
    return data


def service_account() -> dict:
    return _load_account(settings.FCM_SERVICE_ACCOUNT_JSON)


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def build_jwt(account: dict, now: int | None = None) -> str:
    """Self-signed OAuth assertion (RFC 7523) signed RS256 with the service account key."""
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding

    now = int(now if now is not None else time.time())
    header = {"alg": "RS256", "typ": "JWT"}
    if account.get("private_key_id"):
        header["kid"] = account["private_key_id"]
    claims = {
        "iss": account["client_email"],
        "scope": SCOPE,
        "aud": account.get("token_uri") or DEFAULT_TOKEN_URI,
        "iat": now,
        "exp": now + 3600,
    }
    signing_input = (
        _b64(json.dumps(header, separators=(",", ":")).encode())
        + "."
        + _b64(json.dumps(claims, separators=(",", ":")).encode())
    )
    key = serialization.load_pem_private_key(account["private_key"].encode(), password=None)
    signature = key.sign(signing_input.encode(), padding.PKCS1v15(), hashes.SHA256())
    return signing_input + "." + _b64(signature)


def access_token() -> str:
    token = cache.get(CACHE_KEY)
    if token:
        return token
    account = service_account()
    resp = requests.post(
        account.get("token_uri") or DEFAULT_TOKEN_URI,
        data={"grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer", "assertion": build_jwt(account)},
        timeout=TIMEOUT,
    )
    if resp.status_code != 200:
        raise PushError(f"FCM token exchange failed: {resp.status_code} {resp.text[:200]}")
    body = resp.json()
    token = body["access_token"]
    cache.set(CACHE_KEY, token, max(int(body.get("expires_in", 3600)) - 300, 60))
    return token


def build_message(
    token: str, title: str, body: str, data: dict | None = None, link: str | None = None
) -> dict:
    """FCM v1 ``message`` payload. ``data`` values must be strings."""
    payload = {str(k): v if isinstance(v, str) else json.dumps(v) for k, v in (data or {}).items()}
    if link:
        payload["link"] = link
    message = {
        "token": token,
        "notification": {"title": title[:200], "body": body[:1000]},
        "data": payload,
        "android": {"priority": "high", "notification": {"channel_id": "kaamsathi_default"}},
        "apns": {"payload": {"aps": {"sound": "default"}}},
    }
    if link and link.startswith("https://"):
        message["webpush"] = {"fcm_options": {"link": link}}
    return {"message": message}


def send(token: str, title: str, body: str, data: dict | None = None, link: str | None = None) -> str:
    """Send one push. Returns ``"sent"``, ``"unregistered"`` (token should be dropped) or ``"failed"``.

    ``"disabled"`` when FCM is not configured. Never raises on HTTP errors.
    """
    if not enabled():
        return "disabled"
    try:
        resp = requests.post(
            SEND_URL.format(project=settings.FCM_PROJECT_ID),
            json=build_message(token, title, body, data, link),
            headers={"Authorization": f"Bearer {access_token()}"},
            timeout=TIMEOUT,
        )
    except (requests.RequestException, PushError, ValueError, KeyError) as exc:
        logger.warning("FCM send failed: %s", exc)
        return "failed"
    if resp.status_code == 200:
        return "sent"
    if resp.status_code == 404 or (resp.status_code == 400 and "UNREGISTERED" in resp.text):
        return "unregistered"
    if resp.status_code == 401:
        cache.delete(CACHE_KEY)
    logger.warning("FCM send %s: %s", resp.status_code, resp.text[:300])
    return "failed"
