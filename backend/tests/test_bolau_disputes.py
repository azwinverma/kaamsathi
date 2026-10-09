"""Bolau booking disputes, Ghardhani side: GET /bolau/bookings/{id}/dispute (either party),
GET /me/booking-disputes[/{id}], evidence (party ``ghardhani``) and appeal — scoped to bookings
where the caller is the Ghardhani; never the Sipalu's other disputes (cross-party 404)."""

import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image

from apps.audit.models import AuditLog
from apps.trust.models import Dispute
from tests import factories as f
from tests.bolau_helpers import book, flag_off, flag_on, make_ghardhani, make_sipalu

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _bolau_on(db):
    flag_on()


def png(name="e.png"):
    out = io.BytesIO()
    Image.new("RGB", (8, 8)).save(out, format="PNG")
    return SimpleUploadedFile(name, out.getvalue(), content_type="image/png")


@pytest.fixture
def disputed():
    profile, service, sc = make_sipalu()
    user, addr, gc = make_ghardhani()
    bid = book(gc, profile, addr, service).json()["id"]
    assert sc.post(f"/api/v1/me/bolau/bookings/{bid}/accept", {}, format="json").status_code == 200
    r = gc.post(f"/api/v1/bolau/bookings/{bid}/dispute", {"description": "Never turned up"}, format="json")
    assert r.status_code == 201, r.content
    return {"bid": bid, "dispute_id": r.json()["id"], "gc": gc, "sc": sc, "profile": profile, "user": user}


def test_booking_dispute_visible_to_both_parties_only(disputed):
    bid, did = disputed["bid"], disputed["dispute_id"]
    for client in (disputed["gc"], disputed["sc"]):
        r = client.get(f"/api/v1/bolau/bookings/{bid}/dispute")
        assert r.status_code == 200 and r.json()["id"] == did and r.json()["booking"]["id"] == bid
    _u, _a, stranger = make_ghardhani(phone="9811111199")
    assert stranger.get(f"/api/v1/bolau/bookings/{bid}/dispute").status_code == 404
    # booking without a dispute → 404
    profile2, service2, _sc2 = make_sipalu("hari-plumber", trade="plumber")
    _u2, addr2, gc2 = make_ghardhani(phone="9811111198")
    other = book(gc2, profile2, addr2, service2).json()["id"]
    assert gc2.get(f"/api/v1/bolau/bookings/{other}/dispute").status_code == 404
    # raising still works on the same path (POST)
    assert (
        disputed["gc"].post(f"/api/v1/bolau/bookings/{bid}/dispute", {"description": "x"}).status_code == 400
    )
    flag_off()
    assert disputed["gc"].get(f"/api/v1/bolau/bookings/{bid}/dispute").status_code == 404


def test_me_booking_disputes_list_detail_and_scope(disputed):
    gc, sc, did = disputed["gc"], disputed["sc"], disputed["dispute_id"]
    # The Sipalu's unrelated employment dispute must never show up for the Ghardhani.
    worker = disputed["profile"].worker
    org = f.OrganizationFactory()
    emp = f.EmploymentFactory(organization=org, worker=worker)
    other = Dispute.objects.create(
        worker=worker, organization=org, employment=emp, kind="wage", description="x"
    )
    rows = gc.get("/api/v1/me/booking-disputes").json()["results"]
    assert [r["id"] for r in rows] == [did]
    assert gc.get(f"/api/v1/me/booking-disputes/{did}").status_code == 200
    assert gc.get(f"/api/v1/me/booking-disputes/{other.id}").status_code == 404
    assert gc.get(f"/api/v1/me/disputes/{did}").status_code == 404  # /me/disputes is the worker's view
    assert gc.get("/api/v1/me/booking-disputes?status=resolved").json()["count"] == 0
    # The Sipalu is not the Ghardhani here: their /me/booking-disputes is empty, cross access 404s.
    assert sc.get("/api/v1/me/booking-disputes").json()["count"] == 0
    assert sc.get(f"/api/v1/me/booking-disputes/{did}").status_code == 404
    assert sc.get(f"/api/v1/me/disputes/{did}").status_code == 200  # the Sipalu's own side
    _u, _a, stranger = make_ghardhani(phone="9811111197")
    assert stranger.get(f"/api/v1/me/booking-disputes/{did}").status_code == 404
    assert stranger.get(f"/api/v1/me/booking-disputes/{did}/evidence").status_code == 404
    flag_off()  # not flag-gated: a household can always follow up on its own dispute
    assert gc.get(f"/api/v1/me/booking-disputes/{did}").status_code == 200


def test_ghardhani_evidence_and_appeal(disputed, staff_client):
    gc, sc, did = disputed["gc"], disputed["sc"], disputed["dispute_id"]
    r = gc.post(
        f"/api/v1/me/booking-disputes/{did}/evidence",
        {"file": png(), "note": "Door camera"},
        format="multipart",
    )
    assert r.status_code == 201, r.content
    assert (
        r.json()["party"] == "ghardhani" and r.json()["party_label"] == "Ghardhani" and r.json()["file_url"]
    )
    # the Sipalu sees it from their side and adds their own (party worker)
    r = sc.post(f"/api/v1/me/disputes/{did}/evidence", {"file": png("s.png")}, format="multipart")
    assert r.status_code == 201 and r.json()["party"] == "worker"
    assert len(gc.get(f"/api/v1/me/booking-disputes/{did}/evidence").json()) == 2
    _u, _a, stranger = make_ghardhani(phone="9811111196")
    assert (
        stranger.post(
            f"/api/v1/me/booking-disputes/{did}/evidence", {"file": png()}, format="multipart"
        ).status_code
        == 404
    )
    # no appeal before a decision
    assert (
        gc.post(f"/api/v1/me/booking-disputes/{did}/appeal", {"reason": "x"}, format="json").status_code
        == 400
    )
    r = staff_client.post(
        f"/api/v1/ops/disputes/{did}/resolve", {"status": "rejected", "note": "No evidence"}, format="json"
    )
    assert r.status_code == 200, r.content
    assert gc.get(f"/api/v1/me/booking-disputes/{did}").json()["can_appeal"] is True
    r = gc.post(
        f"/api/v1/me/booking-disputes/{did}/appeal", {"reason": "The camera shows nobody came"}, format="json"
    )
    assert r.status_code == 200, r.content
    assert r.json()["status"] == "appealed" and r.json()["appeal"]["party"] == "ghardhani"
    assert (
        gc.post(f"/api/v1/me/booking-disputes/{did}/appeal", {"reason": "again"}, format="json").status_code
        == 400
    )
    assert AuditLog.objects.filter(action="dispute.appeal", object_id=did).exists()
    assert AuditLog.objects.filter(action="dispute.evidence.add", object_id=did).count() == 2
