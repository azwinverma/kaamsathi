"""First-party product analytics: ingestion (no-PII allowlist, batching), server events, funnels,
retention and k-anonymity."""

import datetime as dt

import pytest
from django.core.cache import cache
from django.utils import timezone

from apps import telemetry
from apps.telemetry import analytics, services
from apps.telemetry.models import Event

from .conftest import auth_client
from .factories import (
    ApplicationFactory,
    AttendanceFactory,
    EmploymentFactory,
    JobFactory,
    OrganizationFactory,
    UserFactory,
    WorkerFactory,
)

pytestmark = pytest.mark.django_db
URL = "/api/v1/telemetry/events"


@pytest.fixture(autouse=True)
def _clear_throttle():
    cache.clear()


def _ev(name="page_view", **kw):
    return {"name": name, "platform": "web", "anonymous_id": "anon-12345678", **kw}


# ------------------------------------------------------------------------------ ingestion
def test_anonymous_batch_is_accepted(api):
    res = api.post(
        URL, {"events": [_ev(properties={"page": "/login?next=/app"}), _ev("otp_requested")]}, format="json"
    )
    assert res.status_code == 202 and res.json() == {"accepted": 2}
    page = Event.objects.get(name="page_view")
    assert page.properties == {"page": "/login"}  # query string stripped
    assert page.user is None and page.subject == "anon:anon-12345678"


def test_authenticated_batch_links_user_and_member_org(owner, org):
    client = auth_client(owner, org)
    res = client.post(URL, [_ev("login_success", properties={"method": "otp"})], format="json")
    assert res.status_code == 202
    e = Event.objects.get(name="login_success")
    assert e.user == owner and e.organization == org and e.subject == f"user:{owner.pk}"


def test_foreign_org_header_is_ignored_not_rejected(db):
    user = UserFactory()
    client = auth_client(user, OrganizationFactory())
    assert client.post(URL, [_ev()], format="json").status_code == 202
    assert Event.objects.get(name="page_view").organization is None


@pytest.mark.parametrize(
    "props",
    [
        {"phone": "9812345678"},  # key not on the allowlist
        {"full_name": "Ram"},
        {"source": "call me on 9801234567"},  # allowed key, PII-looking value
        {"source": "ram@example.com"},
        {"source": {"nested": 1}},
        {"source": "x" * 121},
    ],
)
def test_pii_and_unknown_properties_are_rejected(api, props):
    res = api.post(URL, [_ev(properties=props)], format="json")
    assert res.status_code == 400 and res.json()["error"]["code"] == "validation_error"
    assert not Event.objects.exists()  # the whole batch is refused


def test_clients_cannot_send_server_or_unknown_events(api):
    for name in ("worker_placed", "payroll_approved", "made_up_event", "Bad-Name"):
        assert api.post(URL, [_ev(name)], format="json").status_code == 400


def test_batch_limit(api):
    assert api.post(URL, [_ev() for _ in range(50)], format="json").status_code == 202
    res = api.post(URL, [_ev() for _ in range(51)], format="json")
    assert res.status_code == 400
    assert api.post(URL, {"events": []}, format="json").status_code == 400


def test_future_or_ancient_timestamps_are_clamped(api):
    future = (timezone.now() + dt.timedelta(days=2)).isoformat()
    old = (timezone.now() - dt.timedelta(days=30)).isoformat()
    recent = (timezone.now() - dt.timedelta(hours=2)).isoformat()
    api.post(URL, [_ev(occurred_at=future), _ev(occurred_at=old), _ev(occurred_at=recent)], format="json")
    times = sorted(Event.objects.values_list("occurred_at", flat=True))
    assert timezone.now() - times[0] > dt.timedelta(hours=1)  # the plausible one kept
    assert all(abs(t - timezone.now()) < dt.timedelta(minutes=1) for t in times[1:])


def test_ingest_is_throttled(api, settings):
    settings.TELEMETRY_THROTTLE_RATE = "2/minute"
    codes = [api.post(URL, [_ev()], format="json").status_code for _ in range(3)]
    assert codes == [202, 202, 429]


# ------------------------------------------------------------------------- server events
def test_track_drops_unknown_props_and_never_raises(org):
    e = telemetry.track("job_published", organization=org, trade="mason", phone="9812345678", job_id="x")
    assert e.properties == {"trade": "mason", "job_id": "x"}
    assert telemetry.track("not_a_real_event") is None
    assert (
        services.track("worker_placed", subject="worker:1", source=object()) is not None
    )  # bad value dropped


def test_key_flows_are_instrumented(owner, org, site):
    from apps.hiring.services import move_application
    from apps.payroll.services import approve_run, create_run

    worker = WorkerFactory()
    assert Event.objects.filter(name="worker_profile_created", subject=f"worker:{worker.pk}").exists()
    worker.id_front = "worker-ids/front.jpg"
    worker.save()
    worker.verification_status = "verified"
    worker.save()
    worker.save()
    assert Event.objects.filter(name="worker_onboarded", subject=f"worker:{worker.pk}").count() == 1
    assert Event.objects.filter(name="worker_verified", subject=f"worker:{worker.pk}").count() == 1

    job = JobFactory(organization=org, status="draft")
    job.status = "open"
    job.save()
    job.save()
    assert Event.objects.filter(name="job_published", organization=org).count() == 1

    app = ApplicationFactory(job=job, worker=worker, stage="sourced")
    move_application(app, "shortlisted", owner)
    stage = Event.objects.get(name="application_stage_changed")
    assert stage.properties["to_stage"] == "shortlisted" and stage.properties["application_id"] == str(app.pk)
    assert stage.user == owner and stage.organization == org

    app.refresh_from_db()
    app.worker_response = "pending"
    app.save()
    app.worker_response = "interested"
    app.save()
    assert Event.objects.filter(name="shortlist_accepted").count() == 1

    emp = EmploymentFactory(organization=org)
    AttendanceFactory(employment=emp)
    AttendanceFactory(employment=emp, date=dt.date.today() - dt.timedelta(days=1))
    assert Event.objects.filter(name="first_attendance", organization=org).count() == 1

    from apps.core.bs import BSMonth

    month = BSMonth.of(dt.date.today()).previous()
    run = create_run(org, month.year, month.month)
    approve_run(run, owner)
    payroll = Event.objects.get(name="payroll_approved")
    assert payroll.organization == org and payroll.properties == {
        "bs_year": month.year,
        "bs_month": month.month,
    }


def test_registration_event_on_new_user(db):
    user = UserFactory()
    assert Event.objects.filter(name="user_registered", user=user).exists()


def test_tracking_can_be_disabled(settings, org):
    settings.TELEMETRY_ENABLED = False
    assert telemetry.track("org_created", organization=org) is None


# ------------------------------------------------------------------------------- funnels
def _mk(name, *, subject="", org=None, at=None, user=None, **props):
    return Event.objects.create(
        name=name,
        subject=subject,
        organization=org,
        user=user,
        properties=props,
        platform="server",
        occurred_at=at or timezone.now(),
    )


def test_funnel_is_sequential_and_k_anonymous(db):
    Event.objects.all().delete()
    t0 = timezone.now() - dt.timedelta(days=3)
    step = dt.timedelta(minutes=1)
    for i in range(12):  # 12 created
        s = f"worker:{i}"
        _mk("worker_profile_created", subject=s, at=t0)
        if i < 9:  # 9 onboarded
            _mk("worker_onboarded", subject=s, at=t0 + step)
        if i < 6:  # 6 verified
            _mk("worker_verified", subject=s, at=t0 + 2 * step)
        if i < 3:  # 3 shortlisted → suppressed
            _mk("application_stage_changed", subject=s, at=t0 + 3 * step, to_stage="shortlisted")
    # out of order: verified *before* onboarding never counts as reaching "verified"
    _mk("worker_verified", subject="worker:99", at=t0)
    _mk("worker_profile_created", subject="worker:99", at=t0 + step)

    assert analytics.funnel_counts("worker_onboarding", t0 - step) == [13, 9, 6, 3, 0]
    out = analytics.funnel("worker_onboarding", days=30)
    counts = [s["count"] for s in out["steps"]]
    assert counts == [13, 9, 6, None, 0]
    assert out["steps"][3]["suppressed"] is True
    assert out["steps"][1]["conversion_from_previous"] == round(9 / 13, 4)
    assert out["steps"][2]["conversion_from_start"] == round(6 / 13, 4)
    assert out["steps"][3]["conversion_from_previous"] is None  # derived from a suppressed count
    assert out["steps"][4]["conversion_from_previous"] is None


def test_funnel_window_excludes_old_events(db):
    old = timezone.now() - dt.timedelta(days=40)
    for i in range(6):
        _mk("worker_profile_created", subject=f"worker:old{i}", at=old)
    assert analytics.funnel("worker_onboarding", days=30)["steps"][0]["count"] == 0


def test_employer_and_hiring_funnels_key_by_org_and_application(db):
    orgs = [OrganizationFactory() for _ in range(5)]  # org_created tracked by the signal
    for o in orgs:
        _mk("job_published", org=o)
    out = analytics.funnel("employer_activation", days=7)
    assert [s["count"] for s in out["steps"]][:2] == [5, 5]
    for i in range(5):
        _mk(
            "application_stage_changed", subject=f"worker:{i}", application_id=f"a{i}", to_stage="shortlisted"
        )
        _mk("application_stage_changed", subject=f"worker:{i}", application_id=f"a{i}", to_stage="selected")
    assert [s["count"] for s in analytics.funnel("hiring", 7)["steps"]] == [5, 5, 0]


def test_ops_funnel_and_retention_endpoints(staff_client, org):
    res = staff_client.get("/api/v1/ops/analytics/funnel?name=employer_activation&days=30")
    assert res.status_code == 200 and res.json()["k_anonymity"] == 5
    assert staff_client.get("/api/v1/ops/analytics/funnel?name=nope").status_code == 400
    assert staff_client.get("/api/v1/ops/analytics/funnel?days=0").status_code == 400
    res = staff_client.get("/api/v1/ops/analytics/retention?cohort=week&weeks=4")
    assert res.status_code == 200 and len(res.json()["rows"]) == 4
    assert staff_client.get("/api/v1/ops/analytics/retention?cohort=month").status_code == 400
    worker_client = auth_client(UserFactory())
    assert worker_client.get("/api/v1/ops/analytics/funnel").status_code == 403


# ------------------------------------------------------------------------------ retention
def test_weekly_retention_with_suppression(db):
    Event.objects.all().delete()
    now = timezone.now()
    this_monday = analytics._week_start(now)
    cohort_start = timezone.make_aware(dt.datetime.combine(this_monday - dt.timedelta(weeks=2), dt.time(12)))
    big = [UserFactory() for _ in range(8)]
    small = [UserFactory() for _ in range(3)]
    Event.objects.all().delete()  # drop user_registered from the factories
    for u in big:
        _mk("login_success", user=u, at=cohort_start)
    for u in big[:6]:  # 6 back in week 1
        _mk("login_success", user=u, at=cohort_start + dt.timedelta(weeks=1))
    for u in big[:2]:  # 2 back in week 2 → suppressed
        _mk("login_success", user=u, at=cohort_start + dt.timedelta(weeks=2))
    for u in small:  # cohort of 3 → whole row suppressed
        _mk("login_success", user=u, at=cohort_start + dt.timedelta(weeks=1))

    out = analytics.retention(weeks=3)
    rows = {r["cohort_start"]: r for r in out["rows"]}
    big_row = rows[(this_monday - dt.timedelta(weeks=2)).isoformat()]
    assert big_row["size"] == 8
    assert [w["retained"] for w in big_row["weeks"]] == [8, 6, None]
    assert big_row["weeks"][1]["rate"] == 0.75
    small_row = rows[(this_monday - dt.timedelta(weeks=1)).isoformat()]
    assert small_row["suppressed"] is True and small_row["size"] is None
    assert all(w["retained"] is None for w in small_row["weeks"])


def test_purge_old_events(db):
    keep = _mk("login_success")
    old = _mk("login_success")
    Event.objects.filter(pk=old.pk).update(received_at=timezone.now() - dt.timedelta(days=401))
    assert services.purge_old_events() == 1
    assert list(Event.objects.filter(name="login_success").values_list("pk", flat=True)) == [keep.pk]
