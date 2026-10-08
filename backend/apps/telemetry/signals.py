"""Server-side instrumentation of the key product events, wired with model signals.

Signals (instead of edits scattered through six apps' services) keep every tracking call in one
place and outside business transactions' failure paths: ``track()`` runs in a savepoint and
swallows its own errors. Bulk ``update()`` / ``bulk_create`` paths don't fire signals — none of
the tracked transitions use them today; if one is added, call ``apps.telemetry.track`` there.
"""

from __future__ import annotations

import logging

from django.db.models.signals import post_save, pre_save

from .services import track, track_once

logger = logging.getLogger("kaamsathi.telemetry")

_first_attendance_orgs: set = set()  # per-process memo to avoid a lookup per hajiri row


def _worker_subject(worker_id) -> str:
    return f"worker:{worker_id}"


def _safe(fn):
    def wrapper(*args, **kwargs):
        try:
            fn(*args, **kwargs)
        except Exception:  # noqa: BLE001 - instrumentation must never break a save
            logger.exception("telemetry signal %s failed", fn.__name__)

    wrapper.__name__ = fn.__name__
    return wrapper


def _stash(sender, instance, fields: tuple[str, ...]):
    """pre_save: remember previous values of ``fields`` on the instance."""
    if instance._state.adding or instance.pk is None:
        instance._tm_prev = {}
        return
    row = sender.objects.filter(pk=instance.pk).values(*fields).first() or {}
    instance._tm_prev = row


# ----------------------------------------------------------------------------- receivers
@_safe
def on_user(sender, instance, created, raw=False, **kwargs):
    if created and not raw:
        track(
            "user_registered",
            user=instance,
            subject=f"user:{instance.pk}",
            role="staff" if instance.is_staff else "user",
        )


@_safe
def on_org(sender, instance, created, raw=False, **kwargs):
    if created and not raw:
        track("org_created", organization=instance, subject=f"org:{instance.pk}", industry=instance.industry)


@_safe
def on_worker(sender, instance, created, raw=False, **kwargs):
    if raw:
        return
    subject = _worker_subject(instance.pk)
    user = instance.user if instance.user_id else None
    if created:
        track("worker_profile_created", user=user, subject=subject, source="self" if user else "assisted")
    if instance.id_front and instance.full_name:
        track_once("worker_onboarded", subject=subject, user=user, has_photo=bool(instance.photo))
    if instance.verification_status == "verified":
        track_once("worker_verified", subject=subject, user=user)


@_safe
def pre_job(sender, instance, raw=False, **kwargs):
    if not raw:
        _stash(sender, instance, ("status",))


@_safe
def on_job(sender, instance, created, raw=False, **kwargs):
    if raw:
        return
    prev = getattr(instance, "_tm_prev", {}).get("status")
    if instance.status == "open" and (created or prev != "open"):
        track(
            "job_published",
            user=instance.created_by if instance.created_by_id else None,
            organization=instance.organization,
            subject=f"org:{instance.organization_id}",
            job_id=str(instance.pk),
            trade=instance.trade_id,
            wage_type=instance.wage_type,
            openings=instance.openings_count,
        )


@_safe
def on_stage_event(sender, instance, created, raw=False, **kwargs):
    if not created or raw:
        return
    app = instance.application
    org = app.job.organization
    common = {
        "user": instance.by if instance.by_id else None,
        "organization": org,
        "subject": _worker_subject(app.worker_id),
        "application_id": str(app.pk),
        "job_id": str(app.job_id),
    }
    track("application_stage_changed", from_stage=instance.from_stage, to_stage=instance.to_stage, **common)
    if instance.to_stage == "joined":
        track("worker_placed", **common)


@_safe
def pre_application(sender, instance, raw=False, **kwargs):
    if not raw:
        _stash(sender, instance, ("worker_response",))


@_safe
def on_application(sender, instance, created, raw=False, **kwargs):
    if created or raw:
        return
    prev = getattr(instance, "_tm_prev", {}).get("worker_response")
    if instance.worker_response == "interested" and prev == "pending":
        track(
            "shortlist_accepted",
            organization=instance.job.organization,
            subject=_worker_subject(instance.worker_id),
            application_id=str(instance.pk),
            job_id=str(instance.job_id),
        )


@_safe
def on_attendance(sender, instance, created, raw=False, **kwargs):
    if not created or raw:
        return
    org_id = instance.employment.organization_id
    if org_id in _first_attendance_orgs:
        return
    _first_attendance_orgs.add(org_id)
    track_once(
        "first_attendance",
        organization=instance.employment.organization,
        user=instance.recorded_by if instance.recorded_by_id else None,
        method=instance.method,
    )


@_safe
def pre_payroll(sender, instance, raw=False, **kwargs):
    if not raw:
        _stash(sender, instance, ("status",))


@_safe
def on_payroll(sender, instance, created, raw=False, **kwargs):
    if raw:
        return
    prev = getattr(instance, "_tm_prev", {}).get("status")
    if instance.status == "approved" and prev != "approved":
        track(
            "payroll_approved",
            user=instance.approved_by if instance.approved_by_id else None,
            organization=instance.organization,
            subject=f"org:{instance.organization_id}",
            bs_year=instance.bs_year,
            bs_month=instance.bs_month,
        )


def connect():
    from django.apps import apps

    def model(label):
        try:
            return apps.get_model(label)
        except LookupError:
            return None

    wiring = [
        ("accounts.User", None, on_user),
        ("orgs.Organization", None, on_org),
        ("workers.Worker", None, on_worker),
        ("hiring.JobOpening", pre_job, on_job),
        ("hiring.StageEvent", None, on_stage_event),
        ("hiring.Application", pre_application, on_application),
        ("workforce.Attendance", None, on_attendance),
        ("payroll.PayrollRun", pre_payroll, on_payroll),
    ]
    for label, pre, post in wiring:
        m = model(label)
        if m is None:
            continue
        if pre is not None:
            pre_save.connect(pre, sender=m, dispatch_uid=f"telemetry-pre-{label}")
        post_save.connect(post, sender=m, dispatch_uid=f"telemetry-post-{label}")
