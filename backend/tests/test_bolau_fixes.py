"""Bolau fixes from the end-to-end verification run: verified identity lock (M1), dispute outcome
restores the booking and reaches both parties (M2/M3), trade search words (M4), ``bolau_enabled`` in
completeness (M5), suspension closes open work (M6), review first name and payment agreement."""

import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from PIL import Image

from apps.bolau.models import Booking, BookingRating, GhardhaniProfile, KaamRequest, Offer, SipaluProfile
from apps.notifications.models import Notification
from apps.workers.models import Worker
from tests import factories as f
from tests.bolau_helpers import book, flag_on, make_ghardhani, make_sipalu

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _bolau_on(db):
    flag_on()


def png(name="p.png"):
    out = io.BytesIO()
    Image.new("RGB", (8, 8)).save(out, format="PNG")
    return SimpleUploadedFile(name, out.getvalue(), content_type="image/png")


def _accepted(sc, gc, profile, addr, service, **kw):
    bid = book(gc, profile, addr, service, **kw).json()["id"]
    assert sc.post(f"/api/v1/me/bolau/bookings/{bid}/accept", {}, format="json").status_code == 200
    return bid


# --------------------------------------------------------------------------- M1 identity lock
def test_verified_sipalu_cannot_change_name_or_identity():
    profile, _service, sc = make_sipalu()
    worker = profile.worker
    worker.citizenship_no = "12-01-75-00001"
    worker.save(update_fields=["citizenship_no"])
    for body in ({"name": "Someone Else"}, {"name_ne": "अर्कै"}):
        r = sc.patch("/api/v1/me/sipalu", body, format="json")
        assert r.status_code == 400, r.content
        assert "support" in r.json()["error"]["message"].lower()
    r = sc.post(
        "/api/v1/me/sipalu/onboarding-step",
        {"step": "name", "data": {"full_name": "Someone Else"}},
        format="json",
    )
    assert r.status_code == 400
    r = sc.post(
        "/api/v1/me/sipalu/onboarding-step",
        {"step": "identity", "data": {"citizenship_no": "99-99-99-99999"}},
        format="json",
    )
    assert r.status_code == 400
    worker.refresh_from_db()
    assert worker.full_name == "Ram-Electric Thapa" and worker.citizenship_no == "12-01-75-00001"
    # the same name again is not a change; other fields still save
    r = sc.patch("/api/v1/me/sipalu", {"name": worker.full_name, "headline": "Fans fixed"}, format="json")
    assert r.status_code == 200, r.content
    # in Nepali
    r = sc.patch("/api/v1/me/sipalu", {"name": "X Y"}, format="json", HTTP_ACCEPT_LANGUAGE="ne")
    assert r.status_code == 400 and "सहायता" in r.json()["error"]["message"]


def test_unverified_sipalu_can_still_edit_name_and_identity():
    profile, _service, sc = make_sipalu(verified=False)
    r = sc.patch("/api/v1/me/sipalu", {"name": "Ram Bahadur Thapa"}, format="json")
    assert r.status_code == 200, r.content
    r = sc.post(
        "/api/v1/me/sipalu/onboarding-step",
        {"step": "name", "data": {"full_name": "Ram B Thapa", "full_name_ne": "राम"}},
        format="json",
    )
    assert r.status_code == 200, r.content
    assert Worker.objects.get(pk=profile.worker_id).full_name_ne == "राम"


def test_me_worker_locks_nepali_name_once_verified():
    profile, _service, sc = make_sipalu()
    r = sc.patch("/api/v1/me/worker", {"full_name_ne": "अर्कै नाम"}, format="json")
    assert r.status_code == 400 and "full_name_ne" in r.json()["error"]["fields"]
    assert sc.patch("/api/v1/me/worker", {"is_available": False}, format="json").status_code == 200


# --------------------------------------------------------------------------- M2 / M3 disputes
@pytest.fixture
def disputed():
    profile, service, sc = make_sipalu()
    user, addr, gc = make_ghardhani()
    bid = _accepted(sc, gc, profile, addr, service)
    r = gc.post(f"/api/v1/bolau/bookings/{bid}/dispute", {"description": "Overcharged"}, format="json")
    assert r.status_code == 201, r.content
    return {"bid": bid, "did": r.json()["id"], "gc": gc, "sc": sc, "profile": profile, "user": user}


def test_resolving_booking_dispute_restores_status_and_tells_both_sides(disputed, staff_client):
    bid, did = disputed["bid"], disputed["did"]
    assert Booking.objects.get(pk=bid).status == "disputed"
    r = staff_client.post(
        f"/api/v1/ops/disputes/{did}/resolve", {"status": "resolved", "note": "Refund agreed"}, format="json"
    )
    assert r.status_code == 200, r.content
    assert Booking.objects.get(pk=bid).status == "accepted"
    gh = Notification.objects.get(user=disputed["user"], kind="bolau_dispute_resolved")
    sip = Notification.objects.get(user=disputed["profile"].worker.user, kind="bolau_dispute_resolved")
    assert "you raised" in gh.body.lower()
    assert "the ghardhani raised" in sip.body.lower()
    assert gh.body_ne and sip.body_ne
    # The parties see a role, not the staff member's name; ops still sees who decided.
    for client, url in (
        (disputed["gc"], f"/api/v1/me/booking-disputes/{did}"),
        (disputed["sc"], f"/api/v1/me/disputes/{did}"),
    ):
        resolved_by = client.get(url).json()["resolved_by"]
        assert resolved_by["id"] is None and resolved_by["full_name"] == "KaamSathi team"
    ops = staff_client.get(f"/api/v1/ops/disputes/{did}").json()["resolved_by"]
    assert ops["id"] and ops["full_name"] != "KaamSathi team"


def test_appeal_decision_on_booking_dispute_notifies_both_and_leaves_booking_usable(disputed, staff_client):
    bid, did, gc = disputed["bid"], disputed["did"], disputed["gc"]
    staff_client.post(
        f"/api/v1/ops/disputes/{did}/resolve", {"status": "rejected", "note": "n"}, format="json"
    )
    assert (
        gc.post(f"/api/v1/me/booking-disputes/{did}/appeal", {"reason": "r"}, format="json").status_code
        == 200
    )
    # a booking left disputed while the appeal ran is restored on the appeal decision
    Booking.objects.filter(pk=bid).update(status="disputed")
    other = auth_staff()
    r = other.post(
        f"/api/v1/ops/disputes/{did}/appeal-decision", {"outcome": "upheld", "note": "n"}, format="json"
    )
    assert r.status_code == 200, r.content
    assert Booking.objects.get(pk=bid).status == "accepted"
    assert Notification.objects.filter(user=disputed["user"], kind="bolau_dispute_appeal").exists()
    assert Notification.objects.filter(
        user=disputed["profile"].worker.user, kind="bolau_dispute_appeal"
    ).exists()
    appeal = gc.get(f"/api/v1/me/booking-disputes/{did}").json()["appeal"]
    assert appeal["resolved_by"]["id"] is None


def auth_staff():
    from tests.conftest import auth_client

    return auth_client(f.UserFactory(is_staff=True))


def test_sipalu_raised_dispute_wording(staff_client):
    profile, service, sc = make_sipalu()
    user, addr, gc = make_ghardhani()
    bid = _accepted(sc, gc, profile, addr, service)
    did = sc.post(f"/api/v1/bolau/bookings/{bid}/dispute", {"description": "Not paid"}, format="json").json()[
        "id"
    ]
    staff_client.post(
        f"/api/v1/ops/disputes/{did}/resolve", {"status": "resolved", "note": "n"}, format="json"
    )
    sip = Notification.objects.get(user=profile.worker.user, kind="bolau_dispute_resolved")
    gh = Notification.objects.get(user=user, kind="bolau_dispute_resolved")
    assert "you raised" in sip.body.lower() and "the sipalu raised" in gh.body.lower()


# --------------------------------------------------------------------------- M4 search words
@pytest.mark.parametrize("q", ["bijuli", "बिजुली", "Bijuli Mistri", "electric"])
def test_search_by_everyday_words_finds_electricians(api, q):
    make_sipalu("ram-electric", trade="electrician")
    make_sipalu("some-cook", trade="cook")
    res = api.get("/api/v1/bolau/search", {"q": q})
    assert res.status_code == 200, res.content
    assert [r["handle"] for r in res.json()["results"]] == ["ram-electric"]


def test_seed_reference_search_words_are_idempotent():
    from django.core.management import call_command

    from apps.core.reference_data import TRADE_ALIASES
    from apps.workers.models import TradeAlias

    n = TradeAlias.objects.count()
    assert n >= sum(len(v) for v in TRADE_ALIASES.values())
    assert set(TRADE_ALIASES) == set(TradeAlias.objects.values_list("trade_id", flat=True))
    call_command("seed_reference", verbosity=0)
    assert TradeAlias.objects.count() == n


# --------------------------------------------------------------------------- M5 bolau_enabled
def test_completeness_lists_bolau_enabled_when_everything_else_is_ready():
    from apps.bolau import profiles

    profile, _service, sc = make_sipalu()
    w = profile.worker
    w.photo.save("p.png", png(), save=False)
    w.payment_method, w.wallet_id = "esewa", "9800000000"
    w.save()
    w.languages.create(language="ne", proficiency="native")
    assert profiles.completeness(profile)["missing"] == []
    SipaluProfile.objects.filter(pk=profile.pk).update(bolau_enabled=False)
    profile.refresh_from_db()
    comp = profiles.completeness(profile)
    assert comp["missing"] == ["bolau_enabled"] and comp["percent"] == 100
    item = next(i for i in comp["items"] if i["key"] == "bolau_enabled")
    assert item["done"] is False and item["label"]
    # not listed while other steps are still missing
    w.languages.all().delete()
    assert "bolau_enabled" not in profiles.completeness(profile)["missing"]
    # switching it on through the API clears it
    w.languages.create(language="ne", proficiency="native")
    r = sc.patch("/api/v1/me/sipalu", {"bolau_enabled": True}, format="json")
    assert r.status_code == 200 and r.json()["completeness"]["missing"] == []


# --------------------------------------------------------------------------- M6 suspension
def test_suspension_cancels_requested_bookings_and_withdraws_offers(staff_client):
    from tests.test_bolau_requests import offer, post_request

    profile, service, sc = make_sipalu("hari-plumber", trade="plumber")
    user, addr, gc = make_ghardhani()
    requested = book(gc, profile, addr, service).json()["id"]
    rid = post_request(gc, addr).json()["id"]
    assert offer(sc, rid, hour=15).status_code == 201
    r = staff_client.post(
        f"/api/v1/ops/bolau/sipalu/{profile.handle}/suspend", {"reason": "Safety report"}, format="json"
    )
    assert r.status_code == 200, r.content
    b = Booking.objects.get(pk=requested)
    assert b.status == "cancelled" and b.cancelled_by == "ops"
    assert Offer.objects.get(request_id=rid).status == "withdrawn"
    assert KaamRequest.objects.get(pk=rid).status in KaamRequest.OPEN  # other Sipalu can still offer
    assert Notification.objects.filter(user=user, kind="bolau_booking_cancelled").exists()
    assert Notification.objects.filter(user=user, kind="bolau_offer_withdrawn").exists()


def test_suspended_or_unverified_sipalu_cannot_accept():
    profile, service, sc = make_sipalu()
    _user, addr, gc = make_ghardhani()
    bid = book(gc, profile, addr, service).json()["id"]
    SipaluProfile.objects.filter(pk=profile.pk).update(suspended_at=timezone.now(), bolau_enabled=False)
    r = sc.post(f"/api/v1/me/bolau/bookings/{bid}/accept", {}, format="json")
    assert r.status_code == 400 and r.json()["error"]["code"] == "invalid_state"
    b = Booking.objects.get(pk=bid)
    assert b.status == "requested" and not b.address_snapshot
    assert "Bhatbhateni" not in str(sc.get(f"/api/v1/bolau/bookings/{bid}").json())

    SipaluProfile.objects.filter(pk=profile.pk).update(suspended_at=None, bolau_enabled=True)
    Worker.objects.filter(pk=profile.worker_id).update(verification_status="rejected")
    r = sc.post(f"/api/v1/me/bolau/bookings/{bid}/accept", {}, format="json")
    assert r.status_code == 400


def test_offer_from_suspended_sipalu_cannot_be_accepted():
    from tests.test_bolau_requests import offer, post_request

    profile, _service, sc = make_sipalu("hari-plumber", trade="plumber")
    _user, addr, gc = make_ghardhani()
    rid = post_request(gc, addr).json()["id"]
    oid = offer(sc, rid, hour=15).json()["id"]
    SipaluProfile.objects.filter(pk=profile.pk).update(suspended_at=timezone.now(), bolau_enabled=False)
    r = gc.post(f"/api/v1/bolau/requests/{rid}/offers/{oid}/accept", {}, format="json")
    assert r.status_code == 400
    assert not Booking.objects.filter(offer_id=oid).exists()


# --------------------------------------------------------------------------- minor
def test_public_review_first_name_falls_back_to_display_name(api):
    from apps.bolau import payloads

    profile, service, sc = make_sipalu()
    user, addr, gc = make_ghardhani()
    user.full_name = ""
    user.save(update_fields=["full_name"])
    GhardhaniProfile.objects.update_or_create(user=user, defaults={"display_name": "Gita Rai"})
    bid = _accepted(sc, gc, profile, addr, service)
    Booking.objects.filter(pk=bid).update(status="confirmed")
    BookingRating.objects.create(booking_id=bid, side="ghardhani", rater=user, score=5)
    assert payloads.public_reviews(profile.worker)[0]["first_name"] == "Gita"


def test_payment_agreed_only_when_methods_match():
    from apps.bolau.bookings import payment_state

    now = timezone.now()
    b = Booking(paid_marked_by_ghardhani_at=now, paid_marked_by_sipalu_at=now)
    b.paid_method_ghardhani, b.paid_method_sipalu = "cash", "esewa"
    assert payment_state(b)["agreed"] is False
    b.paid_method_sipalu = "cash"
    assert payment_state(b)["agreed"] is True
    b.paid_marked_by_sipalu_at = None
    assert payment_state(b)["agreed"] is False


# ------------------------------------------------------------------- actor not notified (launch hardening)
def _kinds(user):
    return set(Notification.objects.filter(user=user).values_list("kind", flat=True))


def _completed_booking():
    profile, service, sc = make_sipalu()
    user, addr, gc = make_ghardhani()
    bid = _accepted(sc, gc, profile, addr, service)
    Booking.objects.filter(pk=bid).update(status="completed")
    Notification.objects.all().delete()
    return Booking.objects.get(pk=bid), user, profile.worker.user


def test_household_is_not_notified_of_its_own_confirm_payment_or_dispute():
    from apps.bolau import bookings

    booking, user, sipalu_user = _completed_booking()
    booking = bookings.confirm(booking, user)
    bookings.mark_paid(booking, user, "ghardhani", "cash")
    bookings.raise_dispute(booking, user, "ghardhani", "Left a mess")
    events = {"bolau_booking_confirmed", "bolau_booking_paid", "bolau_booking_disputed"}
    assert not _kinds(user) & events
    assert _kinds(sipalu_user) >= events


def test_sipalu_raising_a_dispute_is_not_notified_but_the_household_is():
    from apps.bolau import bookings

    booking, user, sipalu_user = _completed_booking()
    bookings.raise_dispute(booking, sipalu_user, "sipalu", "Not paid")
    assert "bolau_booking_disputed" not in _kinds(sipalu_user)
    assert "bolau_booking_disputed" in _kinds(user)


def test_auto_confirm_still_tells_both_sides():
    from apps.bolau import bookings

    booking, user, sipalu_user = _completed_booking()
    bookings.confirm(booking, auto=True)
    assert "bolau_booking_confirmed" in _kinds(user)
    assert "bolau_booking_confirmed" in _kinds(sipalu_user)
