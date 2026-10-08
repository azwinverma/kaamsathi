"""Employer pipeline extras: invitations (L004), tags (L008), assignment (L009), interviews (L010),
job requirements (J002)."""

from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from apps.core.exceptions import APIError, Duplicate, InvalidState

from . import labels as hiring_labels
from .models import Application, Interview, JobOpening, JobRequirement, StageEvent

M = hiring_labels.MESSAGES


# --------------------------------------------------------------------------- invitations (L004)
def past_worker_ids(organization) -> set:
    """Workers whose employment with this org has ended (the org may invite them back)."""
    from apps.workforce.models import Employment

    ended = set(
        Employment.objects.filter(organization=organization, status="ended").values_list(
            "worker_id", flat=True
        )
    )
    active = set(
        Employment.objects.filter(organization=organization, status="active").values_list(
            "worker_id", flat=True
        )
    )
    return ended - active


def worker_from_share(token: str):
    """Worker behind a valid (unexpired, unrevoked) Skill Passport share link, else ``None``."""
    try:
        from apps.credentials.models import PassportShare
    except ImportError:  # pragma: no cover
        return None
    share = (
        PassportShare.objects.select_related("worker")
        .filter(token=token, revoked_at__isnull=True, expires_at__gt=timezone.now())
        .first()
    )
    return share.worker if share else None


def notify_invited(application: Application) -> None:
    from .services import _safe_notify

    job, worker = application.job, application.worker
    org = job.organization.name
    body = f"{org} invites you to apply for {job.title} — confirm interest in the KaamSathi app."
    if worker.user_id:
        _safe_notify(
            worker.user,
            "application_invited",
            f"{org} invited you: {job.title}",
            body,
            title_ne=f"{org} ले तपाईंलाई {job.title} का लागि बोलाएको छ",
            body_ne=f"{org} ले तपाईंलाई {job.title} का लागि आमन्त्रण गरेको छ — KaamSathi एपमा रुचि पुष्टि गर्नुहोस्।",
            data={"application_id": str(application.id), "job_id": str(job.id)},
            link="/me/applications",
            sms=True,
        )
    else:
        from apps.notifications.services import send_sms

        send_sms(worker.phone, f"KaamSathi: {body}", kind="application_invited")


@transaction.atomic
def invite_worker(job: JobOpening, worker, user) -> Application:
    """``employer_invite`` application at ``shortlisted`` with ``worker_response=pending``."""
    from apps.orgs.kyb import MESSAGES as KYB_MESSAGES
    from apps.orgs.kyb import is_verified, kyb_required_for_shortlist

    if kyb_required_for_shortlist() and not is_verified(job.organization):
        raise InvalidState(message=str(KYB_MESSAGES["not_verified_shortlist"]))
    if job.status == "paused":
        raise InvalidState(message=str(M["job_paused"]))
    if job.status != "open":
        raise InvalidState(message=str(M["job_not_open"]))
    now = timezone.now()
    app = Application.objects.select_for_update().filter(job=job, worker=worker).first()
    if app is not None:
        if not (app.stage == "sourced" and app.source == "worker_interest"):
            raise Duplicate(message=str(M["already_in_pipeline"]))
        from_stage = "sourced"
        app.stage = "shortlisted"
        app.stage_changed_at = now
        app.source = "employer_invite"
        app.worker_response = "pending"
        app.responded_at = None
        app.sourced_by = user
        app.save()
    else:
        from_stage = None
        app = Application.objects.create(
            job=job,
            worker=worker,
            stage="shortlisted",
            source="employer_invite",
            worker_response="pending",
            sourced_by=user,
        )
    StageEvent.objects.create(
        application=app, from_stage=from_stage, to_stage="shortlisted", by=user, note="Invited by employer"
    )
    if not job.first_shortlist_at:
        job.first_shortlist_at = now
        job.save(update_fields=["first_shortlist_at"])
    notify_invited(app)
    return app


# --------------------------------------------------------------------------- tags / assignee
def clean_tags(value) -> list[str]:
    if not isinstance(value, list) or not all(isinstance(t, str) for t in value):
        raise APIError("validation_error", fields={"tags": ["Expected a list of text tags."]})
    out: list[str] = []
    for t in value:
        t = " ".join(t.split()).lower()[:30]
        if t and t not in out:
            out.append(t)
    if len(out) > Application.MAX_TAGS:
        raise APIError("validation_error", fields={"tags": [str(M["too_many_tags"])]})
    return out


def resolve_assignee(organization, user_id):
    if user_id in (None, ""):
        return None
    from apps.orgs.models import Membership

    m = (
        Membership.objects.select_related("user")
        .filter(organization=organization, user_id=user_id, is_active=True)
        .first()
        if _is_uuid(user_id)
        else None
    )
    if m is None:
        raise APIError("validation_error", fields={"assignee_id": [str(M["assignee_not_member"])]})
    return m.user


def _is_uuid(value) -> bool:
    import uuid

    try:
        uuid.UUID(str(value))
    except ValueError:
        return False
    return True


# --------------------------------------------------------------------------- interviews (L010)
def sync_interview_at(application: Application) -> None:
    """Keep ``Application.interview_at`` = next pending round (else the latest round, else null)."""
    rounds = list(application.interviews.order_by("scheduled_at"))
    pending = [r for r in rounds if r.outcome == "pending"]
    upcoming = [r for r in pending if r.scheduled_at >= timezone.now()]
    pick = (upcoming or pending or rounds[-1:] or [None])[0]
    value = pick.scheduled_at if pick else None
    if application.interview_at != value:
        application.interview_at = value
        application.save(update_fields=["interview_at"])


@transaction.atomic
def schedule_interview(application: Application, data: dict, user) -> Interview:
    from .services import move_application, schedule_interview_reminder

    application = Application.objects.select_for_update().get(pk=application.pk)
    if application.stage not in ("shortlisted", "interview"):
        raise InvalidState(message=str(M["interview_stage"]))
    interview = Interview.objects.create(application=application, created_by=user, **data)
    if application.stage == "shortlisted":
        # stage move without interview_at: the Interview row above is the only round created
        application, _ = move_application(application, "interview", user, note="Interview scheduled")
    sync_interview_at(application)
    schedule_interview_reminder(application, interview)
    return interview


@transaction.atomic
def update_interview(interview: Interview, data: dict) -> Interview:
    from .services import schedule_interview_reminder

    rescheduled = "scheduled_at" in data and data["scheduled_at"] != interview.scheduled_at
    for k, v in data.items():
        setattr(interview, k, v)
    interview.save()
    sync_interview_at(interview.application)
    if rescheduled and interview.outcome == "pending":
        schedule_interview_reminder(interview.application, interview)
    return interview


def interview_payload(iv: Interview) -> dict:
    from apps.core import labels
    from apps.core.bs import bs_str

    local = timezone.localtime(iv.scheduled_at)
    return {
        "id": str(iv.id),
        "application_id": str(iv.application_id),
        "scheduled_at": local.isoformat(),
        "scheduled_at_bs": bs_str(local.date()),
        "mode": iv.mode,
        "mode_label": labels.label(hiring_labels.INTERVIEW_MODE, iv.mode),
        "location": iv.location,
        "interviewer_name": iv.interviewer_name,
        "outcome": iv.outcome,
        "outcome_label": labels.label(hiring_labels.INTERVIEW_OUTCOME, iv.outcome),
        "notes": iv.notes,
        "created_at": timezone.localtime(iv.created_at).isoformat(),
        "updated_at": timezone.localtime(iv.updated_at).isoformat(),
    }


# --------------------------------------------------------------------------- requirements (J002)
def requirement_payload(req: JobRequirement, job=None) -> dict:
    from apps.core.serializers import trade_ref

    from .services import requirement_label

    kind_label = None
    if req.credential_kind:
        from apps.credentials import labels as cred_labels

        kind_label = str(cred_labels.KIND.get(req.credential_kind, req.credential_kind))
    return {
        "id": str(req.id),
        "trade": trade_ref(req.trade) if req.trade_id else None,
        "credential_kind": req.credential_kind,
        "credential_kind_label": kind_label,
        "nstb_level_min": req.nstb_level_min,
        "min_years": req.min_years,
        "required": req.required,
        "label": requirement_label(req, job),
    }


@transaction.atomic
def set_requirements(job: JobOpening, rows: list[dict]) -> None:
    """Replace the job's requirements with validated rows."""
    if len(rows) > JobRequirement.MAX_PER_JOB:
        raise APIError("validation_error", fields={"requirements": [str(M["too_many_requirements"])]})
    job.requirements.all().delete()
    JobRequirement.objects.bulk_create(
        [
            JobRequirement(
                job=job,
                trade=r.get("trade"),
                credential_kind=r.get("credential_kind") or None,
                nstb_level_min=r.get("nstb_level_min") or None,
                min_years=r.get("min_years"),
                required=r.get("required", True),
            )
            for r in rows
        ]
    )
