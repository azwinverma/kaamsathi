"""Hiring completion: requirements (J002), paused jobs (J006), matching config/runs/version
(K001/K010/K012), employer invitations (L004), tags (L008), assignment (L009), interviews (L010)."""

import datetime as dt
from decimal import Decimal as D

import pytest
from django.utils import timezone

from apps.audit.models import AuditLog
from apps.hiring.matching import ALGORITHM_VERSION, DEFAULT_WEIGHTS, current_weights
from apps.hiring.models import Application, Interview, JobRequirement, MatchCandidate, MatchRun
from apps.hiring.services import match_explain
from tests import factories as f
from tests.conftest import auth_client

pytestmark = pytest.mark.django_db


def worker(trade="cook", years=3, nstb="none", **kw):
    w = f.WorkerFactory(**kw)
    if trade:
        f.WorkerSkillFactory(worker=w, trade=f.trade(trade), years_experience=years, nstb_level=nstb)
    return w


@pytest.fixture
def job(org):
    return f.JobFactory(organization=org, trade=f.trade("cook"), wage_amount=D("20000"))


# --------------------------------------------------------------------------- J002 requirements
def test_job_form_requirements_roundtrip(owner_client):
    r = owner_client.post(
        "/api/v1/org/jobs",
        {
            "title": "Head cook",
            "trade": "cook",
            "wage_type": "monthly",
            "wage_amount": "25000.00",
            "requirements": [
                {"nstb_level_min": "level2", "min_years": 3, "required": True},
                {"credential_kind": "safety", "required": False},
            ],
        },
        format="json",
    )
    assert r.status_code == 201, r.json()
    reqs = r.json()["requirements"]
    assert len(reqs) == 2
    assert reqs[0]["label"] == "Cook · NSTB Level 2+ · 3+ yrs"
    assert reqs[1]["credential_kind_label"]
    job_id = r.json()["id"]
    # PATCH replaces the list
    r = owner_client.patch(f"/api/v1/org/jobs/{job_id}", {"requirements": []}, format="json")
    assert r.status_code == 200 and r.json()["requirements"] == []
    # empty requirement row → 400
    r = owner_client.patch(
        f"/api/v1/org/jobs/{job_id}", {"requirements": [{"required": True}]}, format="json"
    )
    assert r.status_code == 400


def test_requirements_in_matching(job, staff_client):
    JobRequirement.objects.create(job=job, nstb_level_min="level2", required=True)
    JobRequirement.objects.create(job=job, credential_kind="safety", required=False)
    strong = worker(nstb="level2")
    weak = worker(nstb="level1")
    from apps.credentials.models import Credential

    Credential.objects.create(worker=strong, kind="safety", title="S", issuer="X", status="verified")
    score, reasons, explain = match_explain(job, strong)
    assert explain["requirements"] == 10  # 2 met × 5
    rows = staff_client.get(f"/api/v1/ops/jobs/{job.id}/matches").json()
    ids = [r["worker"]["id"] for r in rows]
    assert str(strong.id) in ids and str(weak.id) not in ids  # required unmet → excluded
    row = next(r for r in rows if r["worker"]["id"] == str(strong.id))
    assert all(c["met"] for c in row["requirements"])
    assert row["explain"]["requirements"] == 10


def test_expired_credential_does_not_meet_requirement(job):
    from apps.credentials.models import Credential

    JobRequirement.objects.create(job=job, credential_kind="license", required=False)
    w = worker()
    Credential.objects.create(
        worker=w,
        kind="license",
        title="L",
        issuer="X",
        status="verified",
        expires_on=timezone.localdate() - dt.timedelta(days=1),
    )
    assert "requirements" not in match_explain(job, w)[2]


# --------------------------------------------------------------------------- J006 paused
def test_pause_resume_and_effects(owner_client, job, staff_client):
    r = owner_client.post(f"/api/v1/org/jobs/{job.id}/pause")
    assert r.status_code == 200 and r.json()["status"] == "paused"
    assert r.json()["status_label"] == "Paused" and r.json()["paused_at"]
    w = worker()
    r = staff_client.post(f"/api/v1/ops/jobs/{job.id}/shortlist", {"worker_ids": [str(w.id)]}, format="json")
    assert r.status_code == 400 and r.json()["error"]["code"] == "invalid_state"
    # not recommended to workers
    from apps.hiring.services import recommended_jobs

    assert job not in list(recommended_jobs(w))
    # pause only from open
    assert owner_client.post(f"/api/v1/org/jobs/{job.id}/pause").status_code == 400
    r = owner_client.post(f"/api/v1/org/jobs/{job.id}/resume")
    assert r.json()["status"] == "open" and r.json()["paused_at"] is None
    assert AuditLog.objects.filter(action="job.paused").exists()
    # paused jobs can be closed
    owner_client.post(f"/api/v1/org/jobs/{job.id}/pause")
    assert owner_client.post(f"/api/v1/org/jobs/{job.id}/close").json()["status"] == "closed"


# --------------------------------------------------------------------------- K001 config
def test_default_weights_match_v2_constants(job):
    assert current_weights() == DEFAULT_WEIGHTS
    w = worker(years=4, nstb="level1")
    assert match_explain(job, w)[2] == {
        "trade": 50,
        "district": 20,
        "verified": 10,
        "nstb": 5,
        "experience": 4,
    }


def test_match_config_editor(staff_client, job):
    r = staff_client.get("/api/v1/ops/matching/config")
    assert r.status_code == 200
    assert r.json()["algorithm_version"] == ALGORITHM_VERSION and r.json()["weights"] == DEFAULT_WEIGHTS
    rev = r.json()["revision"]
    r = staff_client.patch("/api/v1/ops/matching/config", {"weights": {"district": 30}}, format="json")
    assert r.status_code == 200 and r.json()["weights"]["district"] == 30
    assert r.json()["revision"] == rev + 1
    assert AuditLog.objects.filter(action="ops.matching.config").exists()
    w = worker(years=0)
    assert match_explain(job, w)[2]["district"] == 30
    for bad in ({"district": 101}, {"nope": 1}, {"trade": "x"}, {"trade": 0}):
        r = staff_client.patch("/api/v1/ops/matching/config", {"weights": bad}, format="json")
        assert r.status_code == 400, bad
    r = staff_client.post("/api/v1/ops/matching/config/reset")
    assert r.json()["weights"] == DEFAULT_WEIGHTS


def test_match_config_superadmin_only():
    from apps.accounts.models import StaffProfile

    user = f.UserFactory(is_staff=True)
    StaffProfile.objects.create(user=user, roles=["verifier"])
    assert auth_client(user).get("/api/v1/ops/matching/config").status_code == 403


# --------------------------------------------------------------------------- K010 / K012 runs
def test_matches_persist_runs_and_reuse(staff_client, job):
    a = worker(years=5)
    worker(years=1)
    r = staff_client.get(f"/api/v1/ops/jobs/{job.id}/matches")
    assert r.status_code == 200
    rows = r.json()
    assert r["X-Match-Algorithm-Version"] == ALGORITHM_VERSION
    assert [x["rank"] for x in rows[:2]] == [1, 2] and rows[0]["worker"]["id"] == str(a.id)
    run = MatchRun.objects.get(job=job)
    assert run.algorithm_version == ALGORITHM_VERSION and run.config["weights"] == DEFAULT_WEIGHTS
    assert MatchCandidate.objects.filter(run=run).count() == run.candidates_count == 2
    assert rows[0]["run_id"] == str(run.id)
    # reused within 10 minutes
    staff_client.get(f"/api/v1/ops/jobs/{job.id}/matches")
    assert MatchRun.objects.filter(job=job).count() == 1
    # refresh forces a new run; a config change also invalidates reuse
    staff_client.get(f"/api/v1/ops/jobs/{job.id}/matches", {"refresh": "1"})
    assert MatchRun.objects.filter(job=job).count() == 2
    staff_client.patch("/api/v1/ops/matching/config", {"weights": {"verified": 15}}, format="json")
    staff_client.get(f"/api/v1/ops/jobs/{job.id}/matches")
    assert MatchRun.objects.filter(job=job).count() == 3
    # older run is not reused
    MatchRun.objects.update(created_at=timezone.now() - dt.timedelta(minutes=11))
    staff_client.get(f"/api/v1/ops/jobs/{job.id}/matches")
    assert MatchRun.objects.filter(job=job).count() == 4

    hist = staff_client.get(f"/api/v1/ops/jobs/{job.id}/match-runs").json()
    assert hist["count"] == 4 and hist["results"][0]["algorithm_version"] == ALGORITHM_VERSION
    detail = staff_client.get(f"/api/v1/ops/jobs/{job.id}/match-runs/{hist['results'][0]['id']}").json()
    assert detail["candidates"][0]["rank"] == 1


def test_shortlist_records_score_and_version(staff_client, job):
    w = worker(years=5)
    rows = staff_client.get(f"/api/v1/ops/jobs/{job.id}/matches").json()
    score = next(r["score"] for r in rows if r["worker"]["id"] == str(w.id))
    r = staff_client.post(f"/api/v1/ops/jobs/{job.id}/shortlist", {"worker_ids": [str(w.id)]}, format="json")
    assert r.status_code == 201
    app = Application.objects.get(job=job, worker=w)
    assert app.match_score == score and app.match_algorithm_version == ALGORITHM_VERSION
    # shortlisted worker no longer appears in a reused run
    rows = staff_client.get(f"/api/v1/ops/jobs/{job.id}/matches").json()
    assert str(w.id) not in [x["worker"]["id"] for x in rows]


def test_shortlist_without_run_scores_live(staff_client, job):
    w = worker(years=2)
    staff_client.post(f"/api/v1/ops/jobs/{job.id}/shortlist", {"worker_ids": [str(w.id)]}, format="json")
    app = Application.objects.get(job=job, worker=w)
    assert app.match_score == match_explain(job, w)[0]


# --------------------------------------------------------------------------- L004 invitations
def _past_worker(org):
    w = worker()
    f.EmploymentFactory(
        organization=org, worker=w, status="ended", end_date=dt.date(2025, 6, 1), end_reason="resigned"
    )
    return w


def test_invite_past_worker(owner_client, org, job):
    from apps.notifications.models import Notification

    w = _past_worker(org)
    w.user = f.UserFactory(phone=w.phone)
    w.save()
    cands = owner_client.get(f"/api/v1/org/jobs/{job.id}/invite-candidates").json()
    assert [c["id"] for c in cands["results"]] == [str(w.id)]
    r = owner_client.post(f"/api/v1/org/jobs/{job.id}/invite", {"worker_id": str(w.id)}, format="json")
    assert r.status_code == 201, r.json()
    d = r.json()
    assert (
        d["source"] == "employer_invite" and d["stage"] == "shortlisted" and d["worker_response"] == "pending"
    )
    assert Notification.objects.filter(user=w.user, kind="application_invited").exists()
    assert AuditLog.objects.filter(action="application.invite").exists()
    # duplicate
    r = owner_client.post(f"/api/v1/org/jobs/{job.id}/invite", {"worker_id": str(w.id)}, format="json")
    assert r.status_code == 400 and r.json()["error"]["code"] == "duplicate"
    # ops sees it
    assert (
        f.JobFactory._meta.model.objects.get(pk=job.pk).applications.filter(source="employer_invite").count()
        == 1
    )


def test_invite_requires_relationship(owner_client, job):
    stranger = worker()
    r = owner_client.post(f"/api/v1/org/jobs/{job.id}/invite", {"worker_id": str(stranger.id)}, format="json")
    assert r.status_code == 403


def test_invite_via_passport_share(owner_client, job):
    from apps.credentials.models import PassportShare

    w = worker()
    share = PassportShare.objects.create(
        worker=w,
        token="t" * 32,
        audience_label="Hotel",
        purpose="job",
        expires_at=timezone.now() + dt.timedelta(days=5),
    )
    r = owner_client.post(f"/api/v1/org/jobs/{job.id}/invite", {"share_token": share.token}, format="json")
    assert r.status_code == 201
    share.revoked_at = timezone.now()
    share.save()
    other_job = f.JobFactory(organization=job.organization)
    r = owner_client.post(
        f"/api/v1/org/jobs/{other_job.id}/invite", {"share_token": share.token}, format="json"
    )
    assert r.status_code == 400


def test_invite_kyb_gate_and_paused(owner_client, org, job, settings):
    w = _past_worker(org)
    job.status = "paused"
    job.save()
    r = owner_client.post(f"/api/v1/org/jobs/{job.id}/invite", {"worker_id": str(w.id)}, format="json")
    assert r.status_code == 400
    job.status = "open"
    job.save()
    settings.KYB_REQUIRED_FOR_SHORTLIST = True
    org.verification_status = "pending"
    org.save()
    r = owner_client.post(f"/api/v1/org/jobs/{job.id}/invite", {"worker_id": str(w.id)}, format="json")
    assert r.status_code == 400 and r.json()["error"]["code"] == "invalid_state"


def test_invite_supervisor_forbidden(make_member, org, job):
    w = _past_worker(org)
    _, client = make_member("supervisor")
    assert client.post(f"/api/v1/org/jobs/{job.id}/invite", {"worker_id": str(w.id)}).status_code == 403


# --------------------------------------------------------------------------- L008 / L009
def test_tags_and_assignee(owner_client, org, job, make_member):
    app = f.ApplicationFactory(job=job, stage="shortlisted")
    other = f.ApplicationFactory(job=job, stage="shortlisted")
    hr_user, _ = make_member("hr")
    r = owner_client.patch(
        f"/api/v1/org/applications/{app.id}",
        {"tags": ["Night shift", "night shift", " Urgent "], "assignee_id": str(hr_user.id)},
        format="json",
    )
    assert r.status_code == 200, r.json()
    assert r.json()["tags"] == ["night shift", "urgent"]
    assert r.json()["assignee"]["id"] == str(hr_user.id)
    ids = [x["id"] for x in owner_client.get("/api/v1/org/applications", {"tag": "Urgent"}).json()["results"]]
    assert ids == [str(app.id)]
    ids = [
        x["id"] for x in owner_client.get("/api/v1/org/applications", {"assignee": "none"}).json()["results"]
    ]
    assert ids == [str(other.id)]
    tags = owner_client.get("/api/v1/org/application-tags").json()
    assert {"tag": "urgent", "count": 1} in tags
    # too many tags, non-member assignee
    r = owner_client.patch(
        f"/api/v1/org/applications/{app.id}", {"tags": [f"t{i}" for i in range(11)]}, format="json"
    )
    assert r.status_code == 400
    stranger = f.UserFactory()
    r = owner_client.patch(
        f"/api/v1/org/applications/{app.id}", {"assignee_id": str(stranger.id)}, format="json"
    )
    assert r.status_code == 400
    assert AuditLog.objects.filter(action="application.update").exists()


def test_tags_cross_org_and_supervisor(job, make_member):
    app = f.ApplicationFactory(job=job, stage="shortlisted")
    other_org_owner = f.MembershipFactory(role="owner")
    client = auth_client(other_org_owner.user, other_org_owner.organization)
    assert (
        client.patch(f"/api/v1/org/applications/{app.id}", {"tags": ["x"]}, format="json").status_code == 404
    )
    _, sup = make_member("supervisor")
    assert sup.patch(f"/api/v1/org/applications/{app.id}", {"tags": ["x"]}, format="json").status_code == 403


def test_ops_job_owner(staff_client, job):
    me = staff_client.get("/api/v1/auth/me").json()["id"]
    r = staff_client.post(f"/api/v1/ops/jobs/{job.id}/owner", {"user_id": me}, format="json")
    assert r.status_code == 200 and r.json()["ops_owner"]["id"] == me
    other = f.JobFactory()
    ids = [j["id"] for j in staff_client.get("/api/v1/ops/jobs", {"owner": "me"}).json()["results"]]
    assert ids == [str(job.id)]
    ids = [j["id"] for j in staff_client.get("/api/v1/ops/jobs", {"owner": "none"}).json()["results"]]
    assert str(other.id) in ids and str(job.id) not in ids
    non_staff = f.UserFactory()
    r = staff_client.post(f"/api/v1/ops/jobs/{job.id}/owner", {"user_id": str(non_staff.id)}, format="json")
    assert r.status_code == 400
    r = staff_client.post(f"/api/v1/ops/jobs/{job.id}/owner", {"user_id": None}, format="json")
    assert r.json()["ops_owner"] is None


# --------------------------------------------------------------------------- L010 interviews
def test_interviews_lifecycle(owner_client, job):
    app = f.ApplicationFactory(job=job, stage="shortlisted")
    when = timezone.now() + dt.timedelta(days=2)
    r = owner_client.post(
        f"/api/v1/org/applications/{app.id}/interviews",
        {
            "scheduled_at": when.isoformat(),
            "mode": "trade_test",
            "location": "Kitchen",
            "interviewer_name": "Chef",
        },
        format="json",
    )
    assert r.status_code == 201, r.json()
    iv_id = r.json()["id"]
    assert r.json()["mode_label"] == "Trade test" and r.json()["outcome"] == "pending"
    app.refresh_from_db()
    assert app.stage == "interview" and abs((app.interview_at - when).total_seconds()) < 1
    # second round; interview_at stays at the next pending one
    later = when + dt.timedelta(days=3)
    owner_client.post(
        f"/api/v1/org/applications/{app.id}/interviews", {"scheduled_at": later.isoformat()}, format="json"
    )
    r = owner_client.patch(
        f"/api/v1/org/interviews/{iv_id}", {"outcome": "passed", "notes": "Good"}, format="json"
    )
    assert r.status_code == 200 and r.json()["outcome_label"] == "Passed"
    app.refresh_from_db()
    assert abs((app.interview_at - later).total_seconds()) < 1
    detail = owner_client.get(f"/api/v1/org/applications/{app.id}").json()
    assert len(detail["interviews"]) == 2
    # decided round cannot be deleted; pending can
    assert owner_client.delete(f"/api/v1/org/interviews/{iv_id}").status_code == 400
    second = Interview.objects.exclude(pk=iv_id).get()
    assert owner_client.delete(f"/api/v1/org/interviews/{second.id}").status_code == 204
    app.refresh_from_db()
    assert app.interview_at is not None  # falls back to the remaining (decided) round
    assert AuditLog.objects.filter(action="interview.create").count() == 2


def test_move_to_interview_creates_round(owner_client, job):
    app = f.ApplicationFactory(job=job, stage="shortlisted")
    when = timezone.now() + dt.timedelta(days=1)
    r = owner_client.post(
        f"/api/v1/org/applications/{app.id}/move",
        {"stage": "interview", "interview_at": when.isoformat()},
        format="json",
    )
    assert r.status_code == 200
    assert Interview.objects.filter(application=app).count() == 1


def test_interview_wrong_stage_and_worker_view(owner_client, job):
    app = f.ApplicationFactory(job=job, stage="sourced")
    r = owner_client.post(
        f"/api/v1/org/applications/{app.id}/interviews",
        {"scheduled_at": timezone.now().isoformat()},
        format="json",
    )
    assert r.status_code in (400, 404)  # sourced rows from ops are visible; stage not allowed
    user = f.UserFactory()
    w = worker(user=user, phone=user.phone)
    app2 = f.ApplicationFactory(job=job, worker=w, stage="shortlisted")
    owner_client.post(
        f"/api/v1/org/applications/{app2.id}/interviews",
        {
            "scheduled_at": (timezone.now() + dt.timedelta(days=1)).isoformat(),
            "mode": "phone",
            "notes": "secret",
        },
        format="json",
    )
    mine = auth_client(user).get("/api/v1/me/applications").json()["results"][0]
    assert mine["interviews"][0]["mode"] == "phone" and "notes" not in mine["interviews"][0]


def test_interview_reminder_task_skips_rescheduled(job):
    from apps.notifications.tasks import interview_reminder

    app = f.ApplicationFactory(job=job, stage="interview")
    when = timezone.now() + dt.timedelta(hours=2)
    iv = Interview.objects.create(application=app, scheduled_at=when)
    assert interview_reminder(str(app.id), interview_id=str(iv.id), scheduled_for=when.isoformat()) is True
    iv.scheduled_at = when + dt.timedelta(days=1)
    iv.save()
    assert interview_reminder(str(app.id), interview_id=str(iv.id), scheduled_for=when.isoformat()) is False
