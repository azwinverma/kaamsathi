"""Hiring pipeline services."""

from __future__ import annotations

import datetime as dt

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from django.utils.translation import gettext as _

from apps.core.exceptions import APIError, BelowMinimumWage, InvalidState
from apps.core.money import D, format_npr

from .models import Application, JobOpening, MinimumWage, StageEvent


def validate_job_wage(wage_type: str, amount):
    mw = MinimumWage.current()
    if mw is None or amount in (None, ""):
        return
    minimum = mw.monthly_total if wage_type == "monthly" else mw.daily
    if D(amount) < minimum:
        msg = _("Wage must be at least %(amount)s (minimum wage).") % {"amount": format_npr(minimum)}
        raise BelowMinimumWage(message=msg, fields={"wage_amount": [msg]})


def refresh_job_fill_status(job: JobOpening):
    joined = job.applications.filter(stage="joined").count()
    if job.status == "open" and joined >= job.openings_count:
        job.status = "filled"
        job.save(update_fields=["status"])


def create_placement_charge(application: Application, employment):
    from apps.billing.models import Charge
    from apps.workforce.models import Employment

    org = application.job.organization
    replaced = (
        Employment.objects.filter(
            organization=org,
            status="ended",
            replacement_eligible_until__isnull=False,
            end_date__isnull=False,
            trade=application.job.trade,
            replacement_charges__isnull=True,
        )
        .exclude(pk=employment.pk)
        .order_by("-end_date")
    )
    replaced = next((e for e in replaced if e.end_date <= e.replacement_eligible_until), None)
    worker_name = application.worker.full_name
    if replaced is not None:
        return Charge.objects.create(
            organization=org,
            kind="placement",
            amount=D(settings.PLACEMENT_FEE),
            description=f"Placement: {worker_name} — {application.job.title} "
            f"(free replacement for {replaced.worker.full_name})",
            application=application,
            replaces_employment=replaced,
            status="waived",
        )
    return Charge.objects.create(
        organization=org,
        kind="placement",
        amount=D(settings.PLACEMENT_FEE),
        description=f"Placement: {worker_name} — {application.job.title}",
        application=application,
        status="unpaid",
    )


def schedule_interview_reminder(application: Application):
    from apps.notifications.services import enqueue
    from apps.notifications.tasks import interview_reminder

    if not application.interview_at:
        return
    eta = application.interview_at - dt.timedelta(hours=2)
    if eta <= timezone.now():
        return
    enqueue(interview_reminder, str(application.id), eta=eta)


@transaction.atomic
def move_application(
    application: Application,
    to_stage: str,
    user,
    *,
    note="",
    interview_at=None,
    rejection_reason=None,
    employment_data=None,
):
    """Move an application to a new stage. Returns (application, employment|None)."""
    from apps.workforce.services import create_employment

    application = (
        Application.objects.select_for_update().select_related("job", "worker").get(pk=application.pk)
    )
    from_stage = application.stage
    if not Application.can_move(from_stage, to_stage):
        raise InvalidState(
            message=_("Cannot move from %(from)s to %(to)s.") % {"from": from_stage, "to": to_stage}
        )
    employment = None
    if to_stage == "interview" and interview_at:
        application.interview_at = interview_at
    if to_stage == "rejected" and rejection_reason:
        application.rejection_reason = rejection_reason
    if to_stage == "joined":
        if not employment_data:
            raise APIError(
                "validation_error", fields={"employment": [_("Employment details are required to join.")]}
            )
        job = application.job
        data = dict(employment_data)
        data.setdefault("trade", job.trade)
        if data.get("site") is None:
            data["site"] = job.site
        if not data.get("designation"):
            data["designation"] = job.title
        data.setdefault("shift", job.shift)
        try:
            employment = create_employment(
                job.organization, application.worker, data, application=application
            )
        except BelowMinimumWage as exc:
            exc.fields = {f"employment.{k}": v for k, v in exc.fields.items()}
            raise
        create_placement_charge(application, employment)
    if note:
        application.notes = f"{application.notes}\n{note}".strip() if application.notes else note
    application.stage = to_stage
    application.stage_changed_at = timezone.now()
    application.save()
    StageEvent.objects.create(
        application=application, from_stage=from_stage, to_stage=to_stage, by=user, note=note or ""
    )
    if to_stage == "joined":
        refresh_job_fill_status(application.job)
    if to_stage == "interview":
        schedule_interview_reminder(application)
    return application, employment


@transaction.atomic
def shortlist_workers(job: JobOpening, workers, user) -> list[Application]:
    created = []
    for worker in workers:
        app, was_created = Application.objects.get_or_create(
            job=job, worker=worker, defaults={"stage": "shortlisted", "sourced_by": user}
        )
        if was_created:
            StageEvent.objects.create(
                application=app,
                from_stage=None,
                to_stage="shortlisted",
                by=user,
                note="Shortlisted by KaamSathi ops",
            )
            created.append(app)
    if created and not job.first_shortlist_at:
        job.first_shortlist_at = timezone.now()
        job.save(update_fields=["first_shortlist_at"])
    if created:
        from apps.notifications.services import enqueue
        from apps.notifications.tasks import notify_employer_shortlist

        enqueue(notify_employer_shortlist, str(job.id), len(created))
    return created


NSTB_POINTS = {"none": 0, "elementary": 0, "level1": 5, "level2": 10, "level3": 15}
NSTB_LABEL = {"level1": "NSTB Level 1", "level2": "NSTB Level 2", "level3": "NSTB Level 3"}


def match_score(job: JobOpening, worker) -> tuple[int, list[str]]:
    """Score 0–100: trade 50 + district 20 + verified 10 + NSTB 5/level (max 15)
    + experience 1/yr (max 10) − 10 if expected wage > offer."""
    score, reasons = 0, []
    skills = list(worker.skills.all())
    skill = next((s for s in skills if s.trade_id == job.trade_id), None)
    if skill:
        score += 50
        reasons.append("Trade match")
    job_district = job.site.district_id if job.site and job.site.district_id else job.organization.district_id
    if job_district and job_district in (worker.current_district_id, worker.permanent_district_id):
        score += 20
        reasons.append("Same district")
    if worker.verification_status == "verified":
        score += 10
        reasons.append("Verified")
    if skill:
        pts = NSTB_POINTS.get(skill.nstb_level, 0)
        if pts:
            score += pts
            reasons.append(NSTB_LABEL[skill.nstb_level])
        exp = min(skill.years_experience, 10)
        if exp:
            score += exp
            reasons.append(f"{skill.years_experience} yrs experience")
    if worker.expected_monthly_wage:
        offer = D(job.wage_amount) * (30 if job.wage_type == "daily" else 1)
        if D(worker.expected_monthly_wage) > offer:
            score -= 10
            reasons.append("Expects higher wage")
    return max(min(score, 100), 0), reasons
