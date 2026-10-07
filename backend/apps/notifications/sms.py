"""SMS gateway adapters: console | sparrow | aakash (selected by settings.SMS_BACKEND)."""

from __future__ import annotations

import logging
from dataclasses import dataclass

import requests
from django.conf import settings

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
