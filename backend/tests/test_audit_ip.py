from django.test import RequestFactory

from apps.audit.services import client_ip


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
