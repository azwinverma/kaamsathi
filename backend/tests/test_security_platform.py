"""Security §1: request ids, error envelope, idempotency, metrics, failed tasks, system health, audit."""

from __future__ import annotations

import datetime as dt
import logging

import pytest
from celery import shared_task
from django.db import connection, transaction
from django.db.utils import DatabaseError
from django.test import override_settings
from rest_framework.test import APIClient

from apps.audit.models import AuditLog
from apps.audit.services import verify_chain
from apps.core import metrics
from apps.core.models import FailedTask, IdempotencyRecord
from apps.core.request_id import RequestIDFilter
from apps.core.tasks import redact
from apps.privacy.models import PrivacyRequest
from tests import factories as f
from tests.conftest import auth_client


# --- request ids ------------------------------------------------------------------------------
@pytest.mark.django_db
def test_request_id_echoed_and_in_error_envelope():
    api = APIClient()
    res = api.get("/api/v1/health", HTTP_X_REQUEST_ID="abc-123.XYZ_9")
    assert res["X-Request-ID"] == "abc-123.XYZ_9"
    err = api.get("/api/v1/auth/me", HTTP_X_REQUEST_ID="trace-me-1")
    assert err.status_code == 401
    assert err.json()["error"]["request_id"] == "trace-me-1" == err["X-Request-ID"]


@pytest.mark.django_db
def test_unsafe_or_missing_request_id_is_replaced():
    api = APIClient()
    generated = api.get("/api/v1/health")["X-Request-ID"]
    assert len(generated) == 32
    bad = api.get("/api/v1/health", HTTP_X_REQUEST_ID='evil"<script>' + "x" * 80)["X-Request-ID"]
    assert "<" not in bad and len(bad) == 32
    nf = api.get("/api/v1/does-not-exist", HTTP_X_REQUEST_ID="nf-1")
    assert nf.status_code == 404 and nf.json()["error"]["request_id"] == "nf-1"


def test_log_records_get_request_id():
    from apps.core.request_id import set_request_id

    token = set_request_id("log-rid")
    try:
        record = logging.LogRecord("x", logging.INFO, __file__, 1, "msg", None, None)
        RequestIDFilter().filter(record)
        assert record.request_id == "log-rid"
        from apps.core.logging import JsonFormatter

        assert '"request_id": "log-rid"' in JsonFormatter().format(record)
    finally:
        from apps.core.request_id import _current

        _current.reset(token)


# --- idempotency ------------------------------------------------------------------------------
@pytest.mark.django_db
def test_idempotent_replay_and_conflict():
    worker = f.WorkerFactory(phone="9841000099")
    user = f.UserFactory(phone="9841000099")
    worker.user = user
    worker.save()
    client = auth_client(user)
    url = "/api/v1/me/privacy-requests"
    first = client.post(url, {"kind": "export"}, format="json", HTTP_IDEMPOTENCY_KEY="k-1")
    assert first.status_code in (200, 201), first.content
    replay = client.post(url, {"kind": "export"}, format="json", HTTP_IDEMPOTENCY_KEY="k-1")
    assert replay.status_code == first.status_code
    assert replay["Idempotent-Replayed"] == "true"
    assert replay.json() == first.json()
    assert PrivacyRequest.objects.filter(user=user).count() == 1
    conflict = client.post(url, {"kind": "deletion"}, format="json", HTTP_IDEMPOTENCY_KEY="k-1")
    assert conflict.status_code == 409 and conflict.json()["error"]["code"] == "idempotency_conflict"
    too_long = client.post(url, {"kind": "export"}, format="json", HTTP_IDEMPOTENCY_KEY="x" * 101)
    assert too_long.status_code == 400
    # keys are per user
    other = auth_client(f.UserFactory())
    assert other.post(url, {"kind": "export"}, format="json", HTTP_IDEMPOTENCY_KEY="k-1").status_code != 409


@pytest.mark.django_db
def test_idempotency_failed_request_not_stored_and_expired_records_purged():
    from apps.core.idempotency import purge_expired

    user = f.UserFactory()
    client = auth_client(user)
    bad = client.post(
        "/api/v1/me/privacy-requests", {"kind": "nope"}, format="json", HTTP_IDEMPOTENCY_KEY="k-2"
    )
    assert bad.status_code == 400
    assert not IdempotencyRecord.objects.filter(key="k-2").exists()
    rec = IdempotencyRecord.objects.create(
        principal="user:x",
        method="POST",
        path="/x",
        key="old",
        body_hash="h",
        status_code=200,
        response_body={},
    )
    IdempotencyRecord.objects.filter(pk=rec.pk).update(created_at=rec.created_at - dt.timedelta(hours=25))
    assert purge_expired() == 1


@pytest.mark.django_db
def test_shortlist_is_idempotent(staff_client):
    org = f.OrganizationFactory()
    org.verification_status = "verified"  # KYB gate (trust-ops) if present
    org.save()
    job = f.JobFactory(organization=org)
    worker = f.WorkerFactory()
    url = f"/api/v1/ops/jobs/{job.id}/shortlist"
    a = staff_client.post(url, {"worker_ids": [str(worker.id)]}, format="json", HTTP_IDEMPOTENCY_KEY="s-1")
    b = staff_client.post(url, {"worker_ids": [str(worker.id)]}, format="json", HTTP_IDEMPOTENCY_KEY="s-1")
    assert a.status_code == b.status_code
    assert a.status_code < 300, a.content
    assert b["Idempotent-Replayed"] == "true" and b.json() == a.json()


# --- metrics ----------------------------------------------------------------------------------
@pytest.mark.django_db
def test_metrics_auth_and_content():
    metrics.reset()
    api = APIClient()
    assert api.get("/api/v1/metrics").status_code == 404  # METRICS_TOKEN unset
    with override_settings(METRICS_TOKEN="s3cret"):
        api.get("/api/v1/health")
        api.get("/api/v1/ref/trades")
        api.get("/api/v1/files/" + "a" * 60)
        assert api.get("/api/v1/metrics").status_code == 401
        assert api.get("/api/v1/metrics", HTTP_AUTHORIZATION="Bearer wrong").status_code == 401
        res = api.get("/api/v1/metrics", HTTP_AUTHORIZATION="Bearer s3cret")
        assert res.status_code == 200 and res["Content-Type"].startswith("text/plain")
        text = res.content.decode()
    assert 'http_requests_total{group="health",method="GET",status_class="2xx"} 1' in text
    assert 'group="ref/trades"' in text
    assert 'group="files/:id"' in text  # tokens collapsed
    assert "http_request_duration_seconds_bucket{" in text and 'le="+Inf"' in text
    assert "http_request_duration_seconds_count{" in text
    assert "# TYPE celery_tasks_total counter" in text


@pytest.mark.django_db
def test_otp_and_sms_metrics():
    metrics.reset()
    api = APIClient()
    with override_settings(DEBUG=True, OTP_DEV_CODE="123456"):
        api.post("/api/v1/auth/otp/request", {"phone": "9841000077"}, format="json")
        api.post("/api/v1/auth/otp/verify", {"phone": "9841000077", "code": "123456"}, format="json")
    from apps.notifications.models import SMSMessage

    msg = SMSMessage.objects.create(phone="9841000077", body="x", backend="console")
    msg.status = "failed"
    msg.save(update_fields=["status"])
    text = metrics.render()
    assert 'otp_requests_total{result="verified"} 1' in text
    assert 'sms_messages_total{backend="console",status="failed"} 1' in text


# --- failed tasks + system --------------------------------------------------------------------
@shared_task(name="tests.flaky_task")
def flaky_task(worker_id, phone=None):
    raise RuntimeError("boom")


@shared_task(name="tests.ok_task")
def ok_task(n):
    return n


def test_redaction_keeps_ids_only():
    out = redact(["4b1f3c6e-0000-4000-8000-000000000000", "9841234567", 5, "payslip_ready"], {"phone": "98"})
    assert out["args"] == ["4b1f3c6e-0000-4000-8000-000000000000", "[redacted]", 5, "payslip_ready"]
    assert out["kwargs"] == {"phone": "[redacted]"} and out["redacted"] is True


@pytest.mark.django_db
def test_failed_task_captured_and_ops_retry_dismiss():
    with pytest.raises(RuntimeError):
        flaky_task.delay("4b1f3c6e-0000-4000-8000-000000000000")
    failed = FailedTask.objects.get(task_name="tests.flaky_task")
    assert "RuntimeError: boom" in failed.exception and "Traceback" in failed.traceback
    assert failed.args_redacted["args"] == ["4b1f3c6e-0000-4000-8000-000000000000"]
    staff = auth_client(f.UserFactory(is_staff=True))
    listing = staff.get("/api/v1/ops/system/failed-tasks").json()
    assert listing["count"] == 1 and listing["results"][0]["task_name"] == "tests.flaky_task"
    # retry re-runs it (eager in tests; fails again → captured again, stays visible)
    staff.post(f"/api/v1/ops/system/failed-tasks/{failed.id}/retry")
    failed.refresh_from_db()
    assert failed.retried_at is not None
    res = staff.post(f"/api/v1/ops/system/failed-tasks/{failed.id}/dismiss")
    assert res.status_code == 200 and res.json()["dismissed_at"]
    assert staff.get("/api/v1/ops/system/failed-tasks", {"status": "dismissed"}).json()["count"] == 1
    assert AuditLog.objects.filter(action="system.failed_task.dismiss").exists()


@pytest.mark.django_db
def test_redacted_failed_task_cannot_be_retried():
    with pytest.raises(RuntimeError):
        flaky_task.delay("4b1f3c6e-0000-4000-8000-000000000000", phone="9841234567")
    failed = FailedTask.objects.get(task_name="tests.flaky_task")
    staff = auth_client(f.UserFactory(is_staff=True))
    res = staff.post(f"/api/v1/ops/system/failed-tasks/{failed.id}/retry")
    assert res.status_code == 400 and res.json()["error"]["code"] == "invalid_state"


@pytest.mark.django_db
def test_system_health_and_heartbeat():
    from apps.core.tasks import beat_heartbeat

    metrics.reset()
    staff = auth_client(f.UserFactory(is_staff=True))
    body = staff.get("/api/v1/ops/system/health").json()
    assert body["db"] == "ok" and body["redis"] == "ok"
    assert body["beat"]["stale"] is True
    assert set(body) >= {"celery", "failed_tasks_24h", "sms_failed_24h", "version"}
    assert ok_task.delay(3).get() == 3
    beat_heartbeat.delay()
    body = staff.get("/api/v1/ops/system/health").json()
    assert body["beat"]["stale"] is False and body["beat"]["last_heartbeat"]
    assert 'celery_tasks_total{state="success",task="tests.ok_task"} 1' in metrics.render()


def test_reliable_task_is_default_base():
    from apps.core.tasks import ReliableTask

    assert isinstance(ok_task, ReliableTask)
    assert ok_task.acks_late is True and ok_task.max_retries == 5


# --- audit ------------------------------------------------------------------------------------
def _write_logs(n=3):
    return [
        AuditLog.objects.create(action=f"test.a{i}", object_type="x", object_id=str(i), changes={"i": i})
        for i in range(n)
    ]


@pytest.mark.django_db
def test_audit_chain_links_and_verifies():
    rows = _write_logs(3)
    assert rows[1].prev_hash == rows[0].hash and rows[2].prev_hash == rows[1].hash
    assert rows[2].seq == rows[1].seq + 1
    result = verify_chain()
    assert result["ok"] is True and result["first_broken_id"] is None and result["checked"] >= 3


@pytest.mark.django_db
def test_audit_update_and_delete_blocked_at_db():
    row = _write_logs(1)[0]
    with pytest.raises(DatabaseError, match="append-only"), transaction.atomic():
        AuditLog.objects.filter(pk=row.pk).update(action="tampered")
    with pytest.raises(DatabaseError, match="append-only"), transaction.atomic():
        AuditLog.objects.filter(pk=row.pk).delete()
    with pytest.raises(DatabaseError), transaction.atomic(), connection.cursor() as cur:
        cur.execute("DELETE FROM audit_auditlog")
    with pytest.raises(RuntimeError):
        row.save()


def _bypass(sql, params):
    with connection.cursor() as cur:
        cur.execute("ALTER TABLE audit_auditlog DISABLE TRIGGER audit_auditlog_no_update_delete")
        cur.execute(sql, params)
        cur.execute("ALTER TABLE audit_auditlog ENABLE TRIGGER audit_auditlog_no_update_delete")


@pytest.mark.django_db
def test_audit_verify_detects_tamper_and_deletion():
    rows = _write_logs(4)
    _bypass("UPDATE audit_auditlog SET changes = %s WHERE id = %s", ['{"i": 99}', rows[1].pk])
    result = verify_chain()
    assert result["ok"] is False and result["first_broken_id"] == str(rows[1].pk)


@pytest.mark.django_db
def test_audit_verify_detects_deleted_row():
    rows = _write_logs(4)
    _bypass("DELETE FROM audit_auditlog WHERE id = %s", [rows[2].pk])
    result = verify_chain()
    assert result["ok"] is False and result["first_broken_id"] == str(rows[3].pk)


@pytest.mark.django_db
def test_audit_survives_user_deletion():
    user = f.UserFactory()
    AuditLog.objects.create(actor=user, action="test.user", object_type="user", object_id=str(user.pk))
    user.delete()  # no FK cascade → no UPDATE on audit rows
    assert verify_chain()["ok"] is True


@pytest.mark.django_db
def test_ops_audit_list_filters_and_verify_endpoint():
    staff_user = f.UserFactory(is_staff=True)
    staff = auth_client(staff_user)
    org = f.OrganizationFactory()
    AuditLog.objects.create(
        actor=staff_user, organization=org, action="payroll.approve", object_type="payrollrun"
    )
    AuditLog.objects.create(action="other.thing", object_type="x")
    res = staff.get("/api/v1/ops/audit", {"action": "payroll", "organization": str(org.id)}).json()
    assert res["count"] == 1
    row = res["results"][0]
    assert row["actor"]["phone"] == staff_user.phone and row["organization"]["name"] == org.name
    assert row["hash"] and row["seq"]
    today = dt.date.today().isoformat()
    assert staff.get("/api/v1/ops/audit", {"actor": staff_user.phone, "from": today}).json()["count"] >= 1
    assert staff.get("/api/v1/ops/audit", {"from": "nope"}).status_code == 400
    assert staff.get("/api/v1/ops/audit/verify").json()["ok"] is True


@pytest.mark.django_db
def test_maintenance_mode_read_only_and_full():
    from django.core.management import call_command

    user = f.UserFactory()
    client = auth_client(user)
    try:
        call_command("maintenance", "read_only")
        assert client.get("/api/v1/auth/me").status_code == 200
        assert (
            client.patch("/api/v1/auth/me", {"full_name": "X"}, format="json").status_code == 200
        )  # login/auth open
        res = client.post("/api/v1/me/privacy-requests", {"kind": "export"}, format="json")
        assert res.status_code == 503 and res.json()["error"]["code"] == "maintenance"
        call_command("maintenance", "full")
        assert client.get("/api/v1/auth/me").status_code == 503
        assert APIClient().get("/api/v1/health").status_code == 200
        assert AuditLog.objects.filter(action="system.maintenance").count() == 2
    finally:
        call_command("maintenance", "off")
    assert client.get("/api/v1/auth/me").status_code == 200
