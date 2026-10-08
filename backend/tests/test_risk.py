"""Risk flags and detectors — docs/CONTRACT-EXTENSIONS.md §2."""

import datetime as dt
from decimal import Decimal as D

import pytest
from django.core.files.base import ContentFile
from django.utils import timezone

from apps.audit.models import AuditLog
from apps.risk import detectors
from apps.risk.models import FraudFlag
from apps.risk.services import flag
from apps.risk.tasks import scan
from tests import factories as f

pytestmark = pytest.mark.django_db


def flags(**kw):
    return FraudFlag.objects.filter(**kw)


# --------------------------------------------------------------------------- service
def test_flag_is_idempotent_per_open_subject_kind():
    w = f.WorkerFactory()
    flag(w, "velocity", "low", {"reasons": ["onboarded_by_many"], "organizations": ["A"]})
    flag(w, "velocity", "medium", {"organizations": ["B"]})
    flag(w, "velocity", "low")
    assert flags(subject_id=str(w.pk), kind="velocity").count() == 1
    fl = flags(subject_id=str(w.pk)).get()
    assert fl.severity == "medium"  # raised, never lowered
    assert fl.details["organizations"] == ["A", "B"]

    fl.status = "dismissed"
    fl.save()
    flag(w, "velocity", "low")  # a resolved flag does not block a new one
    assert flags(subject_id=str(w.pk), kind="velocity").count() == 2


def test_flag_accepts_tuple_subject_and_rejects_unknown_kind():
    flag(("organization", "abc"), "manual", "low")
    assert flags(subject_type="organization", subject_id="abc").exists()
    with pytest.raises(ValueError):
        flag(("worker", "x"), "nonsense", "low")


# --------------------------------------------------------------------------- detectors
def test_duplicate_identity_on_save_flags_both_workers():
    a = f.WorkerFactory(citizenship_no="27-01-74-05512")
    assert not flags(kind="duplicate_identity").exists()
    b = f.WorkerFactory(citizenship_no="27 01 74 05512")  # same number, different formatting
    assert set(flags(kind="duplicate_identity").values_list("subject_id", flat=True)) == {
        str(a.pk),
        str(b.pk),
    }
    fa = flags(kind="duplicate_identity", subject_id=str(a.pk)).get()
    assert fa.severity == "high"
    assert fa.details["matches"][0]["worker_id"] == str(b.pk)
    assert "27017405512" not in str(fa.details).replace("-", "").replace(" ", "")  # no plaintext id
    # saving again does not duplicate
    b.full_name = "Renamed"
    b.save()
    b.save(update_fields=["citizenship_no"])
    assert flags(kind="duplicate_identity").count() == 2


def test_duplicate_nid_detected_on_update():
    a = f.WorkerFactory(nid_no="123-456-789")
    b = f.WorkerFactory()
    b.nid_no = "123456789"
    b.save(update_fields=["nid_no"])
    fl = flags(kind="duplicate_identity", subject_id=str(a.pk)).get()
    assert fl.details["reasons"] == ["same_nid"]


def test_shared_bank_account_nightly():
    a = f.WorkerFactory(bank_account_no="0010-2233-4455")
    b = f.WorkerFactory(bank_account_no="001022334455")
    f.WorkerFactory(bank_account_no="999")
    assert detectors.shared_bank_accounts() == 2
    assert set(flags(kind="shared_bank_account").values_list("subject_id", flat=True)) == {
        str(a.pk),
        str(b.pk),
    }


def test_document_reuse_across_workers():
    a = f.WorkerFactory()
    b = f.WorkerFactory()
    c = f.WorkerFactory()
    a.id_front.save("a.jpg", ContentFile(b"same-image-bytes"), save=True)
    b.photo.save("b.jpg", ContentFile(b"same-image-bytes"), save=True)
    c.id_front.save("c.jpg", ContentFile(b"other"), save=True)
    assert detectors.document_reuse() == 2
    fl = flags(kind="document_reuse", subject_id=str(b.pk)).get()
    assert fl.details["documents"] == ["photo"]
    assert not flags(kind="document_reuse", subject_id=str(c.pk)).exists()


def _site(org):
    return f.SiteFactory(organization=org, lat=D("27.700000"), lng=D("85.300000"), geofence_radius_m=200)


def test_outside_geofence_three_times_in_a_week():
    org = f.OrganizationFactory()
    emp = f.EmploymentFactory(organization=org, site=_site(org))
    now = timezone.now()
    for i in range(3):
        f.AttendanceFactory(
            employment=emp,
            date=(now - dt.timedelta(days=i + 1)).date(),
            check_in_at=now - dt.timedelta(days=i + 1),
            check_in_lat=D("27.710000"),  # ~1.1 km away
            check_in_lng=D("85.300000"),
        )
    detectors.attendance_anomalies(now=now)
    fl = flags(kind="geo_anomaly", subject_type="employment").get()
    assert fl.subject_id == str(emp.pk)
    assert len(fl.details["events"]) == 3


def test_two_outside_checkins_do_not_flag():
    org = f.OrganizationFactory()
    emp = f.EmploymentFactory(organization=org, site=_site(org))
    now = timezone.now()
    for i in range(2):
        f.AttendanceFactory(
            employment=emp,
            date=(now - dt.timedelta(days=i + 1)).date(),
            check_in_at=now - dt.timedelta(days=i + 1),
            check_in_lat=D("27.710000"),
            check_in_lng=D("85.300000"),
        )
    detectors.attendance_anomalies(now=now)
    assert not flags(kind="geo_anomaly").exists()


def test_buddy_punching_identical_coordinates_within_a_minute():
    org = f.OrganizationFactory()
    site = _site(org)
    e1 = f.EmploymentFactory(organization=org, site=site)
    e2 = f.EmploymentFactory(organization=org, site=site)
    e3 = f.EmploymentFactory(organization=org, site=site)
    t = timezone.now() - dt.timedelta(hours=3)
    coords = {"check_in_lat": D("27.700100"), "check_in_lng": D("85.300100")}
    a1 = f.AttendanceFactory(employment=e1, date=t.date(), check_in_at=t, **coords)
    a2 = f.AttendanceFactory(employment=e2, date=t.date(), check_in_at=t + dt.timedelta(seconds=40), **coords)
    # same spot but 5 minutes later: not a buddy punch
    f.AttendanceFactory(employment=e3, date=t.date(), check_in_at=t + dt.timedelta(minutes=5), **coords)
    detectors.attendance_anomalies()
    subjects = set(flags(kind="attendance_anomaly").values_list("subject_id", flat=True))
    assert subjects == {str(a1.pk), str(a2.pk)}
    fl = flags(subject_id=str(a1.pk)).get()
    assert fl.severity == "high" and fl.details["reasons"] == ["buddy_punching"]


def test_checkout_before_checkin():
    t = timezone.now() - dt.timedelta(hours=5)
    a = f.AttendanceFactory(date=t.date(), check_in_at=t, check_out_at=t - dt.timedelta(hours=1))
    detectors.attendance_anomalies()
    fl = flags(kind="attendance_anomaly", subject_id=str(a.pk)).get()
    assert fl.details["reasons"] == ["checkout_before_checkin"]


def test_velocity_three_orgs_in_a_week():
    w = f.WorkerFactory()
    lone = f.WorkerFactory()
    for _ in range(3):
        f.EmploymentFactory(worker=w)
    f.EmploymentFactory(worker=lone)
    assert detectors.onboarding_velocity() == 1
    fl = flags(kind="velocity").get()
    assert fl.subject_id == str(w.pk) and len(fl.details["organizations"]) == 3


def test_scan_task_runs_all_detectors_idempotently():
    f.WorkerFactory(bank_account_no="12345")
    f.WorkerFactory(bank_account_no="12345")
    first = scan()
    assert set(first) == {"shared_bank_account", "document_reuse", "attendance", "velocity"}
    scan()
    assert flags(kind="shared_bank_account").count() == 2


# --------------------------------------------------------------------------- endpoints
def test_flags_endpoints_require_staff(owner_client):
    assert owner_client.get("/api/v1/ops/risk/flags").status_code == 403
    assert owner_client.get("/api/v1/ops/risk/summary").status_code == 403


def test_list_filter_and_resolve(staff_client):
    w = f.WorkerFactory(full_name="Sita Tamang")
    flag(w, "velocity", "medium", {"reasons": ["onboarded_by_many"]})
    flag(f.WorkerFactory(), "shared_bank_account", "high")
    res = staff_client.get("/api/v1/ops/risk/flags", {"kind": "velocity", "status": "open"})
    assert res.status_code == 200
    rows = res.json()["results"]
    assert len(rows) == 1
    row = rows[0]
    assert row["subject"]["label"] == "Sita Tamang"
    assert row["subject"]["link"] == f"/ops/workers/{w.pk}"
    assert row["kind_label"] and row["reasons"]
    assert staff_client.get("/api/v1/ops/risk/flags", {"severity": "high"}).json()["count"] == 1

    url = f"/api/v1/ops/risk/flags/{row['id']}/resolve"
    assert staff_client.post(url, {"status": "open", "note": "x"}, format="json").status_code == 400
    res = staff_client.post(url, {"status": "dismissed", "note": "Brothers, checked by phone"}, format="json")
    assert res.status_code == 200
    assert res.json()["status"] == "dismissed" and res.json()["resolved_by"] is not None
    assert staff_client.post(url, {"status": "confirmed", "note": "x"}, format="json").status_code == 400
    assert AuditLog.objects.filter(action="ops.risk_flag.resolve").exists()


def test_manual_flag(staff_client):
    org = f.OrganizationFactory()
    res = staff_client.post(
        "/api/v1/ops/risk/flags",
        {"subject_type": "organization", "subject_id": str(org.pk), "severity": "high", "note": "Fake PAN?"},
        format="json",
    )
    assert res.status_code == 201, res.content
    assert res.json()["kind"] == "manual" and res.json()["created_by"] is not None
    assert res.json()["subject"]["label"] == org.name
    missing = staff_client.post(
        "/api/v1/ops/risk/flags",
        {"subject_type": "worker", "subject_id": "00000000-0000-0000-0000-000000000000", "note": "x"},
        format="json",
    )
    assert missing.status_code == 400


def test_summary(staff_client):
    w = f.WorkerFactory()
    flag(w, "velocity", "high")
    flag(w, "document_reuse", "medium")
    FraudFlag.objects.filter(kind="document_reuse").update(status="confirmed", resolved_at=timezone.now())
    data = staff_client.get("/api/v1/ops/risk/summary").json()
    assert data["open"] == 1 and data["open_high"] == 1
    assert {r["key"]: r["count"] for r in data["by_kind"]}["velocity"] == 1
    assert len(data["trend"]) == 30
    assert data["trend"][-1]["created"] == 2 and data["trend"][-1]["resolved"] == 1
    assert data["confirmed_30d"] == 1


def test_ops_worker_detail_shows_open_risk_flags(staff_client):
    w = f.WorkerFactory()
    flag(w, "velocity", "low")
    flag(w, "shared_bank_account", "low")
    assert staff_client.get(f"/api/v1/ops/workers/{w.pk}").json()["open_risk_flags"] == 2
