"""Client IP for requests relayed by the web BFF (Next.js route handlers).

Browser traffic reaches Django from the web server, not from the user, so without help every web
login would share the web host's address (Vercel egress / the web container) for OTP throttling
and the audit log. The BFF therefore sends the end user's IP in ``X-KaamSathi-Client-IP`` together
with ``X-KaamSathi-Proxy-Secret`` (``BFF_PROXY_SECRET``, same value on web and API).

Only when the secret matches do we rewrite the request to look like it came straight from that IP:
``REMOTE_ADDR`` and a single-entry ``X-Forwarded-For`` — so DRF throttling and
``apps.audit.services.client_ip`` agree for any ``NUM_PROXIES``. Without a matching secret the
headers are ignored, so direct callers (the mobile app) cannot spoof their address this way.
Both headers are always stripped before the view runs.
"""

from __future__ import annotations

import hmac
import ipaddress

from django.conf import settings

SECRET_META = "HTTP_X_KAAMSATHI_PROXY_SECRET"
IP_META = "HTTP_X_KAAMSATHI_CLIENT_IP"


def _valid_ip(value: str) -> str | None:
    try:
        return str(ipaddress.ip_address(value.strip()))
    except ValueError:
        return None


class TrustedProxyClientIPMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        meta = request.META
        presented = meta.pop(SECRET_META, "")
        relayed = meta.pop(IP_META, "")
        secret = getattr(settings, "BFF_PROXY_SECRET", "")
        if secret and presented and relayed and hmac.compare_digest(presented.encode(), secret.encode()):
            ip = _valid_ip(relayed)
            if ip:
                meta["REMOTE_ADDR"] = ip
                meta["HTTP_X_FORWARDED_FOR"] = ip
        return self.get_response(request)
