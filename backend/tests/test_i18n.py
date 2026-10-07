"""Accept-Language: ne localises error messages and *_label fields (CONTRACT §1)."""

import pytest

from tests import factories as f

pytestmark = pytest.mark.django_db


def test_error_message_in_nepali(api):
    res = api.get("/api/v1/auth/me", HTTP_ACCEPT_LANGUAGE="ne")
    assert res.status_code == 401
    assert res.json()["error"]["message"] == "अगाडि बढ्न लगइन गर्नुहोस्।"


def test_error_message_defaults_to_english(api):
    res = api.get("/api/v1/auth/me")
    assert res.json()["error"]["message"] == "Please log in to continue."


def test_minimum_wage_field_error_in_nepali(owner_client):
    res = owner_client.post(
        "/api/v1/org/jobs",
        {
            "title": "Cook",
            "trade": "cook",
            "openings_count": 1,
            "wage_type": "monthly",
            "wage_amount": "15000",
        },
        format="json",
        HTTP_ACCEPT_LANGUAGE="ne",
    )
    assert res.status_code == 400
    err = res.json()["error"]
    assert err["code"] == "below_minimum_wage"
    assert "न्यूनतम पारिश्रमिक" in err["fields"]["wage_amount"][0]


def test_labels_in_nepali(owner_client, org):
    f.JobFactory(organization=org, status="open")
    res = owner_client.get("/api/v1/org/jobs", HTTP_ACCEPT_LANGUAGE="ne")
    assert res.json()["results"][0]["status_label"] == "खुला"
