"""Celery reliability: ``ReliableTask`` base, failed-task capture, beat heartbeat.

``ReliableTask`` is the app's default task class (``config/celery.py``):
* on an exception the task is retried with exponential backoff + full jitter (``max_retries=5``,
  2 s · 2^n capped at 1 h) — tasks opt out with ``reliable_autoretry = False`` or by using
  ``self.retry`` themselves (``Retry`` passes through untouched);
* ``acks_late`` + ``reject_on_worker_lost`` so a crashed worker doesn't lose the message;
* after the final failure a ``FailedTask`` row is written (args redacted: only ids, numbers and
  short slugs are kept) for ``/ops/system/failed-tasks`` (retry / dismiss);
* every outcome is counted in ``celery_tasks_total{task,state}``.
In eager mode (dev/tests) nothing is retried; failures are recorded and re-raised.
"""

from __future__ import annotations

import logging
import random
import re
import traceback as tb

from celery import Task, shared_task
from celery.exceptions import Ignore, Reject, Retry
from django.core.cache import cache
from django.utils import timezone

logger = logging.getLogger("kaamsathi.tasks")

HEARTBEAT_KEY = "ks:beat:last_heartbeat"
_UUID = re.compile(r"^[0-9a-fA-F]{8}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{12}$")
_SLUG = re.compile(r"^[a-z][a-z0-9_.\-]{0,39}$")
_SENSITIVE_KEY = re.compile(r"phone|code|token|secret|password|body|message|account|otp|key|email|name", re.I)
REDACTED = "[redacted]"


def _redact_value(value):
    if value is None or isinstance(value, (bool, int, float)):
        return value, False
    if isinstance(value, str) and (_UUID.match(value) or (_SLUG.match(value) and not value.isdigit())):
        return value, False
    if isinstance(value, (list, tuple)) and len(value) <= 50:
        out, red = [], False
        for v in value:
            rv, r = _redact_value(v)
            out.append(rv)
            red = red or r
        return out, red
    return REDACTED, True


def redact(args, kwargs) -> dict:
    redacted = False
    out_args = []
    for a in args or ():
        v, r = _redact_value(a)
        out_args.append(v)
        redacted = redacted or r
    out_kwargs = {}
    for k, a in (kwargs or {}).items():
        if _SENSITIVE_KEY.search(k) and a not in (None, "", True, False):
            out_kwargs[k], r = REDACTED, True
        else:
            out_kwargs[k], r = _redact_value(a)
        redacted = redacted or r
    return {"args": out_args, "kwargs": out_kwargs, "redacted": redacted}


def _count(task_name: str, state: str) -> None:
    try:
        from . import metrics

        metrics.inc("celery_tasks_total", task=task_name, state=state)
    except Exception:  # noqa: BLE001
        pass


def record_failure(task_name: str, task_id: str, args, kwargs, exc: BaseException) -> None:
    from django.db import transaction

    from .models import FailedTask

    try:
        with transaction.atomic():
            FailedTask.objects.create(
                task_name=task_name,
                task_id=task_id or "",
                args_redacted=redact(args, kwargs),
                exception=f"{type(exc).__name__}: {exc}"[:2000],
                traceback="".join(tb.format_exception(type(exc), exc, exc.__traceback__))[-20000:],
            )
    except Exception:  # noqa: BLE001 — never mask the original failure
        logger.exception("could not record failed task %s", task_name)


class ReliableTask(Task):
    max_retries = 5
    acks_late = True
    reject_on_worker_lost = True
    reliable_autoretry = True
    backoff_base = 2
    backoff_max = 3600

    def __call__(self, *args, **kwargs):
        try:
            result = super().__call__(*args, **kwargs)
        except (Retry, Ignore, Reject):
            _count(self.name, "retry")
            raise
        except Exception as exc:
            req = self.request
            eager = bool(getattr(req, "is_eager", False))
            retries = getattr(req, "retries", 0) or 0
            limit = self.max_retries if self.max_retries is not None else 5
            if not eager and self.reliable_autoretry and retries < limit:
                countdown = random.uniform(0, min(self.backoff_max, self.backoff_base * (2**retries)))  # noqa: S311
                _count(self.name, "retry")
                raise self.retry(exc=exc, countdown=countdown, max_retries=limit) from exc
            _count(self.name, "failure")
            record_failure(self.name, getattr(req, "id", "") or "", args, kwargs, exc)
            raise
        _count(self.name, "success")
        return result


@shared_task(name="apps.core.tasks.beat_heartbeat", reliable_autoretry=False)
def beat_heartbeat():
    """Every 5 min (beat): proves beat scheduled and a worker executed something."""
    now = timezone.now().isoformat()
    cache.set(HEARTBEAT_KEY, now, 60 * 60 * 24)
    return now


@shared_task(name="apps.core.tasks.purge_idempotency_records")
def purge_idempotency_records():
    from .idempotency import purge_expired

    return purge_expired()


def retry_failed(failed, user=None) -> str:
    """Re-send a FailedTask with its stored arguments. Raises InvalidState if args were redacted."""
    from celery import current_app

    from .exceptions import InvalidState

    data = failed.args_redacted or {}
    if data.get("redacted"):
        raise InvalidState(message="This task's arguments were redacted; re-run it from its source.")
    task = current_app.tasks.get(failed.task_name)
    if task is None:
        raise InvalidState(message="Unknown task.")
    args, kwargs = data.get("args") or [], data.get("kwargs") or {}
    try:
        if current_app.conf.task_always_eager:
            res = task.apply(
                args=args, kwargs=kwargs, throw=False
            )  # dev/tests: run inline, failure re-captured
        else:
            res = task.apply_async(args=args, kwargs=kwargs)
        task_id = res.id
    except Exception as exc:  # noqa: BLE001 — broker down
        raise InvalidState(message="Could not queue the task (broker unavailable).") from exc
    failed.retried_at = timezone.now()
    failed.retried_by = user if user is not None and getattr(user, "is_authenticated", False) else None
    failed.save(update_fields=["retried_at", "retried_by"])
    return task_id
