"""HTTP-driven scheduler for hosting without ``celery beat`` / workers (``SERVERLESS``, Vercel).

An external timer (cron-job.org every 5 min, GitHub Actions, Vercel Cron) calls
``POST /api/v1/internal/cron`` with ``Authorization: Bearer <CRON_SECRET>``. Each call:

1. runs every ``CELERY_BEAT_SCHEDULE`` entry that is due since its last run (``ScheduledJobRun``),
   so the schedule in settings stays the single source of truth for both hosting modes;
2. runs ``DeferredTask`` rows whose ``run_at`` has passed (tasks queued with a future ``eta``).

Runs are claimed with a compare-and-swap update, so overlapping calls never run a job twice.
A job seen for the first time only starts its clock (no burst of every daily job on first
deploy). Missed windows run once on the next call. Work stops after ``budget_seconds`` and the
rest continues on the next call. Task failures are captured by ``ReliableTask`` (FailedTask).
"""

from __future__ import annotations

import datetime as dt
import importlib
import logging
import time

from celery import current_app
from celery.schedules import maybe_schedule
from django.conf import settings
from django.utils import timezone

from .models import DeferredTask, ScheduledJobRun

logger = logging.getLogger("kaamsathi.cron")

DEFERRED_BATCH = 50
STUCK_AFTER = dt.timedelta(minutes=15)


def _task(name: str):
    try:
        return current_app.tasks[name]
    except KeyError:
        module, _, _attr = name.rpartition(".")
        importlib.import_module(module)  # registers the module's @shared_task functions
        return current_app.tasks[name]


def _run(name: str, args, kwargs) -> str:
    try:
        task = _task(name)
    except (KeyError, ImportError):
        logger.error("cron: unknown task %s", name)
        return "unknown_task"
    result = task.apply(args=list(args or ()), kwargs=dict(kwargs or {}), throw=False)
    return "failed" if result.failed() else "ok"


def run_due(*, budget_seconds: float = 240.0) -> dict:
    started = time.monotonic()
    out: dict = {"ran": [], "deferred": [], "postponed": []}

    def over_budget() -> bool:
        return time.monotonic() - started > budget_seconds

    for name, entry in settings.CELERY_BEAT_SCHEDULE.items():
        if over_budget():
            out["postponed"].append(name)
            continue
        now = timezone.now()
        row, created = ScheduledJobRun.objects.get_or_create(
            name=name, defaults={"last_run_at": now, "last_status": "scheduled"}
        )
        if created or not maybe_schedule(entry["schedule"]).is_due(row.last_run_at).is_due:
            continue
        claimed = ScheduledJobRun.objects.filter(name=name, last_run_at=row.last_run_at).update(
            last_run_at=now, last_status="running"
        )
        if not claimed:
            continue  # another call took it
        status = _run(entry["task"], entry.get("args"), entry.get("kwargs"))
        ScheduledJobRun.objects.filter(name=name).update(last_status=status)
        out["ran"].append({"job": name, "status": status})

    # A call that died mid-task (function timeout) leaves rows "running": give them another go.
    DeferredTask.objects.filter(
        status=DeferredTask.RUNNING, started_at__lte=timezone.now() - STUCK_AFTER
    ).update(status=DeferredTask.PENDING)
    due = DeferredTask.objects.filter(status=DeferredTask.PENDING, run_at__lte=timezone.now())
    for item in due.order_by("run_at")[:DEFERRED_BATCH]:
        if over_budget():
            break
        if not DeferredTask.objects.filter(pk=item.pk, status=DeferredTask.PENDING).update(
            status=DeferredTask.RUNNING, started_at=timezone.now()
        ):
            continue
        status = _run(item.task_name, item.args, item.kwargs)
        DeferredTask.objects.filter(pk=item.pk).update(
            status=DeferredTask.DONE if status == "ok" else DeferredTask.FAILED, finished_at=timezone.now()
        )
        out["deferred"].append({"task": item.task_name, "status": status})

    out["seconds"] = round(time.monotonic() - started, 2)
    return out


def defer(task, args, kwargs, eta) -> DeferredTask:
    return DeferredTask.objects.create(task_name=task.name, args=list(args), kwargs=dict(kwargs), run_at=eta)
