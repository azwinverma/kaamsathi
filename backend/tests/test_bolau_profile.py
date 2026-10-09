"""Bolau — Sipalu self-registration, onboarding/completeness, handles, prices, availability, public
profile (docs/CONTRACT-BOLAU.md §1)."""

import datetime as dt
import io

import pytest
from django.utils import timezone
from PIL import Image

from apps.bolau.models import SipaluProfile, TimeOff
from apps.workers.models import Consent, Worker
from tests import factories as f
from tests.bolau_helpers import book, flag_off, flag_on, make_ghardhani, make_sipalu, tomorrow_at
from tests.conftest import auth_client

pytestmark = pytest.mark.django_db


def jpeg(name="p.jpg"):
    buf = io.BytesIO()
    Image.new("RGB", (40, 40), (200, 100, 50)).save(buf, "JPEG")
    buf.seek(0)
    buf.name = name
    return buf


# --------------------------------------------------------------------------- becoming a Sipalu
def test_user_without_worker_gets_one_pending_with_consent():
    user = f.UserFactory(full_name="Hari Prasad Adhikari")
    res = auth_client(user).get("/api/v1/me/sipalu")
    assert res.status_code == 200, res.content
    body = res.json()
    w = Worker.objects.get(user=user)
    assert w.phone == user.phone and w.verification_status == "pending"
    assert Consent.is_granted(w, None, "data_processing")
    assert body["handle"] == "hari-prasad-adhikari"
    assert body["bookable"] is False and "verified" in body["bookable_problems"]
    assert body["next_step"] == "photo"  # name already known
    # idempotent: second GET does not create another worker/profile
    auth_client(user).get("/api/v1/me/sipalu")
    assert (
        Worker.objects.filter(user=user).count() == 1 and SipaluProfile.objects.filter(worker=w).count() == 1
    )


def test_existing_unlinked_worker_with_same_phone_is_linked():
    w = f.WorkerFactory(phone="9812345678", full_name="Old Worker")
    user = f.UserFactory(phone="9812345678")
    auth_client(user).get("/api/v1/me/sipalu")
    w.refresh_from_db()
    assert w.user_id == user.id and Worker.objects.filter(phone="9812345678").count() == 1


def test_profile_editing_allowed_with_flag_off():
    flag_off()
    user = f.UserFactory(full_name="Maya Gurung")
    c = auth_client(user)
    res = c.patch("/api/v1/me/sipalu", {"headline": "Clean homes, on time", "bio": "10 years"}, format="json")
    assert res.status_code == 200 and res.json()["headline"] == "Clean homes, on time"


# --------------------------------------------------------------------------- onboarding
def test_onboarding_steps_progress_and_completeness():
    user = f.UserFactory(full_name="")
    c = auth_client(user)
    post = lambda step, data=None, **kw: c.post(  # noqa: E731
        "/api/v1/me/sipalu/onboarding-step", {"step": step, "data": data or {}}, format="json", **kw
    )
    r = post("name", {"full_name": "Bikash Tamang", "full_name_ne": "बिकास तामाङ"})
    assert r.status_code == 200, r.content
    assert "name" in r.json()["completed_steps"] and r.json()["next_step"] == "photo"
    r = c.post("/api/v1/me/sipalu/onboarding-step", {"step": "photo", "photo": jpeg()}, format="multipart")
    assert r.status_code == 200, r.content
    assert "photo" in r.json()["completed_steps"]
    assert (
        post(
            "skills", {"skills": [{"trade": "plumber", "years_experience": 7, "nstb_level": "level1"}]}
        ).status_code
        == 200
    )
    assert post("languages", {"languages": [{"language": "ne"}, {"language": "tam"}]}).status_code == 200
    assert (
        post(
            "service_area", {"service_districts": ["kathmandu", "lalitpur"], "base_lat": "27.71234"}
        ).status_code
        == 200
    )
    assert (
        post(
            "availability", {"rules": [{"weekday": 1, "start_time": "08:00", "end_time": "17:00"}]}
        ).status_code
        == 200
    )
    svc = {
        "services": [
            {
                "trade": "plumber",
                "title": "Tap repair",
                "price_type": "fixed",
                "price": "500",
                "estimated_minutes": 60,
            }
        ]
    }
    assert post("services", svc).status_code == 200
    assert post("services", svc).status_code == 200  # idempotent
    assert post("headline", {"headline": "Plumber, Kathmandu & Lalitpur"}).status_code == 200
    assert post("payment", {"payment_method": "esewa", "wallet_id": "9811111111"}).status_code == 200
    r = c.post(
        "/api/v1/me/sipalu/onboarding-step",
        {"step": "identity", "citizenship_no": "27-01-74-01234", "id_front": jpeg("id.jpg")},
        format="multipart",
    )
    assert r.status_code == 200, r.content
    r = post("consent", {"data_processing": True, "public_profile": True})
    body = r.json()
    assert body["next_step"] is None
    comp = body["completeness"]
    assert comp["missing"] == ["verified"]  # only ops verification left
    assert comp["percent"] == 92
    assert {i["key"]: i["optional"] for i in comp["items"]}["portfolio"] is True
    profile = SipaluProfile.objects.get(worker__user=user)
    assert profile.services.count() == 1
    assert str(profile.base_lat) == "27.71"  # coarse, 2 decimals
    assert profile.years_total == 7
    w = profile.worker
    assert w.verification_status == "pending" and w.citizenship_no == "27-01-74-01234"


def test_onboarding_rejects_bad_step_and_bad_data():
    c = auth_client(f.UserFactory())
    assert c.post("/api/v1/me/sipalu/onboarding-step", {"step": "nope"}, format="json").status_code == 400
    r = c.post(
        "/api/v1/me/sipalu/onboarding-step",
        {"step": "payment", "data": {"payment_method": "bank"}},
        format="json",
    )
    assert r.status_code == 400 and "bank_account_no" in r.json()["error"]["fields"]


# --------------------------------------------------------------------------- handle rules
def test_handle_rules():
    flag_on()
    make_sipalu("taken-one")
    user = f.UserFactory(full_name="Gita K")
    c = auth_client(user)
    c.get("/api/v1/me/sipalu")
    for bad in ("ab", "Has_Caps", "-lead", "trail-", "a--b", "x" * 31):
        r = c.post("/api/v1/me/sipalu/handle", {"handle": bad}, format="json")
        assert r.status_code == 400, bad
    r = c.post("/api/v1/me/sipalu/handle", {"handle": "admin"}, format="json")
    assert r.status_code == 400 and r.json()["error"]["fields"]["handle"]
    r = c.post("/api/v1/me/sipalu/handle", {"handle": "taken-one"}, format="json")
    assert r.status_code == 400 and r.json()["error"]["code"] == "duplicate"
    r = c.post("/api/v1/me/sipalu/handle", {"handle": "gita-cleans"}, format="json")
    assert r.status_code == 200 and r.json()["handle"] == "gita-cleans"
    # only once per 30 days
    r = c.post("/api/v1/me/sipalu/handle", {"handle": "gita-cleans-2"}, format="json")
    assert r.status_code == 400 and r.json()["error"]["code"] == "invalid_state"
    SipaluProfile.objects.filter(handle="gita-cleans").update(
        handle_changed_at=timezone.now() - dt.timedelta(days=31)
    )
    assert c.post("/api/v1/me/sipalu/handle", {"handle": "gita-cleans-2"}, format="json").status_code == 200


def test_auto_handle_is_unique():
    a = auth_client(f.UserFactory(full_name="Ram Thapa")).get("/api/v1/me/sipalu").json()["handle"]
    b = auth_client(f.UserFactory(full_name="Ram Thapa")).get("/api/v1/me/sipalu").json()["handle"]
    assert a == "ram-thapa" and b == "ram-thapa-2"


# --------------------------------------------------------------------------- prices
def test_min_hourly_rate_enforced():
    c = auth_client(f.UserFactory(full_name="Hourly Person"))
    c.get("/api/v1/me/sipalu")
    base = {"trade": "cleaner", "title": "House cleaning"}
    r = c.post("/api/v1/me/sipalu/services", {**base, "price_type": "hourly", "price": "100"}, format="json")
    assert r.status_code == 400 and r.json()["error"]["code"] == "below_minimum_wage"
    assert "107" in r.json()["error"]["message"]
    r = c.post("/api/v1/me/sipalu/services", {**base, "price_type": "hourly", "price": "107"}, format="json")
    assert r.status_code == 201
    # fixed price must cover the minimum for its estimated time (3 h × 107 = 321)
    r = c.post(
        "/api/v1/me/sipalu/services",
        {**base, "price_type": "fixed", "price": "300", "estimated_minutes": 180},
        format="json",
    )
    assert r.status_code == 400 and r.json()["error"]["code"] == "below_minimum_wage"
    r = c.post(
        "/api/v1/me/sipalu/services", {**base, "price_type": "visit_then_quote", "price": "0"}, format="json"
    )
    assert r.status_code == 400 and "visit_fee" in r.json()["error"]["fields"]
    sid = c.get("/api/v1/me/sipalu/services").json()[0]["id"]
    r = c.patch(f"/api/v1/me/sipalu/services/{sid}", {"price": "90"}, format="json")
    assert r.status_code == 400 and r.json()["error"]["code"] == "below_minimum_wage"


# --------------------------------------------------------------------------- availability
def test_availability_bulk_put_and_overlap():
    c = auth_client(f.UserFactory(full_name="Avail Person"))
    rules = [
        {"weekday": 0, "start_time": "09:00", "end_time": "12:00"},
        {"weekday": 0, "start_time": "13:00", "end_time": "18:00"},
    ]
    r = c.put("/api/v1/me/sipalu/availability", {"rules": rules}, format="json")
    assert r.status_code == 200 and len(r.json()["rules"]) == 2
    bad = [
        {"weekday": 0, "start_time": "09:00", "end_time": "12:00"},
        {"weekday": 0, "start_time": "11:00", "end_time": "14:00"},
    ]
    assert c.put("/api/v1/me/sipalu/availability", {"rules": bad}, format="json").status_code == 400
    assert (
        c.put(
            "/api/v1/me/sipalu/availability",
            {"rules": [{"weekday": 7, "start_time": "09:00", "end_time": "10:00"}]},
            format="json",
        ).status_code
        == 400
    )
    assert len(c.get("/api/v1/me/sipalu/availability").json()["rules"]) == 2


def test_time_off_blocks_booking_and_outside_hours_rejected():
    flag_on()
    profile, service, sc = make_sipalu(rules=[(d, dt.time(9, 0), dt.time(17, 0)) for d in range(7)])
    _u, addr, gc = make_ghardhani()
    start = tomorrow_at(10)
    r = sc.post(
        "/api/v1/me/sipalu/time-off",
        {"from_date": start.date().isoformat(), "to_date": start.date().isoformat()},
        format="json",
    )
    assert r.status_code == 201
    r = book(gc, profile, addr, service, start)
    assert r.status_code == 400 and r.json()["error"]["code"] == "invalid_state"
    TimeOff.objects.all().delete()
    r = book(gc, profile, addr, service, tomorrow_at(19))  # outside 09–17
    assert r.status_code == 400
    r = book(gc, profile, addr, service, timezone.now() + dt.timedelta(minutes=30))  # lead time
    assert r.status_code == 400


# --------------------------------------------------------------------------- portfolio
def test_portfolio_upload_and_limit():
    profile, _s, sc = make_sipalu()
    r = sc.post("/api/v1/me/sipalu/portfolio", {"image": jpeg(), "caption": "Wiring"}, format="multipart")
    assert r.status_code == 201 and r.json()["thumb_url"]
    r = sc.post("/api/v1/me/sipalu/portfolio", {"caption": "no file"}, format="multipart")
    assert r.status_code == 400
    from apps.bolau.models import PortfolioItem

    item = PortfolioItem.objects.first()
    for _ in range(11):
        PortfolioItem.objects.create(profile=profile, image=item.image.name)
    r = sc.post("/api/v1/me/sipalu/portfolio", {"image": jpeg()}, format="multipart")
    assert r.status_code == 400 and r.json()["error"]["code"] == "invalid_state"


# --------------------------------------------------------------------------- public profile
def test_public_profile_masks_contact_and_respects_consent(api):
    flag_on()
    profile, _s, _c = make_sipalu("public-ram")
    res = api.get("/api/v1/public/sipalu/public-ram")
    assert res.status_code == 200, res.content
    body = res.json()
    raw = res.content.decode()
    assert profile.worker.phone not in raw
    for key in ("phone", "address", "citizenship_no", "base_lat"):
        assert key not in body
    assert body["services"][0]["price"] == "600.00"
    assert body["trades"][0]["code"] == "electrician"
    assert res["X-Robots-Tag"] == "noindex, nofollow"
    SipaluProfile.objects.filter(pk=profile.pk).update(public_indexable=True)
    assert api.get("/api/v1/public/sipalu/public-ram")["X-Robots-Tag"] == "index, follow"
    # no public consent → 404; unverified → 404; flag off → 404
    SipaluProfile.objects.filter(pk=profile.pk).update(public_consent_at=None)
    assert api.get("/api/v1/public/sipalu/public-ram").status_code == 404
    SipaluProfile.objects.filter(pk=profile.pk).update(public_consent_at=timezone.now())
    Worker.objects.filter(pk=profile.worker_id).update(verification_status="pending")
    assert api.get("/api/v1/public/sipalu/public-ram").status_code == 404
    Worker.objects.filter(pk=profile.worker_id).update(verification_status="verified")
    flag_off()
    assert api.get("/api/v1/public/sipalu/public-ram").status_code == 404


def test_suspended_sipalu_cannot_reenable():
    profile, _s, sc = make_sipalu()
    SipaluProfile.objects.filter(pk=profile.pk).update(suspended_at=timezone.now(), bolau_enabled=False)
    r = sc.patch("/api/v1/me/sipalu", {"bolau_enabled": True}, format="json")
    assert r.status_code == 400 and r.json()["error"]["code"] == "invalid_state"


def test_ghardhani_profile_addresses_and_favourites():
    flag_on()
    make_sipalu("fav-sipalu")
    user, addr, c = make_ghardhani()
    assert c.get("/api/v1/me/ghardhani").status_code == 200
    r = c.post(
        "/api/v1/me/addresses",
        {
            "line": "Flat 3",
            "municipality": "Lalitpur Metropolitan City",
            "district": "lalitpur",
            "ward": 2,
            "is_default": True,
        },
        format="json",
    )
    assert r.status_code == 201 and r.json()["is_default"] is True
    addr.refresh_from_db()
    assert addr.is_default is False
    assert len(c.get("/api/v1/me/addresses").json()) == 2
    # another user cannot read my address
    other = auth_client(f.UserFactory())
    assert other.get(f"/api/v1/me/addresses/{addr.id}").status_code == 404
    assert c.post("/api/v1/me/favourites", {"handle": "fav-sipalu"}, format="json").status_code == 201
    assert [x["handle"] for x in c.get("/api/v1/me/favourites").json()] == ["fav-sipalu"]
    assert c.delete("/api/v1/me/favourites/fav-sipalu").status_code == 204
    # line is encrypted at rest
    from django.db import connection

    with connection.cursor() as cur:
        cur.execute("SELECT line FROM bolau_address WHERE id = %s", [str(addr.id)])
        assert cur.fetchone()[0].startswith("enc1:")


def test_nepali_messages():
    c = auth_client(f.UserFactory(full_name="Ne Person"))
    c.get("/api/v1/me/sipalu")
    r = c.post(
        "/api/v1/me/sipalu/services",
        {"trade": "cleaner", "title": "x", "price_type": "hourly", "price": "50"},
        format="json",
        HTTP_ACCEPT_LANGUAGE="ne",
    )
    assert "न्यूनतम पारिश्रमिक" in r.json()["error"]["message"] and "107" in r.json()["error"]["message"]
    me = c.get("/api/v1/me/sipalu", HTTP_ACCEPT_LANGUAGE="ne").json()
    labels_ne = {i["key"]: i["label"] for i in me["completeness"]["items"]}
    assert labels_ne["headline"] == "छोटो परिचय लेख्नुहोस्"
