"""Bolau bookings: state machine, double-booking, expiry, arrival code, visit-then-quote, cancellation
windows + fee, contact/address masking, party scoping (IDOR), ratings, flag-off behaviour."""

import datetime as dt

import pytest
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.billing.models import Charge
from apps.bolau import bookings as svc
from apps.bolau.models import Booking, BookingEvent, BookingRating
from apps.notifications.models import Notification
from tests import factories as f
from tests.bolau_helpers import book, flag_off, flag_on, make_ghardhani, make_sipalu, tomorrow_at
from tests.conftest import auth_client

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _bolau_on(db):
    flag_on()


@pytest.fixture
def setup():
    profile, service, sc = make_sipalu()
    user, addr, gc = make_ghardhani()
    return profile, service, sc, user, addr, gc


def go(client, booking_id, action, body=None, sipalu=False):
    prefix = "me/bolau/bookings" if sipalu else "bolau/bookings"
    return client.post(f"/api/v1/{prefix}/{booking_id}/{action}", body or {}, format="json")


def run_to_completed(setup, *, start=None):
    profile, service, sc, user, addr, gc = setup
    r = book(gc, profile, addr, service, start)
    assert r.status_code == 201, r.content
    bid = r.json()["id"]
    assert go(sc, bid, "accept", sipalu=True).status_code == 200
    code = gc.get(f"/api/v1/bolau/bookings/{bid}").json()["arrival_code"]
    assert go(sc, bid, "on-the-way", sipalu=True).status_code == 200
    assert go(sc, bid, "arrive", {"code": code}, sipalu=True).status_code == 200
    assert go(sc, bid, "start", sipalu=True).status_code == 200
    assert go(sc, bid, "complete", {"note": "Done"}, sipalu=True).status_code == 200
    return bid


# --------------------------------------------------------------------------- lifecycle
def test_full_lifecycle_with_events_and_notifications(setup):
    profile, service, sc, user, addr, gc = setup
    r = book(gc, profile, addr, service)
    assert r.status_code == 201, r.content
    body = r.json()
    assert body["status"] == "requested" and body["code"].startswith("BK-")
    assert body["quoted_price"] == "600.00" and body["booking_fee_status"] == "waived"
    assert body["expires_at"]
    bid = body["id"]
    # Sipalu was notified (SMS-worthy event)
    assert Notification.objects.filter(user=profile.worker.user, kind="bolau_booking_requested").exists()
    assert go(sc, bid, "accept", sipalu=True).json()["status"] == "accepted"
    assert Notification.objects.filter(user=user, kind="bolau_booking_accepted").exists()
    bid2 = run_to_completed(setup, start=tomorrow_at(14))
    assert go(gc, bid2, "confirm").json()["status"] == "confirmed"
    events = [e.to_status for e in BookingEvent.objects.filter(booking_id=bid2).order_by("at")]
    assert events == [
        "requested",
        "accepted",
        "on_the_way",
        "arrived",
        "in_progress",
        "completed",
        "confirmed",
    ]
    profile.refresh_from_db()
    assert profile.jobs_completed == 1 and profile.response_time_minutes is not None
    # invalid transition
    r = go(gc, bid2, "confirm")
    assert r.status_code == 400 and r.json()["error"]["code"] == "invalid_state"


def test_instant_booking_is_accepted_immediately():
    profile, service, _sc = make_sipalu("instant-hari", instant=True)
    _u, addr, gc = make_ghardhani()
    r = book(gc, profile, addr, service)
    assert r.status_code == 201 and r.json()["status"] == "accepted"
    assert r.json()["arrival_code"] and len(r.json()["arrival_code"]) == 4


def test_no_double_booking_service_and_db(setup):
    profile, service, sc, user, addr, gc = setup
    _u2, addr2, gc2 = make_ghardhani()
    assert book(gc, profile, addr, service, tomorrow_at(10)).status_code == 201
    r = book(gc2, profile, addr2, service, tomorrow_at(10, 30))  # overlaps 10:00–11:00
    assert r.status_code == 409 and r.json()["error"]["code"] == "slot_taken"
    assert book(gc2, profile, addr2, service, tomorrow_at(11)).status_code == 201  # adjacent is fine
    # the exclusion constraint holds even if the service check is bypassed
    b = Booking.objects.filter(sipalu=profile.worker).order_by("scheduled_start").first()
    with pytest.raises(IntegrityError), transaction.atomic():
        Booking.objects.create(
            code="BK-RACE",
            ghardhani=b.ghardhani,
            sipalu=b.sipalu,
            trade=b.trade,
            address=b.address,
            scheduled_start=b.scheduled_start + dt.timedelta(minutes=15),
            scheduled_end=b.scheduled_end + dt.timedelta(minutes=15),
            price_type="fixed",
            quoted_price=b.quoted_price,
        )
    # a declined booking frees the slot
    go(sc, b.id, "decline", {"reason": "busy"}, sipalu=True)
    assert book(gc2, profile, addr2, service, tomorrow_at(10)).status_code == 201


def test_unbookable_and_out_of_area(setup):
    profile, service, sc, user, addr, gc = setup
    _u, far_addr, gc2 = make_ghardhani(district="jhapa")
    r = book(gc2, profile, far_addr, service)
    assert r.status_code == 400 and r.json()["error"]["fields"]["address_id"]
    unverified, s2, _ = make_sipalu("not-verified", verified=False)
    assert book(gc, unverified, addr, s2).status_code == 400
    # booking yourself
    _u3, own_addr, _ = make_ghardhani()
    own_addr.ghardhani = profile.worker.user
    own_addr.save()
    assert book(sc, profile, own_addr, service).status_code == 400


def test_expiry_and_fee_refund(setup):
    profile, service, sc, user, addr, gc = setup
    bid = book(gc, profile, addr, service).json()["id"]
    Booking.objects.filter(pk=bid).update(expires_at=timezone.now() - dt.timedelta(minutes=1))
    assert svc.expire_due() == 1
    b = Booking.objects.get(pk=bid)
    assert b.status == "expired"
    assert Notification.objects.filter(user=user, kind="bolau_booking_expired").exists()
    # accepting after expiry is refused
    assert go(sc, bid, "accept", sipalu=True).status_code == 400


def test_expires_at_is_min_of_timeout_and_15_before_start(setup):
    profile, service, sc, user, addr, gc = setup
    start = timezone.now() + dt.timedelta(minutes=70)
    start = start.replace(second=0, microsecond=0)
    local = timezone.localtime(start)
    if not (6 <= local.hour < 20):
        pytest.skip("outside test availability window")
    r = book(gc, profile, addr, service, start)
    assert r.status_code == 201, r.content
    b = Booking.objects.get(pk=r.json()["id"])
    assert b.expires_at <= start - dt.timedelta(minutes=15) + dt.timedelta(seconds=1)


def test_arrival_code_five_tries(setup):
    profile, service, sc, user, addr, gc = setup
    bid = book(gc, profile, addr, service).json()["id"]
    go(sc, bid, "accept", sipalu=True)
    b = Booking.objects.get(pk=bid)
    code = svc.arrival_code(b)
    assert b.arrival_code_hash and code not in b.arrival_code_hash  # stored hashed
    wrong = "0000" if code != "0000" else "1111"
    for i in range(4):
        r = go(sc, bid, "arrive", {"code": wrong}, sipalu=True)
        assert r.status_code == 400 and r.json()["error"]["code"] == "arrival_code_invalid"
        assert r.json()["error"]["fields"]["attempts_left"] == [str(4 - i)]
    r = go(sc, bid, "arrive", {"code": wrong}, sipalu=True)
    assert r.status_code == 423 and r.json()["error"]["code"] == "arrival_code_locked"
    r = go(sc, bid, "arrive", {"code": code}, sipalu=True)  # even the right code is locked now
    assert r.status_code == 423
    Booking.objects.filter(pk=bid).update(arrival_attempts=0)
    assert go(sc, bid, "arrive", {"code": code}, sipalu=True).json()["status"] == "arrived"


def test_visit_then_quote_requires_approval():
    profile, service, sc = make_sipalu(
        "quote-pal", trade="plumber", price_type="visit_then_quote", price="0", visit_fee="300"
    )
    user, addr, gc = make_ghardhani()
    r = book(gc, profile, addr, service)
    assert r.json()["quoted_price"] == "300.00" and r.json()["visit_fee"] == "300.00"
    bid = r.json()["id"]
    go(sc, bid, "accept", sipalu=True)
    code = gc.get(f"/api/v1/bolau/bookings/{bid}").json()["arrival_code"]
    go(sc, bid, "arrive", {"code": code}, sipalu=True)
    r = go(sc, bid, "start", sipalu=True)
    assert r.status_code == 400  # quote not approved
    assert go(sc, bid, "quote", {"amount": "2500"}, sipalu=True).json()["quote_status"] == "proposed"
    assert go(sc, bid, "approve-quote", sipalu=True).status_code == 404  # Sipalu route has no approve
    assert go(sc, bid, "approve-quote").status_code == 404  # not the Ghardhani
    assert go(gc, bid, "approve-quote").json()["quote_status"] == "approved"
    assert go(sc, bid, "start", sipalu=True).status_code == 200
    r = go(sc, bid, "complete", {"final_price": "2600"}, sipalu=True)
    assert r.status_code == 400  # above approved quote
    assert go(sc, bid, "complete", {"final_price": "2400"}, sipalu=True).json()["final_price"] == "2400.00"


def test_visit_then_quote_rejected_completes_with_visit_fee():
    profile, service, sc = make_sipalu(
        "quote-two", trade="plumber", price_type="visit_then_quote", price="0", visit_fee="250"
    )
    user, addr, gc = make_ghardhani()
    bid = book(gc, profile, addr, service).json()["id"]
    go(sc, bid, "accept", sipalu=True)
    code = gc.get(f"/api/v1/bolau/bookings/{bid}").json()["arrival_code"]
    go(sc, bid, "arrive", {"code": code}, sipalu=True)
    go(sc, bid, "quote", {"amount": "5000"}, sipalu=True)
    r = go(gc, bid, "reject-quote")
    assert r.json()["status"] == "completed" and r.json()["final_price"] == "250.00"


# --------------------------------------------------------------------------- cancellation + fee
def test_cancellation_windows_and_fee(setup):
    profile, service, sc, user, addr, gc = setup
    flag_on("bolau_fee")
    # free window: > 2 h before start → refundable (pending → waived)
    bid = book(gc, profile, addr, service, tomorrow_at(10)).json()["id"]
    go(sc, bid, "accept", sipalu=True)
    b = Booking.objects.get(pk=bid)
    assert b.booking_fee_status == "pending" and b.fee_charge.status == "unpaid"
    assert b.fee_charge.payer_user_id == user.id and b.fee_charge.kind == "booking_fee"
    r = go(gc, bid, "cancel", {"reason": "plans changed"})
    assert r.json()["status"] == "cancelled" and r.json()["late_cancellation"] is False
    b.refresh_from_db()
    assert b.booking_fee_status == "waived" and b.fee_charge.status == "waived"
    assert Notification.objects.filter(user=profile.worker.user, kind="bolau_booking_cancelled").exists()

    # late: inside 2 h → flagged late, fee kept (paid stays paid)
    bid = book(gc, profile, addr, service, tomorrow_at(15)).json()["id"]
    go(sc, bid, "accept", sipalu=True)
    Booking.objects.filter(pk=bid).update(booking_fee_status="paid", fee_paid_at=timezone.now())
    Charge.objects.filter(pk=Booking.objects.get(pk=bid).fee_charge_id).update(status="paid")
    Booking.objects.filter(pk=bid).update(
        scheduled_start=timezone.now() + dt.timedelta(minutes=90),
        scheduled_end=timezone.now() + dt.timedelta(minutes=150),
    )
    r = go(gc, bid, "cancel", {"reason": "late"})
    assert r.json()["late_cancellation"] is True
    b = Booking.objects.get(pk=bid)
    assert b.booking_fee_status == "paid"

    # Sipalu cancels after accepting → paid fee refunded, never a charge to the Sipalu
    bid = book(gc, profile, addr, service, tomorrow_at(17)).json()["id"]
    go(sc, bid, "accept", sipalu=True)
    Booking.objects.filter(pk=bid).update(booking_fee_status="paid")
    r = go(sc, bid, "cancel", {"reason": "sick"}, sipalu=True)
    assert r.status_code == 200
    b = Booking.objects.get(pk=bid)
    assert b.booking_fee_status == "refunded" and b.fee_charge.status == "refunded" and b.fee_refund_manual
    # Guiding rule 1: no booking-fee Charge is ever paid by a Sipalu
    sipalu_user_ids = set(Booking.objects.values_list("sipalu__user_id", flat=True))
    assert not Charge.objects.filter(kind="booking_fee", payer_user_id__in=sipalu_user_ids).exists()
    assert Charge.objects.filter(kind="booking_fee").count() == 3
    assert set(Charge.objects.filter(kind="booking_fee").values_list("payer_user_id", flat=True)) == {user.id}


def test_fee_waived_when_flag_off(setup):
    profile, service, sc, user, addr, gc = setup
    bid = book(gc, profile, addr, service).json()["id"]
    go(sc, bid, "accept", sipalu=True)
    b = Booking.objects.get(pk=bid)
    assert b.booking_fee_status == "waived" and str(b.booking_fee) == "49.00"
    assert b.fee_charge.status == "waived" and b.fee_charge.payer_user_id == user.id
    # waived/user charges never reach org invoices
    from apps.billing.services import billable_charges
    from apps.core.bs import BSMonth, today_ad

    m = BSMonth.of(today_ad())
    assert not billable_charges(m.year, m.month).filter(kind="booking_fee").exists()


def test_db_requires_ghardhani_payer_for_booking_fee():
    with pytest.raises(IntegrityError), transaction.atomic():
        Charge.objects.create(
            organization=f.OrganizationFactory(), kind="booking_fee", amount=49, description="x"
        )


def test_no_show_after_grace_refunds(setup):
    profile, service, sc, user, addr, gc = setup
    bid = book(gc, profile, addr, service).json()["id"]
    go(sc, bid, "accept", sipalu=True)
    assert go(gc, bid, "report-no-show").status_code == 400  # too early
    Booking.objects.filter(pk=bid).update(
        scheduled_start=timezone.now() - dt.timedelta(minutes=40),
        scheduled_end=timezone.now() + dt.timedelta(minutes=20),
    )
    assert go(gc, bid, "report-no-show").json()["status"] == "no_show"


def test_auto_confirm_after_24h(setup):
    bid = run_to_completed(setup)
    Booking.objects.filter(pk=bid).update(completed_at=timezone.now() - dt.timedelta(hours=25))
    assert svc.auto_confirm_due() == 1
    assert Booking.objects.get(pk=bid).status == "confirmed"


# --------------------------------------------------------------------------- masking + scoping
def test_contact_and_address_masking_windows(setup):
    profile, service, sc, user, addr, gc = setup
    bid = book(gc, profile, addr, service).json()["id"]
    # before acceptance: Sipalu sees only ward/municipality/district, no phone
    job = sc.get(f"/api/v1/bolau/bookings/{bid}").json()
    assert set(job["address"]) == {"ward", "municipality", "district"}
    assert job["ghardhani"]["phone"] is None and job["ghardhani"]["phone_masked"].startswith(user.phone[:2])
    assert user.phone not in str(job)
    c = sc.get(f"/api/v1/bolau/bookings/{bid}/contact").json()
    assert c["visible"] is False and c["phone"] is None
    g = gc.get(f"/api/v1/bolau/bookings/{bid}").json()
    assert g["sipalu"]["phone"] is None and "arrival_code" not in g
    # accepted → revealed both ways
    go(sc, bid, "accept", sipalu=True)
    job = sc.get(f"/api/v1/bolau/bookings/{bid}").json()
    assert job["address"]["line"] == "House 12, Bhatbhateni Marg" and job["address_revealed"] is True
    assert sc.get(f"/api/v1/bolau/bookings/{bid}/contact").json()["phone"] == user.phone
    assert gc.get(f"/api/v1/bolau/bookings/{bid}/contact").json()["phone"] == profile.worker.phone
    # 48 h after completion → hidden again
    Booking.objects.filter(pk=bid).update(
        status="completed", completed_at=timezone.now() - dt.timedelta(hours=49)
    )
    job = sc.get(f"/api/v1/bolau/bookings/{bid}").json()
    assert "line" not in job["address"] and job["ghardhani"]["phone"] is None
    assert sc.get(f"/api/v1/bolau/bookings/{bid}/contact").json()["visible"] is False


def test_cross_party_404s(setup):
    profile, service, sc, user, addr, gc = setup
    bid = book(gc, profile, addr, service).json()["id"]
    other_sipalu, _s, osc = make_sipalu("other-one")
    _u, _a, ogc = make_ghardhani()
    stranger = auth_client(f.UserFactory())
    for client in (osc, ogc, stranger):
        assert client.get(f"/api/v1/bolau/bookings/{bid}").status_code == 404
        assert client.get(f"/api/v1/bolau/bookings/{bid}/contact").status_code == 404
        assert go(client, bid, "cancel").status_code == 404
        assert go(client, bid, "accept", sipalu=True).status_code == 404
    # the Ghardhani cannot use Sipalu actions and vice versa
    assert go(gc, bid, "accept", sipalu=True).status_code == 404
    assert go(sc, bid, "confirm").status_code == 404
    # lists are scoped
    assert ogc.get("/api/v1/me/bolau/bookings").json()["count"] == 0
    assert osc.get("/api/v1/me/bolau/jobs").json()["count"] == 0
    assert sc.get("/api/v1/me/bolau/jobs?scope=incoming").json()["count"] == 1
    assert gc.get("/api/v1/me/bolau/bookings?status=requested").json()["count"] == 1
    assert stranger.get(f"/api/v1/bolau/bookings/{bid}/receipt.pdf").status_code == 404


def test_flag_off_hides_booking_endpoints(setup, api):
    profile, service, sc, user, addr, gc = setup
    bid = book(gc, profile, addr, service).json()["id"]
    flag_off()
    assert book(gc, profile, addr, service, tomorrow_at(16)).status_code == 404
    assert gc.get(f"/api/v1/bolau/bookings/{bid}").status_code == 404
    assert gc.get("/api/v1/me/bolau/bookings").status_code == 404
    assert api.get("/api/v1/bolau/search").status_code == 404
    assert api.get("/api/v1/bolau/trades").status_code == 404
    assert gc.post("/api/v1/bolau/requests", {}, format="json").status_code == 404
    # profile editing still allowed
    assert sc.patch("/api/v1/me/sipalu", {"headline": "Still editing"}, format="json").status_code == 200
    assert gc.get("/api/v1/me/addresses").status_code == 200


def test_paid_marks_from_both_sides(setup):
    bid = run_to_completed(setup)
    _p, _s, sc, _u, _a, gc = setup
    r = go(gc, bid, "paid", {"method": "esewa"})
    assert r.json()["payment_to_sipalu"]["ghardhani_method"] == "esewa"
    assert r.json()["payment_to_sipalu"]["agreed"] is False
    r = go(sc, bid, "paid", {"method": "esewa"})
    assert r.json()["payment_to_sipalu"]["agreed"] is True


# --------------------------------------------------------------------------- ratings
def test_ratings_once_per_side_after_confirm_and_moderation(setup, staff_client):
    profile, service, sc, user, addr, gc = setup
    bid = run_to_completed(setup)
    r = go(gc, bid, "rate", {"score": 5})
    assert r.status_code == 400  # not confirmed yet
    go(gc, bid, "confirm")
    r = go(gc, bid, "rate", {"score": 4, "comment": "Fixed the fan fast", "tags": ["on_time", "polite"]})
    assert r.status_code == 201, r.content
    assert go(gc, bid, "rate", {"score": 5}).status_code == 400  # once
    assert go(gc, bid, "rate", {"score": 5, "tags": ["respectful"]}).status_code == 400
    r = go(sc, bid, "rate", {"score": 5, "tags": ["paid_as_agreed"]})
    assert r.status_code == 201
    assert (
        go(sc, bid, "rate", {"score": 5, "tags": ["clean_work"]}).status_code == 400
    )  # wrong side's tag + once
    assert BookingRating.objects.filter(booking_id=bid).count() == 2
    profile.refresh_from_db()
    assert str(profile.rating_avg) == "4.00" and profile.rating_count == 1
    # the rated Sipalu flags the comment; ops hides it; public profile shows the score but not the comment
    rating = BookingRating.objects.get(booking_id=bid, side="ghardhani")
    assert (
        gc.post(f"/api/v1/bolau/ratings/{rating.id}/flag", {"reason": "x"}, format="json").status_code == 404
    )
    assert (
        sc.post(f"/api/v1/bolau/ratings/{rating.id}/flag", {"reason": "Not true"}, format="json").status_code
        == 200
    )
    assert (
        staff_client.post(
            f"/api/v1/ops/bolau/ratings/{rating.id}/hide", {"note": "unverifiable"}, format="json"
        ).status_code
        == 200
    )
    from rest_framework.test import APIClient

    pub = APIClient().get(f"/api/v1/public/sipalu/{profile.handle}").json()
    assert pub["reviews"][0]["score"] == 4 and pub["reviews"][0]["comment"] is None
    assert pub["reviews"][0]["first_name"] == "Sita"
    # voiding removes it from the stats
    assert (
        staff_client.post(
            f"/api/v1/ops/bolau/ratings/{rating.id}/void", {"reason": "fake"}, format="json"
        ).status_code
        == 200
    )
    profile.refresh_from_db()
    assert profile.rating_count == 0 and profile.rating_avg is None


def test_dispute_and_safety_report(setup):
    profile, service, sc, user, addr, gc = setup
    bid = run_to_completed(setup)
    r = go(gc, bid, "dispute", {"description": "Charged more than agreed"})
    assert r.status_code == 201 and r.json()["kind"] == "booking" and r.json()["booking"]["code"]
    assert Booking.objects.get(pk=bid).status == "disputed"
    assert go(sc, bid, "dispute", {"description": "again"}).status_code == 400
    # the Ghardhani can see the dispute through the trust visibility rule
    from apps.trust.disputes import can_view_dispute
    from apps.trust.models import Dispute

    d = Dispute.objects.get(booking_id=bid)
    assert can_view_dispute(user, d) and not can_view_dispute(f.UserFactory(), d)
    r = go(
        sc,
        bid,
        "safety-report",
        {"safety_kind": "harassment", "description": "Was shouted at", "anonymous": True},
    )
    assert r.status_code == 201 and r.json()["emergency_line"] == "100"
    from apps.support.models import SupportCase

    case = SupportCase.objects.get(number=r.json()["case_number"])
    assert (
        case.category == "safety" and case.confidential and Booking.objects.get(pk=bid).code in case.subject
    )


# --------------------------------------------------------------------------- telemetry
def test_booking_telemetry_events_carry_no_pii(setup):
    from apps.telemetry.models import Event

    profile, service, sc, user, addr, gc = setup
    bid = run_to_completed(setup)
    go(gc, bid, "confirm")
    assert go(gc, bid, "rate", {"score": 5}).status_code == 201
    names = list(Event.objects.filter(name__startswith="bolau_").values_list("name", flat=True))
    assert "bolau_booking_requested" in names and "bolau_rating_submitted" in names
    moves = Event.objects.filter(name="bolau_booking_status_changed", properties__booking_id=bid)
    assert [e.properties["to_status"] for e in moves.order_by("id")] == [
        "accepted",
        "on_the_way",
        "arrived",
        "in_progress",
        "completed",
        "confirmed",
    ]
    blob = str(list(Event.objects.filter(name__startswith="bolau_").values_list("properties", flat=True)))
    for secret in (user.phone, profile.worker.phone, addr.line, addr.landmark, "Fan is not working"):
        assert secret not in blob
