"""Enterprise API keys, /enterprise/* endpoints and signed webhooks (CONTRACT-EXTENSIONS §4)."""

import datetime as dt
import hashlib
import hmac
import json
import uuid
from unittest import mock

import pytest
import requests
from django.utils import timezone
from rest_framework.test import APIClient

from apps.audit.models import AuditLog
from apps.integrations import services
from apps.integrations.models import OrgAPIKey, WebhookDelivery, WebhookEndpoint
from apps.payroll.models import PayrollRun
from apps.timesheets import services as ts_services
from apps.timesheets.models import Timesheet
from apps.workforce import services as wf_services
from tests import factories as f

pytestmark = pytest.mark.django_db

ALL_SCOPES = [
    "jobs.read",
    "jobs.write",
    "workforce.read",
    "attendance.read",
    "attendance.write",
    "payroll.read",
    "timesheets.read",
]


def key_client(full_key):
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION=f"Org {full_key}")
    return c


@pytest.fixture
def org_key(org, owner):
    _, full = services.create_api_key(org, "ERP", ALL_SCOPES, user=owner)
    return full


class FakeResponse:
    def __init__(self, status=200, text="ok"):
        self.status_code = status
        self.text = text


# --------------------------------------------------------------------------- keys
def test_create_key_once_hash_only_and_audited(owner_client, org):
    res = owner_client.post("/api/v1/org/api-keys", {"name": "SAP", "scopes": ["jobs.read"]}, format="json")
    assert res.status_code == 201, res.json()
    body = res.json()
    full = body["key"]
    assert full.startswith(f"ks_org_{body['prefix']}_")
    key = OrgAPIKey.objects.get(pk=body["id"])
    assert key.key_hash == hashlib.sha256(full.encode()).hexdigest()
    assert full not in json.dumps(list(OrgAPIKey.objects.values()), default=str)
    assert AuditLog.objects.filter(
        action="org_api_key.create", object_id=str(key.id), organization=org
    ).exists()
    listing = owner_client.get("/api/v1/org/api-keys").json()
    assert "key" not in listing["results"][0]
    assert {s["code"] for s in listing["available_scopes"]} == set(ALL_SCOPES)


def test_only_owner_admin_manage_keys(make_member):
    _, hr = make_member("hr")
    assert hr.get("/api/v1/org/api-keys").status_code == 403
    assert (
        hr.post("/api/v1/org/api-keys", {"name": "x", "scopes": ["jobs.read"]}, format="json").status_code
        == 403
    )
    _, admin = make_member("admin")
    assert (
        admin.post("/api/v1/org/api-keys", {"name": "x", "scopes": ["jobs.read"]}, format="json").status_code
        == 201
    )


def test_key_auth_errors(org, owner_client, org_key):
    assert key_client("ks_org_bad").get("/api/v1/enterprise/jobs").status_code == 401
    assert key_client(org_key + "x").get("/api/v1/enterprise/jobs").status_code == 401
    assert APIClient().get("/api/v1/enterprise/jobs").status_code == 401
    key = OrgAPIKey.objects.get(organization=org)
    owner_client.post(f"/api/v1/org/api-keys/{key.id}/revoke")
    res = key_client(org_key).get("/api/v1/enterprise/jobs")
    assert res.status_code == 401 and res.json()["error"]["code"] == "not_authenticated"


def test_key_cannot_use_org_endpoints(org_key):
    assert key_client(org_key).get("/api/v1/org/employments").status_code in (401, 403)


def test_scopes_enforced(org, owner):
    _, full = services.create_api_key(org, "ro", ["jobs.read"], user=owner)
    c = key_client(full)
    assert c.get("/api/v1/enterprise/jobs").status_code == 200
    res = c.get("/api/v1/enterprise/employments")
    assert res.status_code == 403 and res.json()["error"]["code"] == "permission_denied"
    assert c.post("/api/v1/enterprise/jobs", {}, format="json").status_code == 403


def test_last_used_is_recorded(org, org_key):
    key_client(org_key).get("/api/v1/enterprise/jobs")
    assert OrgAPIKey.objects.get(organization=org).last_used_at is not None


# --------------------------------------------------------------------------- enterprise endpoints
def test_employments_isolated_per_org(org, org_key):
    mine = f.EmploymentFactory(organization=org)
    f.EmploymentFactory()  # other org
    body = key_client(org_key).get("/api/v1/enterprise/employments").json()
    assert body["count"] == 1 and body["results"][0]["id"] == str(mine.id)


def test_jobs_create_applies_minimum_wage(org, org_key):
    c = key_client(org_key)
    low = {
        "title": "Cook",
        "trade": "cook",
        "wage_type": "monthly",
        "wage_amount": "5000.00",
        "openings_count": 1,
    }
    res = c.post("/api/v1/enterprise/jobs", low, format="json")
    assert res.status_code == 400 and res.json()["error"]["code"] == "below_minimum_wage"
    ok = {**low, "wage_amount": "25000.00"}
    res = c.post("/api/v1/enterprise/jobs", ok, format="json")
    assert res.status_code == 201, res.json()
    assert c.get("/api/v1/enterprise/jobs").json()["count"] == 1


def test_attendance_bulk_and_read(org, org_key):
    emp = f.EmploymentFactory(organization=org)
    other = f.EmploymentFactory()
    c = key_client(org_key)
    day = dt.date(2026, 7, 20)
    records = [
        {
            "client_uuid": str(uuid.uuid4()),
            "employment_id": str(emp.id),
            "date": day.isoformat(),
            "status": "present",
        },
        {
            "client_uuid": str(uuid.uuid4()),
            "employment_id": str(other.id),
            "date": day.isoformat(),
            "status": "present",
        },
    ]
    res = c.post("/api/v1/enterprise/attendance/bulk", {"records": records}, format="json")
    assert res.status_code == 200, res.json()
    assert res.json()["saved"] == [records[0]["client_uuid"]]
    assert res.json()["errors"][0]["code"] == "not_found"
    res = c.get("/api/v1/enterprise/attendance", {"from": "2026-07-19", "to": "2026-07-25"})
    assert res.json()["count"] == 1 and res.json()["results"][0]["employment_id"] == str(emp.id)
    assert (
        c.get("/api/v1/enterprise/attendance", {"from": "2026-01-01", "to": "2026-07-25"}).status_code == 400
    )


def test_payroll_and_timesheets_scoped(org, org_key):
    emp = f.EmploymentFactory(organization=org)
    from apps.payroll import services as payroll

    run = payroll.create_run(org, 2083, 4)
    other_org = f.OrganizationFactory()
    other_run = PayrollRun.objects.create(
        organization=other_org,
        bs_year=2083,
        bs_month=4,
        period_start=run.period_start,
        period_end=run.period_end,
        days_in_month=31,
    )
    c = key_client(org_key)
    assert c.get("/api/v1/enterprise/payroll-runs").json()["count"] == 1
    assert c.get(f"/api/v1/enterprise/payroll-runs/{run.id}/payslips").json()["count"] == 1
    assert c.get(f"/api/v1/enterprise/payroll-runs/{other_run.id}/payslips").status_code == 404
    ts_services.generate(org, dt.date(2026, 7, 19))
    body = c.get("/api/v1/enterprise/timesheets", {"week_start": "2026-07-19"}).json()
    assert body["count"] == 1 and body["results"][0]["employment_id"] == str(emp.id)


# --------------------------------------------------------------------------- webhooks
@pytest.fixture
def endpoint(org):
    return WebhookEndpoint.objects.create(organization=org, url="https://hooks.example.com/ks")


def test_signature_headers(endpoint):
    d = WebhookDelivery.objects.create(endpoint=endpoint, event="employment.started", payload={"a": 1})
    with mock.patch("requests.post", return_value=FakeResponse(204)) as post:
        services.deliver(d)
    _, kwargs = post.call_args
    body, headers = kwargs["data"], kwargs["headers"]
    ts = headers["X-KaamSathi-Timestamp"]
    expected = (
        "sha256=" + hmac.new(endpoint.secret.encode(), ts.encode() + b"." + body, hashlib.sha256).hexdigest()
    )
    assert headers["X-KaamSathi-Signature"] == expected
    assert headers["X-KaamSathi-Event"] == "employment.started"
    assert services.verify_signature(endpoint.secret, ts, body, expected)
    assert not services.verify_signature("whsec_other", ts, body, expected)
    assert not services.verify_signature(endpoint.secret, "1000", body, expected)  # stale timestamp
    payload = json.loads(body)
    assert payload["event"] == "employment.started" and payload["data"] == {"a": 1}
    assert payload["id"] == str(d.id)
    d.refresh_from_db()
    assert d.status == "delivered" and d.attempts == 1 and d.last_status_code == 204


def test_retries_with_backoff_then_failed(endpoint):
    d = WebhookDelivery.objects.create(
        endpoint=endpoint, event="ping", payload={}, next_attempt_at=timezone.now()
    )
    delays = [
        dt.timedelta(minutes=1),
        dt.timedelta(minutes=5),
        dt.timedelta(minutes=30),
        dt.timedelta(hours=2),
        dt.timedelta(hours=12),
    ]
    with mock.patch("requests.post", return_value=FakeResponse(500, "boom")):
        for attempt, delay in enumerate(delays, start=1):
            before = timezone.now()
            if attempt == 1:
                services.deliver(d)
            else:
                # not due a second early; due exactly at next_attempt_at
                assert services.retry_due(now=d.next_attempt_at - dt.timedelta(seconds=1)) == 0
                assert services.retry_due(now=d.next_attempt_at) == 1
            d.refresh_from_db()
            assert d.status == "pending" and d.attempts == attempt
            assert before + delay <= d.next_attempt_at <= timezone.now() + delay
        assert services.retry_due(now=d.next_attempt_at) == 1
    d.refresh_from_db()
    assert d.status == "failed" and d.attempts == 6 and d.next_attempt_at is None
    assert d.last_status_code == 500 and d.last_error == "boom"
    assert services.retry_due(now=timezone.now() + dt.timedelta(days=2)) == 0


def test_network_error_is_recorded(endpoint):
    d = WebhookDelivery.objects.create(endpoint=endpoint, event="ping", payload={})
    with mock.patch("requests.post", side_effect=requests.ConnectionError("refused")):
        services.deliver(d)
    d.refresh_from_db()
    assert d.status == "pending" and d.attempts == 1 and "refused" in d.last_error


def test_retry_task_runs(endpoint):
    from apps.integrations.tasks import retry_deliveries

    WebhookDelivery.objects.create(
        endpoint=endpoint, event="ping", payload={}, next_attempt_at=timezone.now() - dt.timedelta(minutes=1)
    )
    with mock.patch("requests.post", return_value=FakeResponse(200)):
        assert retry_deliveries() == 1
    assert WebhookDelivery.objects.get().status == "delivered"


def test_emit_filters_events_and_inactive(org, endpoint):
    WebhookEndpoint.objects.create(organization=org, url="https://a.example.com", events=["payroll.run_paid"])
    WebhookEndpoint.objects.create(organization=org, url="https://b.example.com", is_active=False)
    WebhookEndpoint.objects.create(url="https://c.example.com", organization=f.OrganizationFactory())
    services.emit(org, "employment.started", {"x": dt.date(2026, 1, 1)})
    rows = list(WebhookDelivery.objects.all())
    assert [r.endpoint_id for r in rows] == [endpoint.id]
    assert rows[0].payload == {"x": "2026-01-01"} and rows[0].status == "pending"


def test_emit_attempts_after_commit(org, endpoint, django_capture_on_commit_callbacks):
    with mock.patch("requests.post", return_value=FakeResponse(200)) as post:
        with django_capture_on_commit_callbacks(execute=True):
            services.emit(org, "dispute.raised", {"dispute_id": "d1"})
    assert post.call_count == 1
    assert WebhookDelivery.objects.get().status == "delivered"


def _events():
    return list(WebhookDelivery.objects.order_by("created_at").values_list("event", flat=True))


def test_signals_emit_domain_events(org, owner, endpoint):
    emp = f.EmploymentFactory(organization=org)
    assert _events() == ["employment.started"]
    wf_services.end_employment(emp, dt.date(2026, 8, 1), "resigned")
    assert _events()[-1] == "employment.ended"

    app = f.ApplicationFactory(job=f.JobFactory(organization=org))
    app.stage = "shortlisted"
    app.save()
    assert _events()[-1] == "application.stage_changed"
    payload = WebhookDelivery.objects.filter(event="application.stage_changed").get().payload
    assert payload["from_stage"] == "sourced" and payload["to_stage"] == "shortlisted"

    from apps.payroll import services as payroll

    emp2 = f.EmploymentFactory(organization=org)
    run = payroll.create_run(org, 2083, 4)
    payroll.approve_run(run, owner)
    assert _events()[-1] == "payroll.run_approved"
    payroll.mark_paid(run, dt.date(2026, 8, 20))
    assert _events()[-1] == "payroll.run_paid"

    ts_services.generate(org, dt.date(2026, 7, 19))
    ts = Timesheet.objects.get(employment=emp2)
    ts_services.approve(ts, owner)
    assert _events()[-1] == "timesheet.approved"
    n = len(_events())
    ts.save()  # re-saving an approved sheet does not re-emit
    assert len(_events()) == n


# --------------------------------------------------------------------------- org webhook UI
def test_webhook_crud_test_and_redeliver(owner_client, org):
    res = owner_client.post(
        "/api/v1/org/webhooks",
        {"url": "https://erp.example.com/hook", "events": ["timesheet.approved"]},
        format="json",
    )
    assert res.status_code == 201, res.json()
    wid, secret = res.json()["id"], res.json()["secret"]
    assert secret.startswith("whsec_")
    listing = owner_client.get("/api/v1/org/webhooks").json()
    assert "secret" not in listing["results"][0] and "timesheet.approved" in listing["available_events"]

    with mock.patch("requests.post", return_value=FakeResponse(500, "down")):
        res = owner_client.post(f"/api/v1/org/webhooks/{wid}/test")
    assert res.status_code == 200 and res.json()["status"] == "pending" and res.json()["attempts"] == 1
    did = res.json()["id"]

    deliveries = owner_client.get(f"/api/v1/org/webhooks/{wid}/deliveries").json()
    assert deliveries["count"] == 1 and deliveries["results"][0]["event"] == "ping"

    with mock.patch("requests.post", return_value=FakeResponse(200)):
        res = owner_client.post(f"/api/v1/org/webhooks/deliveries/{did}/redeliver")
    assert res.status_code == 200 and res.json()["status"] == "delivered"

    res = owner_client.patch(f"/api/v1/org/webhooks/{wid}", {"is_active": False}, format="json")
    assert res.json()["is_active"] is False
    assert owner_client.delete(f"/api/v1/org/webhooks/{wid}").status_code == 204
    assert not WebhookEndpoint.objects.filter(pk=wid).exists()


def test_webhook_isolated_per_org(owner_client):
    other = WebhookEndpoint.objects.create(organization=f.OrganizationFactory(), url="https://x.example.com")
    assert owner_client.get(f"/api/v1/org/webhooks/{other.id}").status_code == 404
    d = WebhookDelivery.objects.create(endpoint=other, event="ping", payload={}, attempts=1)
    assert owner_client.post(f"/api/v1/org/webhooks/deliveries/{d.id}/redeliver").status_code == 404


def test_https_required_in_production(owner_client, settings):
    settings.DEBUG = False
    for url in ("http://erp.example.com/hook", "https://127.0.0.1/hook", "https://localhost/x"):
        res = owner_client.post("/api/v1/org/webhooks", {"url": url}, format="json")
        assert res.status_code == 400, url
    assert (
        owner_client.post(
            "/api/v1/org/webhooks", {"url": "https://erp.example.com/h"}, format="json"
        ).status_code
        == 201
    )
