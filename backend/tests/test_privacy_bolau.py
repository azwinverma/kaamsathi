"""§11 privacy × Bolau: the export covers household and Sipalu data; deletion takes a Sipalu off the
public marketplace (B1) and scrubs household / Sipalu personal fields while keeping the bookings,
fees and disputes that accounting and dispute handling need (B2)."""

import io
import json
import zipfile

import pytest
from django.core.files.base import ContentFile
from django.utils import timezone

from apps.bolau.models import (
    Address,
    Booking,
    BookingRating,
    KaamRequest,
    Offer,
    PortfolioItem,
    SipaluProfile,
    TimeOff,
)
from apps.notifications.models import Notification
from apps.trust.models import Dispute
from tests.bolau_helpers import book, flag_on, make_ghardhani, make_sipalu, tomorrow_at
from tests.conftest import auth_client
from tests.test_bolau_requests import offer, post_request

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _bolau_on(db, monkeypatch):
    flag_on()
    from apps.notifications import services as notifications

    monkeypatch.setattr(notifications.transaction, "on_commit", lambda fn, *a, **k: fn())


def _export(client) -> dict:
    res = client.post("/api/v1/me/privacy-requests", {"kind": "export"})
    assert res.status_code == 201, res.content
    dl = client.get(f"/api/v1/me/privacy-requests/{res.json()['id']}/download")
    zf = zipfile.ZipFile(io.BytesIO(b"".join(dl.streaming_content)))
    assert zf.read("data.pdf").startswith(b"%PDF")
    return json.loads(zf.read("data.json"))


def _delete(client, staff_client):
    req = client.post("/api/v1/me/privacy-requests", {"kind": "deletion"}).json()
    res = staff_client.post(f"/api/v1/ops/privacy-requests/{req['id']}/process", {"action": "approve"})
    assert res.status_code == 200, res.content
    return res.json()


@pytest.fixture
def world():
    """A Sipalu with portfolio + time off, a household with a confirmed+rated booking, an open
    requested booking, an accepted booking, a Kaam request with the Sipalu's pending offer, a dispute
    and a safety report."""
    profile, service, sc = make_sipalu("hari-plumber", trade="plumber")
    profile.bio = "Twenty years fixing taps"
    profile.save(update_fields=["bio"])
    item = PortfolioItem(profile=profile, caption="Kitchen sink")
    item.image.save("sink.png", ContentFile(b"png"), save=False)
    item.save()
    TimeOff.objects.create(
        profile=profile, from_date=tomorrow_at(days=20).date(), to_date=tomorrow_at(days=21).date()
    )
    user, addr, gc = make_ghardhani()

    done = book(gc, profile, addr, service, start=tomorrow_at(8)).json()["id"]
    sc.post(f"/api/v1/me/bolau/bookings/{done}/accept", {}, format="json")
    Booking.objects.filter(pk=done).update(status="confirmed", completed_at=timezone.now())
    gc.post(f"/api/v1/bolau/bookings/{done}/rate", {"score": 5, "comment": "Sita says great"}, format="json")
    sc.post(f"/api/v1/bolau/bookings/{done}/rate", {"score": 4, "comment": "Kind family"}, format="json")
    d = gc.post(f"/api/v1/bolau/bookings/{done}/dispute", {"description": "Tap leaks again"}, format="json")
    assert d.status_code == 201, d.content
    gc.post(
        f"/api/v1/bolau/bookings/{done}/safety-report",
        {"safety_kind": "other", "description": "Felt unsafe"},
        format="json",
    )
    accepted = book(gc, profile, addr, service, start=tomorrow_at(12)).json()["id"]
    assert sc.post(f"/api/v1/me/bolau/bookings/{accepted}/accept", {}, format="json").status_code == 200
    requested = book(gc, profile, addr, service, start=tomorrow_at(16)).json()["id"]
    rid = post_request(gc, addr).json()["id"]
    assert offer(sc, rid, hour=10).status_code == 201
    return {
        "profile": profile,
        "sc": sc,
        "user": user,
        "addr": addr,
        "gc": gc,
        "done": done,
        "accepted": accepted,
        "requested": requested,
        "rid": rid,
        "dispute": d.json()["id"],
    }


# --------------------------------------------------------------------------- export
def test_household_export_includes_bolau_data(world):
    data = _export(world["gc"])
    bolau = data["bolau_household"]
    assert bolau["addresses"][0]["line"] == "House 12, Bhatbhateni Marg"
    assert {b["id"] for b in bolau["bookings"]} == {world["done"], world["accepted"], world["requested"]}
    assert bolau["kaam_requests"][0]["id"] == world["rid"]
    assert bolau["ratings_given"][0]["comment"] == "Sita says great"
    assert bolau["ratings_received"][0]["score"] == 4
    assert bolau["disputes"][0]["id"] == world["dispute"]
    assert bolau["safety_reports"][0]["description"].endswith("Felt unsafe")
    # the Sipalu's personal details are not in the household's copy
    assert world["profile"].worker.phone not in json.dumps(data)


def test_sipalu_export_includes_bolau_data(world):
    data = _export(world["sc"])
    sip = data["bolau_sipalu"]
    assert sip["profile"]["handle"] == "hari-plumber" and sip["profile"]["bio"] == "Twenty years fixing taps"
    assert sip["services"][0]["title"] == "plumber visit"
    assert len(sip["availability"]) == 7 and len(sip["time_off"]) == 1
    assert sip["portfolio"][0]["caption"] == "Kitchen sink" and sip["portfolio"][0]["image"] is True
    assert {b["id"] for b in sip["bookings"]} == {world["done"], world["accepted"], world["requested"]}
    assert sip["offers"][0]["request_code"].startswith("KR-")
    assert sip["ratings_received"][0]["comment"] == "Sita says great"
    assert sip["ratings_given"][0]["comment"] == "Kind family"
    # the household's exact address and phone never appear in the Sipalu's copy
    dumped = json.dumps(data, ensure_ascii=False)
    assert "Bhatbhateni" not in dumped and world["user"].phone not in dumped


# --------------------------------------------------------------------------- B1 Sipalu deletion
def test_sipalu_deletion_takes_them_off_bolau(world, staff_client, api):
    profile = world["profile"]
    old_handle = profile.handle
    _delete(world["sc"], staff_client)

    p = SipaluProfile.objects.get(pk=profile.pk)
    assert p.bolau_enabled is False and p.public_consent_at is None
    assert p.headline == p.bio == p.headline_ne == p.bio_ne == ""
    assert p.handle != old_handle and "hari" not in p.handle
    assert p.worker.verification_status != "verified"
    assert not p.services.filter(is_active=True).exists()
    assert not p.availability.exists() and not p.time_off.exists() and not p.portfolio.exists()
    assert not PortfolioItem.objects.filter(profile=profile).exists()

    assert api.get(f"/api/v1/public/sipalu/{old_handle}").status_code == 404
    assert api.get(f"/api/v1/public/sipalu/{p.handle}").status_code == 404
    assert api.get("/api/v1/bolau/search?q=plumber").json()["count"] == 0
    _u, addr2, gc2 = make_ghardhani(phone="9811112222")
    r = book(gc2, p, addr2, start=tomorrow_at(18), trade="plumber")
    assert r.status_code == 400

    # open work is closed, the household is told; finished work is kept for accounting
    for bid in (world["requested"], world["accepted"]):
        b = Booking.objects.get(pk=bid)
        assert b.status == "cancelled" and b.cancelled_by == "ops"
    assert Notification.objects.filter(user=world["user"], kind="bolau_booking_cancelled").count() == 2
    assert Booking.objects.get(pk=world["done"]).status == "disputed"
    assert Offer.objects.get(request_id=world["rid"]).status == "withdrawn"
    assert Offer.objects.get(request_id=world["rid"]).message == ""
    # reviews about them are no longer published with text
    assert BookingRating.objects.get(booking_id=world["done"], side="ghardhani").comment == ""


# --------------------------------------------------------------------------- B2 household deletion
def test_household_deletion_scrubs_bolau_personal_data(world, staff_client):
    user, addr = world["user"], world["addr"]
    _delete(world["gc"], staff_client)

    a = Address.objects.get(pk=addr.id)
    assert a.line == "" and a.landmark is None and a.lat is None and a.lng is None and a.is_active is False
    done = Booking.objects.get(pk=world["done"])
    assert done.description == "" and "line" not in done.address_snapshot
    assert done.booking_fee_status and done.code  # kept for accounting
    assert Dispute.objects.filter(pk=world["dispute"]).exists()  # kept for dispute handling
    for bid in (world["requested"], world["accepted"]):
        assert Booking.objects.get(pk=bid).status == "cancelled"
    assert Notification.objects.filter(
        user=world["profile"].worker.user, kind="bolau_booking_cancelled"
    ).exists()
    req = KaamRequest.objects.get(pk=world["rid"])
    assert req.status == "cancelled" and req.title == "" and req.description == ""
    assert BookingRating.objects.get(booking_id=world["done"], side="ghardhani").comment == ""
    assert BookingRating.objects.get(booking_id=world["done"], side="sipalu").comment == ""
    user.refresh_from_db()
    assert user.is_active is False and user.full_name == "Deleted user"
    assert user.ghardhani.display_name == ""


def test_household_only_user_can_be_deleted_without_worker(staff_client):
    user, addr, gc = make_ghardhani()
    _delete(gc, staff_client)
    assert Address.objects.get(pk=addr.id).line == ""
    assert auth_client(user).get("/api/v1/me/addresses").status_code == 401
