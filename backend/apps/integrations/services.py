"""Enterprise API keys and signed outbound webhooks (docs/CONTRACT-EXTENSIONS.md §4).

``emit(organization, event, payload)`` is the shared entry point other apps call: it queues one
``WebhookDelivery`` per active endpoint subscribed to the event and attempts it after commit.
Failed attempts are retried by ``tasks.retry_deliveries`` after 1 m, 5 m, 30 m, 2 h and 12 h; after
that the delivery is ``failed``. Each request carries
``X-KaamSathi-Timestamp`` and ``X-KaamSathi-Signature: sha256=<hmac(secret, timestamp + "." + body)>``.
"""

from __future__ import annotations

import datetime as dt
import hashlib
import hmac
import ipaddress
import json
import logging
import time
from urllib.parse import urlparse

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from django.utils.translation import pgettext

from .models import EVENT_CODES, SCOPE_CODES, OrgAPIKey, WebhookDelivery, WebhookEndpoint

logger = logging.getLogger("kaamsathi.webhooks")

SIGNATURE_HEADER = "X-KaamSathi-Signature"
TIMESTAMP_HEADER = "X-KaamSathi-Timestamp"
EVENT_HEADER = "X-KaamSathi-Event"
DELIVERY_HEADER = "X-KaamSathi-Delivery"
# Delay before retry n (after the n-th failed attempt). Attempts = 1 + len(BACKOFF).
BACKOFF = (
    dt.timedelta(minutes=1),
    dt.timedelta(minutes=5),
    dt.timedelta(minutes=30),
    dt.timedelta(hours=2),
    dt.timedelta(hours=12),
)
MAX_ATTEMPTS = 1 + len(BACKOFF)


# --------------------------------------------------------------------------- API keys
def create_api_key(org, name: str, scopes, user=None) -> tuple[OrgAPIKey, str]:
    """Create a key; returns ``(key, full_key)`` — the full key is never stored or shown again."""
    from .auth import generate_key, hash_key

    full, prefix = generate_key()
    key = OrgAPIKey.objects.create(
        organization=org,
        name=name,
        prefix=prefix,
        key_hash=hash_key(full),
        scopes=[s for s in SCOPE_CODES if s in set(scopes)],
        created_by=user,
    )
    return key, full


def revoke_api_key(key: OrgAPIKey) -> OrgAPIKey:
    if key.revoked_at is None:
        key.revoked_at = timezone.now()
        key.save(update_fields=["revoked_at"])
    return key


# --------------------------------------------------------------------------- endpoints
def validate_webhook_url(url: str) -> str | None:
    """Return an error message, or None when the URL is acceptable.

    Production requires https and refuses literal private/loopback addresses and localhost.
    """
    parsed = urlparse(url or "")
    if parsed.scheme not in ("https", "http") or not parsed.hostname:
        return pgettext("enterprise", "Enter a valid URL.")
    if settings.DEBUG:
        return None
    if parsed.scheme != "https":
        return pgettext("enterprise", "Webhook URLs must use https.")
    host = parsed.hostname.lower()
    if host == "localhost" or host.endswith(".localhost") or host.endswith(".internal"):
        return pgettext("enterprise", "Webhook URLs must point to a public host.")
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        return None
    if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
        return pgettext("enterprise", "Webhook URLs must point to a public host.")
    return None


def sign_payload(secret: str, timestamp: str, body: bytes) -> str:
    mac = hmac.new(secret.encode(), timestamp.encode() + b"." + body, hashlib.sha256)
    return "sha256=" + mac.hexdigest()


def verify_signature(secret: str, timestamp: str, body: bytes, signature: str, tolerance: int = 300) -> bool:
    """Reference verifier (what receivers should do): constant-time compare + timestamp window."""
    try:
        if abs(time.time() - int(timestamp)) > tolerance:
            return False
    except (TypeError, ValueError):
        return False
    return hmac.compare_digest(sign_payload(secret, timestamp, body), signature or "")


def _envelope(delivery: WebhookDelivery) -> bytes:
    return json.dumps(
        {
            "id": str(delivery.id),
            "event": delivery.event,
            "created_at": timezone.localtime(delivery.created_at).isoformat(),
            "organization_id": str(delivery.endpoint.organization_id),
            "data": delivery.payload,
        },
        separators=(",", ":"),
        sort_keys=True,
        default=str,
    ).encode()


# --------------------------------------------------------------------------- emit + deliver
def _json_safe(payload: dict) -> dict:
    return json.loads(json.dumps(payload or {}, default=str))


def emit(organization, event: str, payload: dict) -> None:
    """Queue ``event`` for every active endpoint of the organization that subscribes to it."""
    if organization is None:
        return
    org_id = getattr(organization, "pk", organization)
    endpoints = [
        e for e in WebhookEndpoint.objects.filter(organization_id=org_id, is_active=True) if e.wants(event)
    ]
    if not endpoints:
        return
    data = _json_safe(payload)
    now = timezone.now()
    ids = [
        str(WebhookDelivery.objects.create(endpoint=e, event=event, payload=data, next_attempt_at=now).pk)
        for e in endpoints
    ]
    from apps.notifications.services import enqueue

    from .tasks import deliver_webhook

    for delivery_id in ids:
        enqueue(deliver_webhook, delivery_id)


def deliver(delivery: WebhookDelivery) -> WebhookDelivery:
    """One attempt. Updates status / attempts / next_attempt_at. Never raises on HTTP errors."""
    import requests

    if delivery.status != "pending":
        return delivery
    endpoint = delivery.endpoint
    body = _envelope(delivery)
    timestamp = str(int(time.time()))
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "KaamSathi-Webhooks/1.0",
        EVENT_HEADER: delivery.event,
        DELIVERY_HEADER: str(delivery.id),
        TIMESTAMP_HEADER: timestamp,
        SIGNATURE_HEADER: sign_payload(endpoint.secret, timestamp, body),
    }
    delivery.attempts += 1
    ok = False
    try:
        resp = requests.post(
            endpoint.url,
            data=body,
            headers=headers,
            timeout=getattr(settings, "WEBHOOK_TIMEOUT_SECONDS", 10),
            allow_redirects=False,
        )
        delivery.last_status_code = resp.status_code
        ok = 200 <= resp.status_code < 300
        delivery.last_error = None if ok else (resp.text or "")[:500] or f"HTTP {resp.status_code}"
    except requests.RequestException as exc:
        delivery.last_status_code = None
        delivery.last_error = str(exc)[:500]
    now = timezone.now()
    if ok:
        delivery.status = "delivered"
        delivery.delivered_at = now
        delivery.next_attempt_at = None
    elif delivery.attempts >= MAX_ATTEMPTS:
        delivery.status = "failed"
        delivery.next_attempt_at = None
    else:
        delivery.next_attempt_at = now + BACKOFF[delivery.attempts - 1]
    delivery.save(
        update_fields=[
            "status",
            "attempts",
            "next_attempt_at",
            "last_status_code",
            "last_error",
            "delivered_at",
        ]
    )
    if not ok:
        logger.info("webhook %s attempt %s failed: %s", delivery.pk, delivery.attempts, delivery.last_error)
    return delivery


def retry_due(now=None, limit: int = 200) -> int:
    """Attempt every pending delivery whose ``next_attempt_at`` has passed. Returns attempts made."""
    now = now or timezone.now()
    ids = list(
        WebhookDelivery.objects.filter(status="pending", next_attempt_at__lte=now)
        .order_by("next_attempt_at")
        .values_list("pk", flat=True)[:limit]
    )
    done = 0
    for pk in ids:
        with transaction.atomic():
            d = (
                WebhookDelivery.objects.select_for_update(skip_locked=True)
                .select_related("endpoint")
                .filter(pk=pk, status="pending")
                .first()
            )
            if d is None:
                continue
            deliver(d)
            done += 1
    return done


def send_test(endpoint: WebhookEndpoint) -> WebhookDelivery:
    d = WebhookDelivery.objects.create(
        endpoint=endpoint,
        event="ping",
        payload={"message": "Webhook test from KaamSathi", "endpoint_id": str(endpoint.id)},
        next_attempt_at=timezone.now(),
    )
    return deliver(d)


def redeliver(delivery: WebhookDelivery) -> WebhookDelivery:
    """Reset a delivery to pending with a fresh attempt budget and try once now."""
    delivery.status = "pending"
    delivery.attempts = 0
    delivery.next_attempt_at = timezone.now()
    delivery.delivered_at = None
    delivery.save(update_fields=["status", "attempts", "next_attempt_at", "delivered_at"])
    return deliver(delivery)


def events_list() -> list:
    return list(EVENT_CODES)
