"""Bolau ops (role, suspension, KPIs, fee ledger), gateway webhook signature/replay, receipt, search
ranking, risk detectors and the trust reliability component."""

import datetime as dt
import hashlib
import hmac
import json
import time

import pytest
from django.core.cache import cache
from django.utils import timezone

from apps.accounts.models import StaffProfile
from apps.bolau.models import Booking, BookingRating, SipaluProfile
from apps.risk.models import FraudFlag
from tests import factories as f
from tests.bolau_helpers import book, flag_on, make_ghardhani, make_sipalu, tomorrow_at
from tests.conftest import auth_client

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _bolau_on(db):
    flag_on()
    cache.clear()


def accepted_booking(fee=False):
    if fee:
        flag_on("bolau_fee")
    profile, service, sc = make_sipalu()
    user, addr, gc = make_ghardhani()
    bid = book(gc, profile, addr, service).json()["id"]
    sc.post(f"/api/v1/me/bolau/bookings/{bid}/accept", {}, format="json")
    return Booking.objects.get(pk=bid), profile, sc, user, gc


def staff(roles):
    u = f.UserFactory(is_staff=True)
    StaffProfile.objects.create(user=u, roles=roles)
    return auth_client(u)


# --------------------------------------------------------------------------- ops
def test_ops_role_gate(settings):
    accepted_booking()
    settings.STAFF_NO_PROFILE_SUPERADMIN = False
    assert staff(["support"]).get("/api/v1/ops/bolau/bookings").status_code == 200
    assert staff(["verifier"]).get("/api/v1/ops/bolau/bookings").status_code == 403
    assert staff(["finance_ops"]).get("/api/v1/ops/bolau/kpis").status_code == 403
    assert auth_client(f.UserFactory()).get("/api/v1/ops/bolau/bookings").status_code == 403


def test_ops_suspend_audited_and_blocks_booking(staff_client):
    b, profile, sc, user, gc = accepted_booking()
    r = staff_client.post(
        f"/api/v1/ops/bolau/sipalu/{profile.handle}/suspend", {"reason": "3 no-shows"}, format="json"
    )
    assert r.status_code == 200 and r.json()["suspended_at"]
    profile.refresh_from_db()
    assert profile.bolau_enabled is False
    from apps.audit.models import AuditLog

    assert AuditLog.objects.filter(action="bolau.ops.sipalu.suspend").exists()
    _u, addr2, gc2 = make_ghardhani()
    assert book(gc2, profile, addr2, profile.services.first(), tomorrow_at(15)).status_code == 400
    assert sc.patch("/api/v1/me/sipalu", {"bolau_enabled": True}, format="json").status_code == 400
    assert (
        staff_client.post(
            f"/api/v1/ops/bolau/sipalu/{profile.handle}/unsuspend", {}, format="json"
        ).status_code
        == 200
    )
    assert sc.patch("/api/v1/me/sipalu", {"bolau_enabled": True}, format="json").status_code == 200


def test_ops_lists_kpis_fees(staff_client):
    b, profile, sc, user, gc = accepted_booking()
    res = staff_client.get("/api/v1/ops/bolau/bookings?q=" + b.code)
    assert res.json()["count"] == 1 and res.json()["results"][0]["ghardhani"]["phone"] == user.phone
    detail = staff_client.get(f"/api/v1/ops/bolau/bookings/{b.id}").json()
    assert detail["events"] and detail["address"]["line"]
    k = staff_client.get("/api/v1/ops/bolau/kpis?days=30").json()
    assert k["bookings"] == 1 and k["acceptance_rate"] == 100.0 and k["fees"]["waived"]["count"] == 1
    fees = staff_client.get("/api/v1/ops/bolau/fees").json()
    assert (
        fees["count"] == 1
        and fees["results"][0]["status"] == "waived"
        and fees["totals"]["waived"]["amount"] == "49.00"
    )
    assert staff_client.get("/api/v1/ops/bolau/sipalu?q=ram").json()["count"] == 1
    assert staff_client.get("/api/v1/ops/bolau/requests").status_code == 200
    r = staff_client.post(
        f"/api/v1/ops/bolau/bookings/{b.id}/cancel", {"reason": "Safety concern"}, format="json"
    )
    assert r.json()["status"] == "cancelled" and r.json()["cancelled_by"] == "ops"


# --------------------------------------------------------------------------- gateway + webhook
def signed(secret, body: bytes, ts=None):
    ts = str(int(ts if ts is not None else time.time()))
    sig = hmac.new(secret.encode(), ts.encode() + b"." + body, hashlib.sha256).hexdigest()
    return {"HTTP_X_TIMESTAMP": ts, "HTTP_X_SIGNATURE": f"sha256={sig}"}


def test_gateway_stub_not_configured():
    b, profile, sc, user, gc = accepted_booking(fee=True)
    assert b.booking_fee_status == "pending"
    r = gc.post(f"/api/v1/bolau/bookings/{b.id}/fee/pay", {"provider": "esewa"}, format="json")
    assert r.status_code == 400 and r.json()["error"]["code"] == "provider_not_configured"
    assert (
        sc.post(f"/api/v1/bolau/bookings/{b.id}/fee/pay", {"provider": "esewa"}, format="json").status_code
        == 404
    )


def test_webhook_signature_replay_and_receipt(api, settings):
    settings.BOLAU_WEBHOOK_SECRETS = {"khalti": "s3cret"}
    b, profile, sc, user, gc = accepted_booking(fee=True)
    body = json.dumps(
        {"reference": b.code, "status": "paid", "transaction_id": "KH-123", "amount": "49.00"}
    ).encode()
    url = "/api/v1/webhooks/bolau/khalti"
    # unsigned / wrong secret / stale timestamp
    assert api.post(url, body, content_type="application/json").status_code == 403
    assert api.post(url, body, content_type="application/json", **signed("wrong", body)).status_code == 403
    old = signed("s3cret", body, ts=time.time() - 3600)
    assert api.post(url, body, content_type="application/json", **old).status_code == 403
    # esewa has no secret configured
    assert (
        api.post(
            "/api/v1/webhooks/bolau/esewa", body, content_type="application/json", **signed("s3cret", body)
        ).status_code
        == 400
    )
    headers = signed("s3cret", body)
    res = api.post(url, body, content_type="application/json", **headers)
    assert res.status_code == 200 and res.json()["applied"] is True
    b.refresh_from_db()
    assert b.booking_fee_status == "paid" and b.fee_charge.status == "paid" and b.fee_reference == "KH-123"
    assert api.post(url, body, content_type="application/json", **headers).status_code == 409  # replay
    # receipt (Ghardhani only, bilingual PDF)
    r = gc.get(f"/api/v1/bolau/bookings/{b.id}/receipt.pdf")
    assert r.status_code == 200 and r["Content-Type"] == "application/pdf" and r.content.startswith(b"%PDF")
    assert sc.get(f"/api/v1/bolau/bookings/{b.id}/receipt.pdf").status_code == 404
    # Ghardhani cancels inside the free window → refunded (manually by ops: gateway stub)
    gc.post(f"/api/v1/bolau/bookings/{b.id}/cancel", {"reason": "x"}, format="json")
    b.refresh_from_db()
    assert b.booking_fee_status == "refunded" and b.fee_charge.status == "refunded" and b.fee_refund_manual


def test_receipt_unavailable_when_not_paid():
    b, profile, sc, user, gc = accepted_booking()
    r = gc.get(f"/api/v1/bolau/bookings/{b.id}/receipt.pdf")
    assert r.status_code == 400 and r.json()["error"]["code"] == "invalid_state"


# --------------------------------------------------------------------------- search + trades
def test_search_ranking_alias_and_card_shape(api):
    from apps.workers.models import TradeAlias

    TradeAlias.objects.get_or_create(trade_id="plumber", alias="dhara mistri", language="ne_rom")
    top, _s, _c = make_sipalu("top-plumber", trade="plumber")
    low, _s2, _c2 = make_sipalu("new-plumber", trade="plumber")
    make_sipalu("some-cook", trade="cook")
    SipaluProfile.objects.filter(pk=top.pk).update(
        rating_avg="4.90", rating_count=20, jobs_completed=30, response_time_minutes=10
    )
    res = api.get("/api/v1/bolau/search?q=dhara&district=kathmandu")
    assert res.status_code == 200, res.content
    handles = [r["handle"] for r in res.json()["results"]]
    assert handles == ["top-plumber", "new-plumber"]
    card = res.json()["results"][0]
    for key in (
        "handle",
        "name",
        "photo_url",
        "headline",
        "top_trade",
        "rating_avg",
        "rating_count",
        "jobs_completed",
        "verification_level",
        "from_price",
        "next_available",
        "distance_band",
        "instant_booking",
        "indexable",
    ):
        assert key in card
    assert card["indexable"] is False
    SipaluProfile.objects.filter(pk=top.pk).update(public_indexable=True)
    assert api.get("/api/v1/bolau/search?q=dhara").json()["results"][0]["indexable"] is True
    assert "phone" not in json.dumps(res.json())
    assert api.get("/api/v1/bolau/search?trade=cook").json()["count"] == 1
    assert api.get("/api/v1/bolau/search?trade=plumber&max_price=100").json()["count"] == 0
    assert api.get("/api/v1/bolau/search?instant=1").json()["count"] == 0
    assert api.get("/api/v1/bolau/search?trade=plumber&district=jhapa").json()["count"] == 0
    # asked slot: a busy Sipalu ranks below a free one
    _u, addr, gc = make_ghardhani()
    assert book(gc, top, addr, top.services.first(), tomorrow_at(10)).status_code == 201
    day = tomorrow_at(10).date().isoformat()
    handles = [
        r["handle"]
        for r in api.get(f"/api/v1/bolau/search?trade=plumber&date={day}&time=10:00").json()["results"]
    ]
    assert handles[0] == "new-plumber"


def test_public_config(api, settings):
    from tests.bolau_helpers import flag_off

    settings.BOLAU_BOOKING_FEE = "49"
    settings.BOLAU_FREE_CANCEL_HOURS = 2
    settings.BOLAU_ACCEPT_TIMEOUT_MINUTES = 30
    res = api.get("/api/v1/bolau/config")
    assert res.status_code == 200, res.content
    body = res.json()
    assert body["booking_fee"] == "49.00" and body["booking_fee_enabled"] is False
    assert body["free_cancel_hours"] == 2 and body["accept_timeout_minutes"] == 30
    assert body["max_offers"] == 3 and body["emergency_line"] == "100"
    assert body["min_hourly_rate"] is not None
    flag_on("bolau_fee")
    settings.BOLAU_FREE_CANCEL_HOURS = 3
    body = api.get("/api/v1/bolau/config/").json()
    assert body["booking_fee_enabled"] is True and body["free_cancel_hours"] == 3
    flag_off()
    cache.clear()
    assert api.get("/api/v1/bolau/config").status_code == 404


def test_trades_k_anonymity(api):
    for i in range(5):
        make_sipalu(f"elec-{i}", trade="electrician", price=str(600 + i * 10))
    make_sipalu("only-cook", trade="cook")
    rows = {r["code"]: r for r in api.get("/api/v1/bolau/trades").json()}
    assert (
        rows["electrician"]["sipalu_count"] == 5
        and rows["electrician"]["price"]["fixed"]["median"] == "620.00"
    )
    assert rows["cook"]["price"]["fixed"] is None  # < 5 Sipalu → suppressed


# --------------------------------------------------------------------------- risk detectors
def _finish(b, gc, sc):
    Booking.objects.filter(pk=b.pk).update(
        status="confirmed", completed_at=timezone.now(), confirmed_at=timezone.now()
    )


def test_risk_cancellation_abuse_and_off_platform_reports():
    profile, service, sc = make_sipalu()
    user, addr, gc = make_ghardhani()
    for h in (8, 11, 14):
        bid = book(gc, profile, addr, service, tomorrow_at(h)).json()["id"]
        sc.post(f"/api/v1/me/bolau/bookings/{bid}/accept", {}, format="json")
        sc.post(f"/api/v1/me/bolau/bookings/{bid}/cancel", {"reason": "busy"}, format="json")
    flag = FraudFlag.objects.get(
        kind="booking_cancellations", subject_type="worker", subject_id=str(profile.worker_id)
    )
    assert flag.severity == "medium" and flag.details["count_30d"] == 3
    bid = book(gc, profile, addr, service, tomorrow_at(17)).json()["id"]
    r = gc.post(
        f"/api/v1/bolau/bookings/{bid}/report",
        {"reason": "off_platform_payment", "note": "Asked to pay cash first"},
        format="json",
    )
    assert r.status_code == 201
    flag = FraudFlag.objects.get(kind="off_platform_payment", subject_id=str(profile.worker_id))
    assert flag.severity == "medium"


def test_risk_review_fraud_same_device():
    profile, service, sc = make_sipalu()
    for i in range(2):
        user, addr, gc = make_ghardhani()
        bid = book(gc, profile, addr, service, tomorrow_at(9 + i * 2)).json()["id"]
        Booking.objects.filter(pk=bid).update(status="confirmed")
        r = gc.post(
            f"/api/v1/bolau/bookings/{bid}/rate", {"score": 5}, format="json", HTTP_USER_AGENT="SameBot/1.0"
        )
        assert r.status_code == 201
    flag = FraudFlag.objects.get(kind="review_fraud", subject_id=str(profile.worker_id))
    assert "same_device" in flag.details["signals"]


# --------------------------------------------------------------------------- trust component
def test_trust_bookings_component():
    from apps.trust.services import recompute_trust

    profile, service, sc = make_sipalu()
    w = profile.worker
    t = recompute_trust(w)
    assert t.reliability_score is None and "bookings" not in t.breakdown  # unchanged without bookings
    user, addr, gc = make_ghardhani()
    for i in range(3):
        bid = book(gc, profile, addr, service, tomorrow_at(8 + i * 2)).json()["id"]
        Booking.objects.filter(pk=bid).update(status="confirmed", accepted_at=timezone.now())
        BookingRating.objects.create(booking_id=bid, side="ghardhani", rater=user, score=5)
    t = recompute_trust(w)
    assert t.breakdown["bookings"] == 1.0
    # bookings only: 0.7 × 1.0 + 0.3 × skills(0.2) = 0.76
    assert t.reliability_score == 76
    # an employment blends 80/20
    f.EmploymentFactory(worker=w, start_date=dt.date(2025, 1, 1))
    t2 = recompute_trust(w)
    assert t2.breakdown["bookings"] == 1.0 and t2.reliability_score is not None
    res = auth_client(w.user).get("/api/v1/me/trust").json()
    assert res["breakdown"]["bookings"] == 1.0
