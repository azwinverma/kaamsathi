from django.test import RequestFactory

from apps.audit.services import client_ip
from apps.core.proxy_ip import TrustedProxyClientIPMiddleware


def req(xff=None, remote="10.0.0.2"):
    meta = {"REMOTE_ADDR": remote}
    if xff:
        meta["HTTP_X_FORWARDED_FOR"] = xff
    return RequestFactory().get("/", **meta)


def test_ignores_forwarded_header_without_trusted_proxies(settings):
    settings.REST_FRAMEWORK = {**settings.REST_FRAMEWORK, "NUM_PROXIES": None}
    assert client_ip(req("6.6.6.6")) == "10.0.0.2"


def test_forged_leftmost_entry_is_ignored_behind_one_proxy(settings):
    settings.REST_FRAMEWORK = {**settings.REST_FRAMEWORK, "NUM_PROXIES": 1}
    # Client sent "X-Forwarded-For: 6.6.6.6"; Caddy appended the real address.
    assert client_ip(req("6.6.6.6, 203.0.113.7")) == "203.0.113.7"


# --- relayed client IP from the web BFF (apps/core/proxy_ip.py) ---------------------------------
SECRET = "s" * 40


def relay(secret=SECRET, ip="198.51.100.9", xff="203.0.113.50", remote="10.0.0.2"):
    meta = {"REMOTE_ADDR": remote, "HTTP_X_FORWARDED_FOR": xff}
    if secret is not None:
        meta["HTTP_X_KAAMSATHI_PROXY_SECRET"] = secret
    if ip is not None:
        meta["HTTP_X_KAAMSATHI_CLIENT_IP"] = ip
    request = RequestFactory().get("/", **meta)
    TrustedProxyClientIPMiddleware(lambda r: r)(request)
    return request


def test_bff_relayed_ip_is_used_with_matching_secret(settings):
    settings.BFF_PROXY_SECRET = SECRET
    for proxies in (None, 1, 2):
        settings.REST_FRAMEWORK = {**settings.REST_FRAMEWORK, "NUM_PROXIES": proxies}
        request = relay()
        assert client_ip(request) == "198.51.100.9"
        assert "HTTP_X_KAAMSATHI_PROXY_SECRET" not in request.META
        assert "HTTP_X_KAAMSATHI_CLIENT_IP" not in request.META


def test_bff_relay_ignored_with_wrong_or_missing_secret(settings):
    settings.REST_FRAMEWORK = {**settings.REST_FRAMEWORK, "NUM_PROXIES": 1}
    settings.BFF_PROXY_SECRET = SECRET
    assert client_ip(relay(secret="nope")) == "203.0.113.50"
    assert client_ip(relay(secret=None)) == "203.0.113.50"
    settings.BFF_PROXY_SECRET = ""  # feature off: even an empty presented secret must not match
    assert client_ip(relay(secret="")) == "203.0.113.50"
    request = relay()
    assert client_ip(request) == "203.0.113.50"
    assert "HTTP_X_KAAMSATHI_PROXY_SECRET" not in request.META


def test_bff_relay_rejects_invalid_ip(settings):
    settings.REST_FRAMEWORK = {**settings.REST_FRAMEWORK, "NUM_PROXIES": 1}
    settings.BFF_PROXY_SECRET = SECRET
    assert client_ip(relay(ip="not-an-ip")) == "203.0.113.50"
    assert client_ip(relay(ip="2001:db8::1")) == "2001:db8::1"
