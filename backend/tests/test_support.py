"""Support cases + SLA escalation (incl. disputes) — docs/CONTRACT-EXTENSIONS.md §2."""

import datetime as dt

import pytest
from django.utils import timezone

from apps.notifications.models import SMSMessage
from apps.support.models import CaseMessage, SupportCase, format_number, sla_due
from apps.support.services import create_case
from apps.support.tasks import escalate_overdue
from apps.trust.models import Dispute
from tests import factories as f
from tests.conftest import auth_client

pytestmark = pytest.mark.django_db


def notifications_for(user) -> int:
    """Inbox rows when the notifications inbox exists, else the SMS fallback."""
    from django.apps import apps

    try:
        Notification = apps.get_model("notifications", "Notification")
    except LookupError:
        return SMSMessage.objects.filter(phone=user.phone).count()
    return Notification.objects.filter(user=user).count()


@pytest.fixture
def worker_user():
    w = f.WorkerFactory()
    w.user = f.UserFactory(phone=w.phone)
    w.save(update_fields=["user"])
    return w.user


@pytest.fixture
def worker_client(worker_user):
    return auth_client(worker_user)


def new_case(client, path="/api/v1/me/support-cases", **extra):
    body = {"subject": "Overtime missing", "description": "6 hours missing", "category": "payment", **extra}
    return client.post(path, body, format="json")


def test_numbering_is_sequential_and_formatted(worker_client):
    a = new_case(worker_client).json()
    b = new_case(worker_client).json()
    assert a["number"].startswith("KS-") and len(a["number"]) == 9
    assert int(b["number"][3:]) == int(a["number"][3:]) + 1
    assert format_number(123) == "KS-000123"


@pytest.mark.parametrize(("priority", "hours"), [("urgent", 4), ("high", 24), ("normal", 72), ("low", 168)])
def test_sla_by_priority(priority, hours):
    t = timezone.now()
    assert sla_due(t, priority) == t + dt.timedelta(hours=hours)


def test_worker_case_flow_and_internal_notes_hidden(worker_client, worker_user, staff_client):
    case = new_case(worker_client).json()
    assert case["status"] == "open" and case["worker"] is not None and case["organization"] is None
    assert case["assignee"] is None

    url = f"/api/v1/ops/support-cases/{case['id']}/messages"
    note = staff_client.post(url, {"body": "Check payroll run", "internal": True}, format="json")
    assert note.status_code == 201
    obj = SupportCase.objects.get(pk=case["id"])
    assert obj.first_response_at is None  # internal notes are not a response
    reply = staff_client.post(url, {"body": "We are checking with your employer."}, format="json")
    assert reply.status_code == 201
    obj.refresh_from_db()
    assert obj.first_response_at is not None
    assert obj.assignee is not None  # first responder takes the case
    assert notifications_for(worker_user) == 1  # requester notified once (internal note is silent)

    mine = worker_client.get(f"/api/v1/me/support-cases/{case['id']}/messages").json()
    assert [m["body"] for m in mine] == ["We are checking with your employer."]
    assert mine[0]["author"]["full_name"] == "KaamSathi"
    staff_view = staff_client.get(url).json()
    assert len(staff_view) == 2 and staff_view[0]["internal"] is True
    detail = worker_client.get(f"/api/v1/me/support-cases/{case['id']}").json()
    assert detail["messages_count"] == 1
    assert detail["assignee"] is None and detail["escalated"] is False


def test_requester_reply_reopens_pending_case(worker_client, staff_client):
    case = new_case(worker_client).json()
    staff_client.patch(f"/api/v1/ops/support-cases/{case['id']}", {"status": "pending_user"}, format="json")
    res = worker_client.post(
        f"/api/v1/me/support-cases/{case['id']}/messages", {"body": "Screenshot sent"}, format="json"
    )
    assert res.status_code == 201
    assert SupportCase.objects.get(pk=case["id"]).status == "open"
    # requesters cannot post internal notes
    worker_client.post(
        f"/api/v1/me/support-cases/{case['id']}/messages", {"body": "x", "internal": True}, format="json"
    )
    assert not CaseMessage.objects.filter(case_id=case["id"], internal=True).exists()


def test_closed_case_rejects_messages(worker_client, staff_client):
    case = new_case(worker_client).json()
    staff_client.patch(f"/api/v1/ops/support-cases/{case['id']}", {"status": "closed"}, format="json")
    res = worker_client.post(f"/api/v1/me/support-cases/{case['id']}/messages", {"body": "hi"}, format="json")
    assert res.status_code == 400 and res.json()["error"]["code"] == "invalid_state"


def test_users_only_see_their_own_cases(worker_client):
    case = new_case(worker_client).json()
    other = auth_client(f.UserFactory())
    assert other.get("/api/v1/me/support-cases").json()["count"] == 0
    assert other.get(f"/api/v1/me/support-cases/{case['id']}").status_code == 404


def test_org_cases_scoped_and_supervisor_sees_own(owner_client, org, make_member):
    path = "/api/v1/org/support-cases"
    res = new_case(owner_client, path)
    assert res.status_code == 201
    assert res.json()["organization"]["id"] == str(org.id)
    _sup, sup_client = make_member("supervisor")
    assert sup_client.get(path).json()["count"] == 0  # not theirs
    assert new_case(sup_client, path).status_code == 201
    assert sup_client.get(path).json()["count"] == 1
    assert owner_client.get(path).json()["count"] == 2
    other = f.MembershipFactory(role="owner")
    assert auth_client(other.user, other.organization).get(path).json()["count"] == 0


def test_ops_queue_filters_assign_priority(staff_client, worker_client):
    case = new_case(worker_client).json()
    staff = f.UserFactory(is_staff=True)
    url = f"/api/v1/ops/support-cases/{case['id']}"
    res = staff_client.patch(url, {"assignee_id": str(staff.pk), "priority": "urgent"}, format="json")
    assert res.status_code == 200
    data = res.json()
    assert data["assignee"]["id"] == str(staff.pk)
    obj = SupportCase.objects.get(pk=case["id"])
    assert obj.sla_due_at == obj.created_at + dt.timedelta(hours=4)
    non_staff = f.UserFactory()
    assert staff_client.patch(url, {"assignee_id": str(non_staff.pk)}, format="json").status_code == 400

    assert staff_client.get("/api/v1/ops/support-cases", {"assignee": str(staff.pk)}).json()["count"] == 1
    assert staff_client.get("/api/v1/ops/support-cases", {"assignee": "none"}).json()["count"] == 0
    assert staff_client.get("/api/v1/ops/support-cases", {"priority": "urgent"}).json()["count"] == 1
    assert staff_client.get("/api/v1/ops/support-cases", {"overdue": "1"}).json()["count"] == 0
    SupportCase.objects.filter(pk=case["id"]).update(sla_due_at=timezone.now() - dt.timedelta(minutes=1))
    rows = staff_client.get("/api/v1/ops/support-cases", {"overdue": "1"}).json()["results"]
    assert len(rows) == 1 and rows[0]["overdue"] is True

    res = staff_client.patch(url, {"status": "resolved"}, format="json")
    assert res.json()["resolved_at"] is not None


def test_ops_endpoints_require_staff(worker_client):
    assert worker_client.get("/api/v1/ops/support-cases").status_code == 403


def test_escalate_overdue_cases_and_disputes():
    requester = f.UserFactory()
    staff = f.UserFactory(is_staff=True)
    old = create_case(
        requester=requester,
        subject="Old",
        description="x",
        priority="urgent",
        created_at=timezone.now() - dt.timedelta(hours=5),
    )
    fresh = create_case(requester=requester, subject="New", description="x", priority="urgent")
    waiting = create_case(
        requester=requester,
        subject="Waiting",
        description="x",
        created_at=timezone.now() - dt.timedelta(days=10),
    )
    SupportCase.objects.filter(pk=waiting.pk).update(status="pending_user")

    worker = f.WorkerFactory()
    dispute = Dispute.objects.create(worker=worker, kind="wage", description="Unpaid")
    assert dispute.sla_due_at is not None
    assert abs((dispute.sla_due_at - timezone.now()) - dt.timedelta(days=7)) < dt.timedelta(minutes=1)
    Dispute.objects.filter(pk=dispute.pk).update(sla_due_at=timezone.now() - dt.timedelta(hours=1))

    result = escalate_overdue()
    assert result == {"cases": 1, "disputes": 1}
    old.refresh_from_db()
    fresh.refresh_from_db()
    assert old.escalated and not fresh.escalated
    assert Dispute.objects.get(pk=dispute.pk).escalated
    assert notifications_for(staff) == 2
    # escalation happens once
    assert escalate_overdue() == {"cases": 0, "disputes": 0}


def test_dispute_sla_moves_with_status():
    worker = f.WorkerFactory()
    d = Dispute.objects.create(worker=worker, kind="wage", description="x")
    first_due = d.sla_due_at
    d.description = "edited"
    d.save()
    assert Dispute.objects.get(pk=d.pk).sla_due_at == first_due  # unchanged by unrelated saves
    d = Dispute.objects.get(pk=d.pk)
    d.status = "employer_responded"
    d.responded_at = timezone.now() + dt.timedelta(days=2)
    d.save(update_fields=["status", "responded_at"])
    d.refresh_from_db()
    assert d.sla_due_at == d.responded_at + dt.timedelta(days=7)
    d.status = "resolved"
    d.save(update_fields=["status"])
    d.refresh_from_db()
    assert d.sla_due_at is None


def test_dispute_payload_includes_sla(staff_client):
    Dispute.objects.create(worker=f.WorkerFactory(), kind="wage", description="x")
    row = staff_client.get("/api/v1/ops/disputes").json()["results"][0]
    assert row["sla_due_at"] and row["overdue"] is False and row["escalated"] is False


# --------------------------------------------------------------------------- safety incidents
def safety_case(client, **extra):
    body = {
        "subject": "No harness on the 5th floor",
        "description": "We work at height without harness.",
        "category": "safety",
        "safety_kind": "unsafe_workplace",
        **extra,
    }
    return client.post("/api/v1/me/support-cases", body, format="json")


def test_safety_report_requires_kind(worker_client):
    res = worker_client.post(
        "/api/v1/me/support-cases", {"subject": "x", "description": "y", "category": "safety"}, format="json"
    )
    assert res.status_code == 400 and "safety_kind" in res.json()["error"]["fields"]


def test_safety_report_is_confidential_high_priority_24h(worker_client, org, owner_client):
    res = safety_case(worker_client, organization_id=str(org.id), anonymous=True)
    assert res.status_code == 201, res.content
    data = res.json()
    assert data["confidential"] is True and data["priority"] == "high" and data["emergency"] is False
    case = SupportCase.objects.get(pk=data["id"])
    assert case.organization == org
    assert case.sla_due_at == case.created_at + dt.timedelta(hours=24)
    # the reporter still sees it under /me; the employer does not
    assert worker_client.get("/api/v1/me/support-cases").json()["count"] == 1
    assert owner_client.get("/api/v1/org/support-cases").json()["count"] == 0
    assert owner_client.get(f"/api/v1/org/support-cases/{case.id}").status_code == 404


def test_shared_anonymous_safety_case_hides_reporter(
    worker_client, worker_user, org, owner_client, staff_client
):
    data = safety_case(worker_client, organization_id=str(org.id), anonymous=True).json()
    worker_client.post(
        f"/api/v1/me/support-cases/{data['id']}/messages", {"body": "Still unsafe"}, format="json"
    )
    res = staff_client.patch(
        f"/api/v1/ops/support-cases/{data['id']}", {"shared_with_org": True}, format="json"
    )
    assert res.status_code == 200 and res.json()["shared_with_org"] is True
    seen = owner_client.get(f"/api/v1/org/support-cases/{data['id']}").json()
    assert seen["requester"]["id"] is None and seen["worker"] is None
    assert worker_user.full_name not in str(seen)
    thread = owner_client.get(f"/api/v1/org/support-cases/{data['id']}/messages").json()
    assert thread[0]["author"]["id"] is None


def test_emergency_alerts_all_support_staff_now(worker_client):
    staff = [f.UserFactory(is_staff=True) for _ in range(2)]
    res = safety_case(worker_client, safety_kind="harassment", emergency=True)
    data = res.json()
    assert data["priority"] == "urgent" and data["emergency"] is True
    for user in staff:
        assert notifications_for(user) == 1
    assert SupportCase.objects.get(pk=data["id"]).escalated is True


def test_non_safety_case_ignores_safety_flags(worker_client):
    data = new_case(worker_client, emergency=True, anonymous=True).json()
    assert data["emergency"] is False and data["anonymous"] is False and data["confidential"] is False


def test_ops_links_case_to_dispute_and_flag(staff_client, worker_client):
    from apps.risk.models import FraudFlag

    data = safety_case(worker_client, safety_kind="payment_withholding").json()
    dispute = Dispute.objects.create(worker=f.WorkerFactory(), kind="wage", description="x")
    flag = FraudFlag.objects.create(subject_type="worker", subject_id="x", kind="manual")
    url = f"/api/v1/ops/support-cases/{data['id']}"
    res = staff_client.patch(
        url, {"dispute_id": str(dispute.id), "risk_flag_id": str(flag.id)}, format="json"
    )
    assert res.status_code == 200
    assert res.json()["dispute_id"] == str(dispute.id) and res.json()["risk_flag_id"] == str(flag.id)
    bad = staff_client.patch(url, {"dispute_id": "00000000-0000-0000-0000-000000000000"}, format="json")
    assert bad.status_code == 400
    assert staff_client.get("/api/v1/ops/support-cases", {"category": "safety"}).json()["count"] == 1


# --------------------------------------------------------------------------- contact center
def test_lookup_by_phone_and_citizenship(staff_client, worker_user):
    from apps.audit.models import AuditLog

    worker = worker_user.worker
    worker.citizenship_no = "12-34-56-78901"
    worker.save()
    create_case(requester=worker_user, worker=worker, subject="Help", description="x")
    res = staff_client.get("/api/v1/ops/support/lookup", {"phone": worker.phone})
    assert res.status_code == 200
    data = res.json()
    assert data["workers"][0]["id"] == str(worker.id)
    assert data["users"][0]["id"] == str(worker_user.id)
    assert len(data["open_cases"]) == 1
    by_id = staff_client.get("/api/v1/ops/support/lookup", {"citizenship_no": "12 34 56 78901"}).json()
    assert by_id["workers"][0]["id"] == str(worker.id)
    assert "citizenship" not in str(by_id["workers"][0])
    assert staff_client.get("/api/v1/ops/support/lookup").status_code == 400
    assert AuditLog.objects.filter(action="ops.support.lookup").count() == 2


def test_lookup_requires_staff(worker_client):
    assert worker_client.get("/api/v1/ops/support/lookup", {"phone": "9800000000"}).status_code == 403


def test_call_note_is_internal(staff_client, worker_client):
    data = new_case(worker_client).json()
    res = staff_client.post(
        f"/api/v1/ops/support-cases/{data['id']}/messages",
        {"body": "Caller asked about OT", "channel": "phone"},
        format="json",
    )
    assert res.status_code == 201 and res.json()["internal"] is True and res.json()["channel"] == "phone"
    assert worker_client.get(f"/api/v1/me/support-cases/{data['id']}/messages").json() == []


def test_identity_check_required_for_sensitive_worker_changes(staff_client, worker_client, worker_user):
    data = new_case(worker_client).json()
    base = f"/api/v1/ops/support-cases/{data['id']}"
    change = {"payment_method": "bank", "bank_name": "Nabil Bank", "bank_account_no": "0011223344"}
    res = staff_client.post(f"{base}/worker-update", change, format="json")
    assert res.status_code == 403 and res.json()["error"]["code"] == "identity_check_required"

    failed = staff_client.post(f"{base}/identity-check", {"method": "otp", "result": "failed"}, format="json")
    assert failed.json()["identity_verified"] is False
    assert staff_client.post(f"{base}/worker-update", change, format="json").status_code == 403

    ok = staff_client.post(f"{base}/identity-check", {"method": "otp", "result": "passed"}, format="json")
    assert ok.status_code == 200 and ok.json()["identity_verified"] is True
    res = staff_client.post(f"{base}/worker-update", {**change, "phone": "9811122233"}, format="json")
    assert res.status_code == 200, res.content
    worker_user.refresh_from_db()
    worker = worker_user.worker
    worker.refresh_from_db()
    assert worker.bank_account_no == "0011223344" and worker.phone == "9811122233"
    assert worker_user.phone == "9811122233"
    from apps.audit.models import AuditLog

    entry = AuditLog.objects.get(action="ops.support_case.worker_update")
    assert "0011223344" not in str(entry.changes)  # masked in the audit trail

    # the check expires after 15 minutes
    SupportCase.objects.filter(pk=data["id"]).update(
        identity_verified_at=timezone.now() - dt.timedelta(minutes=16)
    )
    assert staff_client.post(f"{base}/worker-update", {"wallet_id": "98"}, format="json").status_code == 403


def test_worker_update_rejects_taken_phone(staff_client, worker_client):
    data = new_case(worker_client).json()
    other = f.WorkerFactory()
    base = f"/api/v1/ops/support-cases/{data['id']}"
    staff_client.post(
        f"{base}/identity-check", {"method": "security_questions", "result": "passed"}, format="json"
    )
    res = staff_client.post(f"{base}/worker-update", {"phone": other.phone}, format="json")
    assert res.status_code == 400 and res.json()["error"]["code"] == "duplicate"


# --------------------------------------------------------------------------- help center
def test_help_center_public_and_seeded(api):
    from apps.support.help_content import ARTICLES

    rows = api.get("/api/v1/help/articles").json()
    assert len(rows) >= len(ARTICLES) == 10
    worker_rows = api.get("/api/v1/help/articles", {"audience": "worker"}).json()
    assert {r["audience"] for r in worker_rows} <= {"worker", "all"}
    found = api.get("/api/v1/help/articles", {"q": "SSF"}).json()
    assert any(r["slug"] == "ssf-for-employers" for r in found)
    one = api.get("/api/v1/help/articles/minimum-wage", HTTP_ACCEPT_LANGUAGE="ne").json()
    assert "न्यूनतम" in one["title"] and "19,550" in one["body_en"]


def test_help_ops_crud_and_unpublished_hidden(staff_client, api, worker_client):
    body = {
        "slug": "draft-article",
        "audience": "worker",
        "category": "pay",
        "title_en": "Draft",
        "body_en": "Text",
        "is_published": False,
    }
    assert worker_client.post("/api/v1/ops/help/articles", body, format="json").status_code == 403
    res = staff_client.post("/api/v1/ops/help/articles", body, format="json")
    assert res.status_code == 201, res.content
    assert api.get("/api/v1/help/articles/draft-article").status_code == 404
    staff_client.patch(f"/api/v1/ops/help/articles/{res.json()['id']}", {"is_published": True}, format="json")
    assert api.get("/api/v1/help/articles/draft-article").status_code == 200
    assert staff_client.delete(f"/api/v1/ops/help/articles/{res.json()['id']}").status_code == 204
