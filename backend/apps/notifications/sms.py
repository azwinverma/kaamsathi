"""SMS gateway adapters: console | sparrow | aakash (selected by settings.SMS_BACKEND).

``dispatch`` sends one message with automatic failover: when the primary gateway errors or times
out, the same message goes through ``settings.SMS_FAILOVER_BACKEND`` (empty = off) in the same
attempt. A cache-backed circuit breaker sends new messages straight to the failover for
``SMS_CIRCUIT_SECONDS`` after ``SMS_CIRCUIT_THRESHOLD`` consecutive primary failures.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import requests
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger("kaamsathi.sms")


@dataclass
class SMSResult:
    ok: bool
    response: str = ""


class BaseSMSBackend:
    name = "base"
    timeout = 10

    def send(self, phone: str, body: str) -> SMSResult:  # pragma: no cover - interface
        raise NotImplementedError


class ConsoleSMSBackend(BaseSMSBackend):
    name = "console"
    outbox: list = []  # handy for tests

    def send(self, phone, body):
        ConsoleSMSBackend.outbox.append((phone, body))
        logger.info("SMS to %s: %s", phone, body)
        return SMSResult(True, "console")


class SparrowSMSBackend(BaseSMSBackend):
    """Sparrow SMS v2 — https://docs.sparrowsms.com (POST token/from/to/text)."""

    name = "sparrow"

    def send(self, phone, body):
        if not settings.SPARROW_SMS_TOKEN:
            return SMSResult(False, "SPARROW_SMS_TOKEN not configured")
        try:
            resp = requests.post(
                settings.SPARROW_SMS_URL,
                data={
                    "token": settings.SPARROW_SMS_TOKEN,
                    "from": settings.SPARROW_SMS_FROM,
                    "to": phone,
                    "text": body,
                },
                timeout=self.timeout,
            )
        except requests.RequestException as exc:
            return SMSResult(False, f"error: {exc}")
        return SMSResult(resp.status_code == 200, f"{resp.status_code} {resp.text[:500]}")


class AakashSMSBackend(BaseSMSBackend):
    """Aakash SMS v3 — POST auth_token/to/text to /sms/v3/send."""

    name = "aakash"

    def send(self, phone, body):
        if not settings.AAKASH_SMS_TOKEN:
            return SMSResult(False, "AAKASH_SMS_TOKEN not configured")
        try:
            resp = requests.post(
                settings.AAKASH_SMS_URL,
                data={"auth_token": settings.AAKASH_SMS_TOKEN, "to": phone, "text": body},
                timeout=self.timeout,
            )
        except requests.RequestException as exc:
            return SMSResult(False, f"error: {exc}")
        ok = resp.status_code == 200
        try:
            ok = ok and not resp.json().get("error", False)
        except ValueError:
            pass
        return SMSResult(ok, f"{resp.status_code} {resp.text[:500]}")


BACKENDS = {
    "console": ConsoleSMSBackend,
    "sparrow": SparrowSMSBackend,
    "aakash": AakashSMSBackend,
}


def get_backend() -> BaseSMSBackend:
    cls = BACKENDS.get(settings.SMS_BACKEND, ConsoleSMSBackend)
    return cls()


def get_failover_backend() -> BaseSMSBackend | None:
    """The configured failover gateway, or None when off, unknown or the same as the primary."""
    name = (getattr(settings, "SMS_FAILOVER_BACKEND", "") or "").strip().lower()
    if not name or name == settings.SMS_BACKEND or name not in BACKENDS:
        return None
    return BACKENDS[name]()


def _fail_key(name: str) -> str:
    return f"sms:failures:{name}"


def _circuit_key(name: str) -> str:
    return f"sms:circuit:{name}"


def circuit_open(name: str | None = None) -> bool:
    try:
        return bool(cache.get(_circuit_key(name or settings.SMS_BACKEND)))
    except Exception:  # noqa: BLE001 - cache down: behave as closed
        return False


def _record_primary(name: str, ok: bool) -> None:
    try:
        if ok:
            cache.delete(_fail_key(name))
            return
        seconds = int(getattr(settings, "SMS_CIRCUIT_SECONDS", 300))
        key = _fail_key(name)
        cache.add(key, 0, seconds)
        failures = cache.incr(key)
        if failures >= int(getattr(settings, "SMS_CIRCUIT_THRESHOLD", 3)):
            if not cache.get(_circuit_key(name)):
                logger.warning("SMS circuit open: %s failed %s times in a row", name, failures)
            cache.set(_circuit_key(name), True, seconds)
    except Exception:  # noqa: BLE001 - the breaker must never block a send
        logger.exception("SMS circuit breaker update failed")


@dataclass
class Dispatch:
    ok: bool
    backend: str  # the gateway that delivered (or the last one tried)
    failed_over: bool
    response: str


def _try(backend: BaseSMSBackend, phone: str, body: str) -> SMSResult:
    try:
        return backend.send(phone, body)
    except Exception as exc:  # noqa: BLE001 - timeouts and client bugs count as a failed gateway
        return SMSResult(False, f"error: {exc}"[:500])


def dispatch(phone: str, body: str) -> Dispatch:
    """Send through the primary gateway, failing over once when it errors (see module doc)."""
    primary = get_backend()
    failover = get_failover_backend()
    order = [primary] if failover is None else [primary, failover]
    if failover is not None and circuit_open(primary.name):
        order = [failover, primary]  # primary is known-broken: try it only if the failover fails
    responses = []
    result, used = SMSResult(False, ""), primary
    for backend in order:
        used = backend
        result = _try(backend, phone, body)
        responses.append((backend.name, result.response))
        if backend is primary and failover is not None:
            _record_primary(primary.name, result.ok)
        if result.ok:
            break
        logger.warning("SMS via %s failed for %s: %s", backend.name, phone[-4:], result.response)
    if len(responses) == 1:  # one gateway tried: its response as-is
        response = responses[0][1]
    else:
        response = " | ".join(f"{name}: {text}" for name, text in responses)
    return Dispatch(result.ok, used.name, used is not primary, response[:2000])


def send_logged(phone: str, body: str, *, kind: str, log_body: str | None = None, message_id=None):
    """``dispatch`` + the SMSMessage log. A retry passes ``message_id`` and updates that row."""
    from .models import SMSMessage

    msg = SMSMessage.objects.filter(pk=message_id).first() if message_id else None
    if msg is None:
        msg = SMSMessage.objects.create(
            phone=phone,
            body=log_body if log_body is not None else body,
            kind=kind,
            backend=settings.SMS_BACKEND,
        )
    sent = dispatch(phone, body)
    msg.attempts += 1
    msg.status = "sent" if sent.ok else "failed"
    msg.backend, msg.failed_over, msg.provider_response = sent.backend, sent.failed_over, sent.response
    msg.save(
        update_fields=["attempts", "status", "backend", "failed_over", "provider_response", "updated_at"]
    )
    return msg, sent
