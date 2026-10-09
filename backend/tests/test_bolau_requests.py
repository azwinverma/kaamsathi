"""Bolau Kaam requests & offers (docs/CONTRACT-BOLAU.md §5)."""

import datetime as dt

import pytest
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.bolau import kaam
from apps.bolau.models import Booking, KaamRequest, Offer
from apps.notifications.models import Notification
from tests.bolau_helpers import flag_on, make_ghardhani, make_sipalu, tomorrow_at

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _bolau_on(db):
    flag_on()


def post_request(gc, addr, **extra):
    body = {
        "trade": "plumber",
        "title": "Leaking kitchen tap",
        "description": "Water drips all night",
        "address_id": str(addr.id),
        "preferred_window_start": tomorrow_at(9).isoformat(),
        "preferred_window_end": tomorrow_at(18).isoformat(),
        "budget_max": "1500",
        **extra,
    }
    return gc.post("/api/v1/bolau/requests", body, format="json")


def offer(sc, rid, hour=10, price="800"):
    return sc.post(
        f"/api/v1/me/bolau/requests/{rid}/offers",
        {
            "price_type": "fixed",
            "price": price,
            "proposed_start": tomorrow_at(hour).isoformat(),
            "message": "Can come",
        },
        format="json",
    )


def test_request_notifies_matches_max_three_offers_and_accept(django_capture_on_commit_callbacks):
    sipalu = [make_sipalu(f"plumber-{i}", trade="plumber") for i in range(4)]
    far, _fs, far_c = make_sipalu("far-plumber", trade="plumber", district="jhapa")
    elec, _es, elec_c = make_sipalu("elec-only", trade="electrician")
    user, addr, gc = make_ghardhani()
    with django_capture_on_commit_callbacks(execute=True):
        r = post_request(gc, addr)
    assert r.status_code == 201, r.content
    rid = r.json()["id"]
    assert r.json()["code"].startswith("KR-") and r.json()["status"] == "open"
    notified = set(Notification.objects.filter(kind="bolau_request_new").values_list("user_id", flat=True))
    assert notified == {p.worker.user_id for p, _s, _c in sipalu}
    assert KaamRequest.objects.get(pk=rid).notified_count == 4

    # nearby: in-area plumbers see it without the exact address; others don't
    _p0, _s0, c0 = sipalu[0]
    rows = c0.get("/api/v1/me/bolau/requests/nearby").json()["results"]
    assert [x["id"] for x in rows] == [rid]
    assert set(rows[0]["address"]) == {"ward", "municipality", "district"}
    assert "Bhatbhateni" not in str(rows[0])
    assert far_c.get("/api/v1/me/bolau/requests/nearby").json()["count"] == 0
    assert elec_c.get("/api/v1/me/bolau/requests/nearby").json()["count"] == 0
    assert far_c.get(f"/api/v1/me/bolau/requests/{rid}").status_code == 404
    assert offer(elec_c, rid).status_code == 404

    # three offers, the fourth gets request_full
    for i, (_p, _s, c) in enumerate(sipalu[:3]):
        res = offer(c, rid, hour=10 + i, price=str(700 + i * 50))
        assert res.status_code == 201, res.content
    assert offer(sipalu[0][2], rid, hour=15).json()["error"]["code"] == "duplicate"
    res = offer(sipalu[3][2], rid, hour=16)
    assert res.status_code == 400 and res.json()["error"]["code"] == "request_full"
    detail = gc.get(f"/api/v1/bolau/requests/{rid}").json()
    assert detail["status"] == "offers_received" and len(detail["offers"]) == 3 and detail["offers_left"] == 0
    assert detail["address"]["line"]  # the Ghardhani sees their own address

    # accept the second offer → accepted booking, others rejected, request booked
    chosen = detail["offers"][1]["id"]
    res = gc.post(f"/api/v1/bolau/requests/{rid}/offers/{chosen}/accept", {}, format="json")
    assert res.status_code == 201, res.content
    b = Booking.objects.get(pk=res.json()["id"])
    assert b.status == "accepted" and b.source == "request" and b.offer_id is not None
    assert b.sipalu == sipalu[1][0].worker and str(b.quoted_price) == "750.00"
    statuses = dict(Offer.objects.filter(request_id=rid).values_list("id", "status"))
    assert sorted(statuses.values()) == ["accepted", "rejected", "rejected"]
    assert KaamRequest.objects.get(pk=rid).status == "booked"
    assert Notification.objects.filter(kind="bolau_offer_rejected").count() == 2
    # accepting again fails
    other = detail["offers"][0]["id"]
    assert (
        gc.post(f"/api/v1/bolau/requests/{rid}/offers/{other}/accept", {}, format="json").status_code == 400
    )


def test_db_caps_offers_at_three():
    profiles_ = [make_sipalu(f"cap-{i}", trade="plumber")[0] for i in range(4)]
    user, addr, gc = make_ghardhani()
    rid = post_request(gc, addr).json()["id"]
    for i, p in enumerate(profiles_[:3]):
        Offer.objects.create(
            request_id=rid,
            sipalu=p.worker,
            slot=i + 1,
            price_type="fixed",
            price=500,
            proposed_start=tomorrow_at(10),
        )
    with pytest.raises(IntegrityError), transaction.atomic():
        Offer.objects.create(
            request_id=rid,
            sipalu=profiles_[3].worker,
            slot=4,
            price_type="fixed",
            price=500,
            proposed_start=tomorrow_at(10),
        )
    with pytest.raises(IntegrityError), transaction.atomic():
        Offer.objects.create(
            request_id=rid,
            sipalu=profiles_[3].worker,
            slot=3,
            price_type="fixed",
            price=500,
            proposed_start=tomorrow_at(10),
        )


def test_offer_rules_min_wage_window_and_withdraw():
    p, _s, sc = make_sipalu("rules-plumber", trade="plumber")
    user, addr, gc = make_ghardhani()
    rid = post_request(gc, addr).json()["id"]
    r = sc.post(
        f"/api/v1/me/bolau/requests/{rid}/offers",
        {"price_type": "hourly", "price": "90", "proposed_start": tomorrow_at(10).isoformat()},
        format="json",
    )
    assert r.status_code == 400 and r.json()["error"]["code"] == "below_minimum_wage"
    assert offer(sc, rid, hour=20).status_code == 400  # outside window (ends 18:00)
    oid = offer(sc, rid).json()["id"]
    assert (
        sc.post(f"/api/v1/me/bolau/offers/{oid}/withdraw", {}, format="json").json()["status"] == "withdrawn"
    )
    assert sc.get("/api/v1/me/bolau/offers").json()["count"] == 1


def test_request_cancel_expire_and_scoping():
    p, _s, sc = make_sipalu("exp-plumber", trade="plumber")
    user, addr, gc = make_ghardhani()
    _u2, _a2, other = make_ghardhani()
    rid = post_request(gc, addr).json()["id"]
    assert other.get(f"/api/v1/bolau/requests/{rid}").status_code == 404
    assert other.post(f"/api/v1/bolau/requests/{rid}/cancel", {}, format="json").status_code == 404
    offer(sc, rid)
    KaamRequest.objects.filter(pk=rid).update(expires_at=timezone.now() - dt.timedelta(minutes=1))
    assert kaam.expire_due() == 1
    assert KaamRequest.objects.get(pk=rid).status == "expired"
    assert Offer.objects.get(request_id=rid).status == "expired"
    rid2 = post_request(gc, addr).json()["id"]
    assert gc.post(f"/api/v1/bolau/requests/{rid2}/cancel", {}, format="json").json()["status"] == "cancelled"
    assert gc.get("/api/v1/me/bolau/requests").json()["count"] == 2


def test_request_validation():
    user, addr, gc = make_ghardhani()
    _u, other_addr, _c = make_ghardhani()
    assert post_request(gc, other_addr).status_code == 400  # not my address
    r = post_request(gc, addr, preferred_window_end=tomorrow_at(8).isoformat())
    assert r.status_code == 400
