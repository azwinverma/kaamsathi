"""Production-readiness guards: seed_demo, API docs, readiness, throttle scopes."""

import pytest
from django.conf import settings
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import override_settings

from tests import factories as f
from tests.conftest import auth_client

pytestmark = pytest.mark.django_db


@override_settings(DEBUG=False)
def test_seed_demo_refuses_without_debug():
    with pytest.raises(CommandError, match="refuses"):
        call_command("seed_demo")


@override_settings(DEBUG=False)
def test_seed_reference_still_allowed_in_production():
    call_command("seed_reference", verbosity=0)


def test_api_docs_staff_only_when_not_debug(api):
    with override_settings(DEBUG=False):
        assert api.get("/api/schema/").status_code in (401, 403)
        assert auth_client(f.UserFactory()).get("/api/schema/").status_code == 403
        assert auth_client(f.UserFactory(is_staff=True)).get("/api/schema/").status_code == 200
    with override_settings(DEBUG=True):
        assert api.get("/api/schema/").status_code == 200


def test_admin_requires_staff(client):
    user = f.UserFactory()
    client.force_login(user)
    res = client.get(f"/{settings.DJANGO_ADMIN_URL}")
    assert res.status_code == 302 and "login" in res["Location"]


def test_readiness_checks_db_and_cache(api):
    res = api.get("/api/v1/readiness")
    assert res.status_code == 200
    assert res.json() == {"status": "ok", "database": "ok", "cache": "ok"}
    assert api.get("/readiness").status_code == 200


def test_throttle_scopes_configured():
    from config.settings import base

    rates = base.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]
    assert rates["public"] == "60/minute"
    for scope in ("otp", "files", "privacy"):
        assert rates[scope]
