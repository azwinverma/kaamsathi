"""Serverless scheduler (apps/core/cron.py) + POST/GET /api/v1/internal/cron."""

import datetime as dt

import pytest
from celery.schedules import crontab
from django.core.cache import cache
from django.utils import timezone

from apps.core.cron import run_due
from apps.core.models import DeferredTask, FailedTask, ScheduledJobRun
from apps.core.tasks import HEARTBEAT_KEY, beat_heartbeat

pytestmark = pytest.mark.django_db

HEARTBEAT = "apps.core.tasks.beat_heartbeat"


@pytest.fixture
def schedule(settings):
    settings.CELERY_TASK_EAGER_PROPAGATES = False  # as with SERVERLESS
    settings.CELERY_BEAT_SCHEDULE = {
        "every-5": {"task": HEARTBEAT, "schedule": crontab(minute="*/5")},
        "daily": {"task": HEARTBEAT, "schedule": crontab(hour=1, minute=45)},
    }
    cache.delete(HEARTBEAT_KEY)
    return settings.CELERY_BEAT_SCHEDULE


def age(name, **delta):
    ScheduledJobRun.objects.filter(name=name).update(last_run_at=timezone.now() - dt.timedelta(**delta))


def test_first_sighting_only_starts_the_clock(schedule):
    out = run_due()
    assert out["ran"] == []
    assert set(ScheduledJobRun.objects.values_list("name", flat=True)) == {"every-5", "daily"}
    assert cache.get(HEARTBEAT_KEY) is None


def test_due_jobs_run_once(schedule):
    run_due()
    age("every-5", minutes=11)
    out = run_due()
    assert out["ran"] == [{"job": "every-5", "status": "ok"}]
    assert cache.get(HEARTBEAT_KEY)
    assert ScheduledJobRun.objects.get(name="every-5").last_status == "ok"
    assert run_due()["ran"] == []  # not due again yet


def test_missed_daily_window_runs_on_next_tick(schedule):
    run_due()
    age("daily", days=2)
    assert {"job": "daily", "status": "ok"} in run_due()["ran"]


def test_unknown_task_is_reported_not_raised(schedule, settings):
    settings.CELERY_BEAT_SCHEDULE = {"bad": {"task": "apps.core.tasks.nope", "schedule": crontab()}}
    run_due()
    age("bad", minutes=5)
    assert run_due()["ran"] == [{"job": "bad", "status": "unknown_task"}]


def test_budget_postpones_remaining_jobs(schedule):
    run_due()
    out = run_due(budget_seconds=-1)
    assert out["postponed"] == ["every-5", "daily"]


def test_deferred_tasks_run_when_due(schedule):
    now = timezone.now()
    due = DeferredTask.objects.create(task_name=HEARTBEAT, run_at=now - dt.timedelta(minutes=1))
    later = DeferredTask.objects.create(task_name=HEARTBEAT, run_at=now + dt.timedelta(hours=1))
    bad = DeferredTask.objects.create(task_name="apps.core.tasks.nope", run_at=now)
    out = run_due()
    assert {"task": HEARTBEAT, "status": "ok"} in out["deferred"]
    due.refresh_from_db(), later.refresh_from_db(), bad.refresh_from_db()
    assert (due.status, later.status, bad.status) == ("done", "pending", "failed")
    assert due.started_at and due.finished_at


def test_stuck_running_deferred_task_is_retried(schedule):
    old = timezone.now() - dt.timedelta(hours=1)
    stuck = DeferredTask.objects.create(task_name=HEARTBEAT, run_at=old, status="running", started_at=old)
    fresh = DeferredTask.objects.create(
        task_name=HEARTBEAT, run_at=old, status="running", started_at=timezone.now()
    )
    run_due()
    stuck.refresh_from_db(), fresh.refresh_from_db()
    assert stuck.status == "done"
    assert fresh.status == "running"  # another call is still on it


def test_failing_task_is_recorded_not_raised(schedule, monkeypatch):
    def boom():
        raise RuntimeError("sms gateway down")

    monkeypatch.setattr(beat_heartbeat, "run", boom)
    DeferredTask.objects.create(task_name=HEARTBEAT, run_at=timezone.now())
    assert run_due()["deferred"] == [{"task": HEARTBEAT, "status": "failed"}]
    assert FailedTask.objects.filter(task_name=HEARTBEAT).exists()


# --------------------------------------------------------------------------- endpoint
def test_endpoint_disabled_without_secret(api, settings, schedule):
    settings.CRON_SECRET = ""
    assert api.post("/api/v1/internal/cron").status_code == 404


def test_endpoint_requires_bearer_secret(api, settings, schedule):
    settings.CRON_SECRET = "c" * 32
    assert api.post("/api/v1/internal/cron").status_code == 401
    assert api.post("/api/v1/internal/cron", HTTP_AUTHORIZATION="Bearer nope").status_code == 401
    ok = {"HTTP_AUTHORIZATION": "Bearer " + "c" * 32}
    res = api.post("/api/v1/internal/cron", **ok)
    assert res.status_code == 200 and "ran" in res.json()
    assert api.get("/api/v1/internal/cron", **ok).status_code == 200  # Vercel Cron uses GET


# --------------------------------------------------------------------------- enqueue(eta) deferral
def test_serverless_enqueue_defers_future_tasks(settings, django_capture_on_commit_callbacks):
    from apps.notifications.services import enqueue

    settings.SERVERLESS = True
    eta = timezone.now() + dt.timedelta(hours=3)
    with django_capture_on_commit_callbacks(execute=True):
        enqueue(beat_heartbeat, eta=eta)
    item = DeferredTask.objects.get()
    assert (item.task_name, item.run_at, item.status) == (HEARTBEAT, eta, "pending")


def test_eager_enqueue_without_serverless_still_skips(settings, django_capture_on_commit_callbacks):
    from apps.notifications.services import enqueue

    settings.SERVERLESS = False
    with django_capture_on_commit_callbacks(execute=True):
        enqueue(beat_heartbeat, eta=timezone.now() + dt.timedelta(hours=3))
    assert not DeferredTask.objects.exists()
