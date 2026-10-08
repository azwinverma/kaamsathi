"""Webhook events from model changes (Application, Employment, PayrollRun, Timesheet).

Dispute and support-case events are emitted by their owning apps calling ``services.emit``.
Old values are captured in ``pre_save`` so only real transitions emit.
"""

from __future__ import annotations

import logging

from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

logger = logging.getLogger("kaamsathi.webhooks")


def _emit(org, event, payload):
    from .services import emit

    try:
        emit(org, event, payload)
    except Exception:  # noqa: BLE001 - webhooks must never break the domain write
        logger.exception("emit %s failed", event)


def _remember(instance, sender, fields):
    if instance._state.adding or not instance.pk:
        instance._ks_old = None
        return
    instance._ks_old = sender.objects.filter(pk=instance.pk).values(*fields).first()


def _old(instance, field):
    old = getattr(instance, "_ks_old", None)
    return None if old is None else old.get(field)


def employment_payload(e) -> dict:
    return {
        "employment_id": str(e.pk),
        "worker": {"id": str(e.worker_id), "full_name": e.worker.full_name},
        "designation": e.designation,
        "site_id": str(e.site_id) if e.site_id else None,
        "start_date": e.start_date.isoformat() if e.start_date else None,
        "end_date": e.end_date.isoformat() if e.end_date else None,
        "end_reason": e.end_reason,
        "status": e.status,
    }


def payroll_payload(run) -> dict:
    return {
        "payroll_run_id": str(run.pk),
        "bs_year": run.bs_year,
        "bs_month": run.bs_month,
        "period_start": run.period_start.isoformat(),
        "period_end": run.period_end.isoformat(),
        "status": run.status,
    }


def register():
    from apps.hiring.models import Application
    from apps.payroll.models import PayrollRun
    from apps.timesheets.models import Timesheet
    from apps.workforce.models import Employment

    @receiver(pre_save, sender=Application, weak=False, dispatch_uid="ks_wh_app_pre")
    def app_pre(sender, instance, **kwargs):
        _remember(instance, sender, ["stage"])

    @receiver(post_save, sender=Application, weak=False, dispatch_uid="ks_wh_app_post")
    def app_post(sender, instance, created, **kwargs):
        old = None if created else _old(instance, "stage")
        if created or old == instance.stage:
            return
        _emit(
            instance.job.organization_id,
            "application.stage_changed",
            {
                "application_id": str(instance.pk),
                "job_id": str(instance.job_id),
                "job_title": instance.job.title,
                "worker": {"id": str(instance.worker_id), "full_name": instance.worker.full_name},
                "from_stage": old,
                "to_stage": instance.stage,
            },
        )

    @receiver(pre_save, sender=Employment, weak=False, dispatch_uid="ks_wh_emp_pre")
    def emp_pre(sender, instance, **kwargs):
        _remember(instance, sender, ["status"])

    @receiver(post_save, sender=Employment, weak=False, dispatch_uid="ks_wh_emp_post")
    def emp_post(sender, instance, created, **kwargs):
        if created and instance.status == "active":
            _emit(instance.organization_id, "employment.started", employment_payload(instance))
        elif not created and instance.status == "ended" and _old(instance, "status") != "ended":
            _emit(instance.organization_id, "employment.ended", employment_payload(instance))

    @receiver(pre_save, sender=PayrollRun, weak=False, dispatch_uid="ks_wh_run_pre")
    def run_pre(sender, instance, **kwargs):
        _remember(instance, sender, ["status"])

    @receiver(post_save, sender=PayrollRun, weak=False, dispatch_uid="ks_wh_run_post")
    def run_post(sender, instance, created, **kwargs):
        old = None if created else _old(instance, "status")
        if old == instance.status:
            return
        if instance.status == "approved":
            _emit(instance.organization_id, "payroll.run_approved", payroll_payload(instance))
        elif instance.status == "paid":
            _emit(instance.organization_id, "payroll.run_paid", payroll_payload(instance))

    @receiver(pre_save, sender=Timesheet, weak=False, dispatch_uid="ks_wh_ts_pre")
    def ts_pre(sender, instance, **kwargs):
        _remember(instance, sender, ["status"])

    @receiver(post_save, sender=Timesheet, weak=False, dispatch_uid="ks_wh_ts_post")
    def ts_post(sender, instance, created, **kwargs):
        if instance.status != "approved" or (not created and _old(instance, "status") == "approved"):
            return
        e = instance.employment
        _emit(
            e.organization_id,
            "timesheet.approved",
            {
                "timesheet_id": str(instance.pk),
                "employment_id": str(e.pk),
                "worker": {"id": str(e.worker_id), "full_name": e.worker.full_name},
                "week_start": instance.week_start.isoformat(),
                "regular_minutes": instance.regular_minutes,
                "overtime_minutes_claimed": instance.overtime_minutes_claimed,
                "overtime_minutes_approved": instance.overtime_minutes_approved,
            },
        )
