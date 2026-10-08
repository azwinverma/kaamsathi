"""Hiring pipeline services."""

from __future__ import annotations

import datetime as dt
from decimal import ROUND_HALF_UP

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
    minimum = {"monthly": mw.monthly_total, "hourly": mw.hourly}.get(wage_type, mw.daily)
    if D(amount) < minimum:
        msg = _("Wage must be at least %(amount)s (minimum wage).") % {"amount": format_npr(minimum)}
        raise BelowMinimumWage(message=msg, fields={"wage_amount": [msg]})


def refresh_job_fill_status(job: JobOpening):
    joined = job.applications.filter(stage="joined").count()
    if job.status == "open" and joined >= job.openings_count:
        job.status = "filled"
        job.save(update_fields=["status"])


def placement_fee(org):
    """Plan-based placement fee (apps.billing), falling back to ``settings.PLACEMENT_FEE``."""
    try:
        from apps.billing.services import placement_fee_for
    except ImportError:  # pragma: no cover
        return D(settings.PLACEMENT_FEE)
    try:
        fee = placement_fee_for(org)
    except Exception:  # noqa: BLE001 - billing plan not configured → contract default
        fee = None
    return D(fee) if fee is not None else D(settings.PLACEMENT_FEE)


def _track(name, *, user=None, organization=None, **props):
    try:
        from apps.telemetry import track
    except ImportError:  # pragma: no cover
        return
    track(name, user=user, organization=organization, **props)


def create_placement_charge(application: Application, employment):
    from apps.billing.models import Charge
    from apps.workforce.models import Employment

    org = application.job.organization
    fee = placement_fee(org)
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
            amount=fee,
            description=f"Placement: {worker_name} — {application.job.title} "
            f"(free replacement for {replaced.worker.full_name})",
            application=application,
            replaces_employment=replaced,
            status="waived",
        )
    return Charge.objects.create(
        organization=org,
        kind="placement",
        amount=fee,
        description=f"Placement: {worker_name} — {application.job.title}",
        application=application,
        status="unpaid",
    )


def schedule_interview_reminder(application: Application, interview=None):
    """SMS reminder 2 h before the interview. With ``interview`` the task re-checks that round is
    still pending at that time (a reschedule queues a new reminder; the stale one no-ops)."""
    from apps.notifications.services import enqueue
    from apps.notifications.tasks import interview_reminder

    when = interview.scheduled_at if interview is not None else application.interview_at
    if not when:
        return
    eta = when - dt.timedelta(hours=2)
    if eta <= timezone.now():
        return
    if interview is not None:
        enqueue(
            interview_reminder,
            str(application.id),
            interview_id=str(interview.id),
            scheduled_for=when.isoformat(),
            eta=eta,
        )
    else:
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
    if to_stage == "interview" and interview_at:
        # Compatibility: the single ``interview_at`` of a stage move becomes an Interview round (L010).
        from .models import Interview

        interview = Interview.objects.create(
            application=application, scheduled_at=interview_at, created_by=user
        )
        schedule_interview_reminder(application, interview)
    return application, employment


def notify_worker_shortlisted(application: Application) -> None:
    """Ask the worker to confirm interest: inbox + SMS via notify(); plain SMS when that's unavailable."""
    job, worker = application.job, application.worker
    org_name = job.organization.name
    title = f"Shortlisted for {job.title} at {org_name}"
    body = f"Shortlisted for {job.title} at {org_name} — confirm interest in the KaamSathi app."
    title_ne = f"{org_name} मा {job.title} का लागि छनोट भयो"
    body_ne = f"{org_name} मा {job.title} का लागि तपाईं छनोट हुनुभयो — KaamSathi एपमा रुचि पुष्टि गर्नुहोस्।"
    if worker.user_id:
        try:
            from apps.notifications.services import notify  # noqa: PLC0415
        except ImportError:
            notify = None
        if notify is not None:
            notify(
                worker.user,
                "application_shortlisted",
                title,
                body,
                title_ne=title_ne,
                body_ne=body_ne,
                data={"application_id": str(application.id), "job_id": str(job.id)},
                link="/me/applications",
                sms=True,
            )
            return
    from apps.notifications.services import send_sms

    send_sms(worker.phone, f"KaamSathi: {body}", kind="shortlist")


@transaction.atomic
def shortlist_workers(job: JobOpening, workers, user) -> list[Application]:
    """Shortlist workers to a job. Existing ``sourced`` rows (e.g. worker interest) are promoted.

    Returns the applications that became newly visible to the employer.
    """
    from . import labels as hiring_labels
    from .matching import score_for_shortlist

    if job.status == "paused":
        raise InvalidState(message=str(hiring_labels.MESSAGES["job_paused"]))
    created = []
    now = timezone.now()
    for worker in workers:
        score, version = score_for_shortlist(job, worker)
        app, was_created = Application.objects.get_or_create(
            job=job,
            worker=worker,
            defaults={
                "stage": "shortlisted",
                "sourced_by": user,
                "worker_response": "pending",
                "match_score": score,
                "match_algorithm_version": version,
            },
        )
        if not was_created:
            if app.stage != "sourced":
                continue
            app.stage = "shortlisted"
            app.stage_changed_at = now
            app.worker_response = "pending"
            app.responded_at = None
            app.match_score = score
            app.match_algorithm_version = version
            app.save(
                update_fields=[
                    "stage",
                    "stage_changed_at",
                    "worker_response",
                    "responded_at",
                    "match_score",
                    "match_algorithm_version",
                ]
            )
        StageEvent.objects.create(
            application=app,
            from_stage=None if was_created else "sourced",
            to_stage="shortlisted",
            by=user,
            note="Shortlisted by KaamSathi ops",
        )
        created.append(app)
    if created and not job.first_shortlist_at:
        job.first_shortlist_at = now
        job.save(update_fields=["first_shortlist_at"])
    if created:
        from apps.notifications.services import enqueue
        from apps.notifications.tasks import notify_employer_shortlist

        enqueue(notify_employer_shortlist, str(job.id), len(created))
        for app in created:
            notify_worker_shortlisted(app)
    return created


# --------------------------------------------------------------------------- matching (v2.1)
NSTB_RANK = {"none": 0, "elementary": 0, "level1": 1, "level2": 2, "level3": 3}
NSTB_POINTS = {"none": 0, "elementary": 0, "level1": 5, "level2": 10, "level3": 15}  # default weights
NSTB_LABEL = {"level1": "NSTB Level 1", "level2": "NSTB Level 2", "level3": "NSTB Level 3"}
STAYED_DAYS = 90


def _reliability_score(worker) -> int | None:
    from django.core.exceptions import ObjectDoesNotExist

    try:
        return worker.trust.reliability_score
    except ObjectDoesNotExist:
        return None


def job_district_id(job: JobOpening):
    return job.site.district_id if job.site and job.site.district_id else job.organization.district_id


def outcome_bonus(worker, today=None, max_points: int = 5) -> int:
    """0–max: max × share of past placements that stayed ≥ 90 days (needs ≥ 1 placement to judge)."""
    from apps.core.bs import today_ad

    today = today or today_ad()
    judged, stayed = 0, 0
    for e in worker.employments.all():
        days = ((e.end_date or today) - e.start_date).days
        if e.status == "ended" or days >= STAYED_DAYS:
            judged += 1
            stayed += days >= STAYED_DAYS
    if not judged:
        return 0
    return int((D(max_points) * stayed / judged).quantize(D("1"), rounding=ROUND_HALF_UP))


def declined_worker_ids(organization) -> set:
    """Workers who declined a shortlist from this employer before."""
    return set(
        Application.objects.filter(job__organization=organization, worker_response="declined").values_list(
            "worker_id", flat=True
        )
    )


def verified_credential_kinds(worker_ids) -> dict:
    """{worker_id: {kind, …}} of verified, unexpired credentials (J002 requirement checks)."""
    from django.db.models import Q

    from apps.core.bs import today_ad

    try:
        from apps.credentials.models import Credential
    except ImportError:  # pragma: no cover
        return {}
    out: dict = {}
    rows = (
        Credential.objects.filter(worker_id__in=list(worker_ids), status="verified")
        .filter(Q(expires_on__isnull=True) | Q(expires_on__gte=today_ad()))
        .values_list("worker_id", "kind")
    )
    for wid, kind in rows:
        out.setdefault(wid, set()).add(kind)
    return out


def requirement_label(req, job=None) -> str:
    """Plain-English summary, e.g. "Cook · NSTB Level 2+ · 3+ yrs · verified Safety certificate"."""
    parts = []
    trade = req.trade or (job.trade if job is not None and (req.nstb_level_min or req.min_years) else None)
    if trade is not None:
        parts.append(trade.name_en)
    if req.nstb_level_min:
        parts.append(f"{NSTB_LABEL.get(req.nstb_level_min, req.nstb_level_min)}+")
    if req.min_years:
        parts.append(f"{req.min_years}+ yrs")
    if req.credential_kind:
        from apps.credentials import labels as cred_labels

        kind = cred_labels.KIND.get(req.credential_kind, req.credential_kind)
        parts.append(f"verified {kind}")
    return " · ".join(str(p) for p in parts)


def requirement_checks(job: JobOpening, worker, *, verified_kinds: set | None = None) -> list[dict]:
    """[{id, label, required, met}] for each JobRequirement (J002)."""
    reqs = list(job.requirements.all())
    if not reqs:
        return []
    if verified_kinds is None:
        verified_kinds = verified_credential_kinds([worker.pk]).get(worker.pk, set())
    skills = {s.trade_id: s for s in worker.skills.all()}
    out = []
    for req in reqs:
        met = True
        if req.trade_id or req.nstb_level_min or req.min_years:
            skill = skills.get(req.trade_id or job.trade_id)
            met = skill is not None
            if met and req.min_years:
                met = skill.years_experience >= req.min_years
            if met and req.nstb_level_min:
                met = NSTB_RANK.get(skill.nstb_level, 0) >= NSTB_RANK.get(req.nstb_level_min, 0)
        if req.credential_kind:
            met = met and req.credential_kind in verified_kinds
        out.append(
            {"id": str(req.id), "label": requirement_label(req, job), "required": req.required, "met": met}
        )
    return out


def match_explain(
    job: JobOpening,
    worker,
    *,
    declined_ids: set | None = None,
    weights: dict | None = None,
    verified_kinds: set | None = None,
    checks: list | None = None,
) -> tuple[int, list[str], dict]:
    """(score 0–100, reasons, {component: points}) — algorithm ``matching.ALGORITHM_VERSION``.

    Default weights (``MatchConfig``, ops-editable): trade 50 + district 20 + verified 10 + NSTB 5/level
    (max 15) + experience 1/yr (max 10) + floor(reliability × 5 / 100) + preferred district 5 +
    outcomes 0–5 + 5 per met job requirement − 10 expected wage > offer − 10 declined this employer
    before; clamped to 0–100.
    """
    from .matching import current_weights

    w = weights or current_weights()
    reasons: list[str] = []
    explain: dict[str, int] = {}

    def add(component: str, points: int, reason: str | None = None):
        if not points:
            return
        explain[component] = explain.get(component, 0) + points
        if reason:
            reasons.append(reason)

    skills = list(worker.skills.all())
    skill = next((s for s in skills if s.trade_id == job.trade_id), None)
    if skill:
        add("trade", w["trade"], "Trade match")
    district_id = job_district_id(job)
    if district_id and district_id in (worker.current_district_id, worker.permanent_district_id):
        add("district", w["district"], "Same district")
    if worker.verification_status == "verified":
        add("verified", w["verified"], "Verified")
    if skill:
        add(
            "nstb", NSTB_RANK.get(skill.nstb_level, 0) * w["nstb_per_level"], NSTB_LABEL.get(skill.nstb_level)
        )
        exp = min(skill.years_experience * w["experience_per_year"], w["experience_max"])
        add("experience", exp, f"{skill.years_experience} yrs experience")
    reliability = _reliability_score(worker)
    if reliability is not None:
        bonus = reliability * w["reliability_max"] // 100  # 0–5 by default (= reliability // 20)
        add("reliability", bonus, "Reliable" if bonus >= 4 * w["reliability_max"] / 5 else None)
    if district_id and any(d.pk == district_id for d in worker.preferred_districts.all()):
        add("preferred_district", w["preferred_district"], "Prefers this area")
    outcomes = outcome_bonus(worker, max_points=w["outcomes_max"])
    add("outcomes", outcomes, "Stays in jobs" if outcomes and outcomes >= 3 * w["outcomes_max"] / 5 else None)
    if checks is None:
        checks = requirement_checks(job, worker, verified_kinds=verified_kinds)
    for c in checks:
        if c["met"]:
            add("requirements", w["requirement_met"], f"Meets: {c['label']}")
    if worker.expected_monthly_wage:
        offer = D(job.wage_amount) * (30 if job.wage_type == "daily" else 1)
        if D(worker.expected_monthly_wage) > offer:
            add("wage", -w["wage_penalty"], "Expects higher wage")
    if declined_ids is None:
        declined = Application.objects.filter(
            job__organization_id=job.organization_id, worker=worker, worker_response="declined"
        ).exists()
    else:
        declined = worker.pk in declined_ids
    if declined:
        add("declined_before", -w["declined_penalty"], "Declined this employer before")
    return max(min(sum(explain.values()), 100), 0), reasons, explain


def match_score(job: JobOpening, worker) -> tuple[int, list[str]]:
    """Score 0–100 and reasons (see ``match_explain``)."""
    score, reasons, _explain = match_explain(job, worker)
    return score, reasons


def score_candidates(job: JobOpening) -> list[dict]:
    """All eligible candidates scored and ranked (unpersisted). Workers failing a *required* job
    requirement are excluded. Each item: {worker, score, reasons, explain, requirements}."""
    from apps.workers.models import Worker
    from apps.workers.serializers import card_queryset

    from .matching import current_weights

    in_pipeline = Application.employer_visible(job.applications.all()).values_list("worker_id", flat=True)
    busy = Worker.objects.filter(employments__organization=job.organization, employments__status="active")
    candidates = list(
        card_queryset(
            Worker.objects.filter(is_available=True).exclude(id__in=in_pipeline).exclude(id__in=busy)
        )
        .prefetch_related("preferred_districts")
        .distinct()
    )
    declined = declined_worker_ids(job.organization)
    weights = current_weights()
    has_reqs = job.requirements.exists()
    kinds = verified_credential_kinds([w.pk for w in candidates]) if has_reqs else {}
    scored = []
    for w in candidates:
        checks = requirement_checks(job, w, verified_kinds=kinds.get(w.pk, set())) if has_reqs else []
        if any(c["required"] and not c["met"] for c in checks):
            continue
        score, reasons, explain = match_explain(job, w, declined_ids=declined, weights=weights, checks=checks)
        scored.append(
            {"worker": w, "score": score, "reasons": reasons, "explain": explain, "requirements": checks}
        )
    scored.sort(key=lambda x: (-x["score"], x["worker"].full_name))
    return scored


def job_matches(
    job: JobOpening, limit: int = 20, request=None, *, persist: bool = False, refresh: bool = False
):
    """``GET /ops/jobs/{id}/matches`` rows: available workers not yet in the employer-visible
    pipeline (workers who only expressed interest are included and flagged ``interested``).

    With ``persist`` the scoring is stored as a ``MatchRun`` (reused for 10 minutes unless
    ``refresh``) and rows carry ``run_id`` and ``rank``.
    """
    from .matching import rows_from_run, run_for

    if persist:
        run = run_for(job, user=getattr(request, "user", None), refresh=refresh)
        return rows_from_run(run, limit, request)
    from apps.workers.serializers import worker_card

    interested = set(
        job.applications.filter(stage="sourced", source="worker_interest").values_list("worker_id", flat=True)
    )
    return [
        {
            "worker": worker_card(c["worker"], request),
            "score": c["score"],
            "reasons": c["reasons"],
            "explain": c["explain"],
            "requirements": c["requirements"],
            "interested": c["worker"].pk in interested,
            "rank": i + 1,
        }
        for i, c in enumerate(score_candidates(job)[:limit])
    ]


# --------------------------------------------------------------------------- worker side
def employer_verified(organization) -> bool:
    return getattr(organization, "verification_status", None) == "verified"


def recommended_jobs(worker):
    """Open jobs from verified employers in the worker's trades and areas, not already in their pipeline."""
    from django.db.models import Q

    trade_ids = list(worker.skills.values_list("trade_id", flat=True))
    districts = set(worker.preferred_districts.values_list("pk", flat=True))
    if worker.current_district_id:
        districts.add(worker.current_district_id)
    if not trade_ids or not districts:
        return JobOpening.objects.none()
    return (
        JobOpening.objects.filter(
            status="open",
            trade_id__in=trade_ids,
            organization__is_active=True,
            organization__verification_status="verified",
        )
        .filter(
            Q(site__district_id__in=districts)
            | (Q(site__isnull=True) | Q(site__district__isnull=True))
            & Q(organization__district_id__in=districts)
        )
        .exclude(applications__worker=worker)
        .select_related("trade", "site__district", "organization__district", "shift")
        .order_by("-published_at", "-created_at")
    )


@transaction.atomic
def express_interest(worker, job: JobOpening, user) -> tuple[Application, bool]:
    """Worker taps "I'm interested": a ``sourced`` application the employer can't see until ops
    shortlists it. Idempotent for an existing interest row."""
    from django.utils.translation import pgettext

    if job.status != "open" or not employer_verified(job.organization):
        raise InvalidState(message=pgettext("growth", "This job is not taking applications."))
    existing = Application.objects.filter(job=job, worker=worker).first()
    if existing is not None:
        if existing.source == "worker_interest":
            return existing, False
        raise APIError("duplicate", message=pgettext("growth", "You are already in this job's pipeline."))
    app = Application.objects.create(
        job=job,
        worker=worker,
        stage="sourced",
        source="worker_interest",
        worker_response="interested",
        responded_at=timezone.now(),
    )
    StageEvent.objects.create(
        application=app, from_stage=None, to_stage="sourced", by=user, note="Worker expressed interest"
    )
    return app, True


@transaction.atomic
def respond_to_application(application: Application, response: str, user, note: str = "") -> Application:
    """Worker confirms (``interested``) or declines a shortlist. Declining drops the application."""
    from django.utils.translation import pgettext

    application = (
        Application.objects.select_for_update().select_related("job__organization").get(pk=application.pk)
    )
    if application.stage in Application.TERMINAL:
        raise InvalidState(message=pgettext("growth", "This application is already closed."))
    application.worker_response = response
    application.responded_at = timezone.now()
    application.save(update_fields=["worker_response", "responded_at"])
    if response == "declined":
        text = "Declined by worker" + (f": {note}" if note else "")
        if application.stage == "sourced":  # withdrawing own interest (never seen by the employer)
            application.stage = "dropped"
            application.stage_changed_at = timezone.now()
            application.notes = f"{application.notes}\n{text}".strip() if application.notes else text
            application.save(update_fields=["stage", "stage_changed_at", "notes"])
            StageEvent.objects.create(
                application=application, from_stage="sourced", to_stage="dropped", by=user, note=text
            )
        else:
            application, _ = move_application(application, "dropped", user, note=text)
    elif note:
        text = f"Worker confirmed interest: {note}"
        application.notes = f"{application.notes}\n{text}".strip() if application.notes else text
        application.save(update_fields=["notes"])
    return application


# --------------------------------------------------------------------------- offers (EMP-07)
OFFER_DEFAULT_DAYS = 3


def _safe_notify(user, kind, title, body, *, title_ne=None, body_ne=None, link=None, data=None, sms=False):
    """notify() when available; plain SMS fallback only when ``sms`` was requested."""
    if user is None:
        return
    try:
        from apps.notifications.services import notify  # noqa: PLC0415
    except ImportError:
        notify = None
    if notify is not None:
        notify(user, kind, title, body, title_ne=title_ne, body_ne=body_ne, data=data, link=link, sms=sms)
    elif sms and getattr(user, "phone", None):
        from apps.notifications.services import send_sms

        send_sms(user.phone, f"KaamSathi: {body}", kind=kind)


def expire_offers(qs=None) -> int:
    """Lazy expiry (no beat entry): sent offers past ``expires_at`` become ``expired``."""
    from .models import JobOffer

    qs = JobOffer.objects.all() if qs is None else qs
    return qs.filter(status="sent", expires_at__lte=timezone.now()).update(status="expired")


def offer_monthly_amount(offer) -> D:
    if offer.wage_type == "daily":
        return D(offer.daily_wage or 0) * 30
    if offer.wage_type == "hourly":
        return D(offer.hourly_wage or 0) * 8 * 30
    return D(offer.basic_salary or 0) + D(offer.dearness_allowance or 0)


@transaction.atomic
def send_offer(application: Application, data: dict, user):
    """Create an offer for a ``selected`` candidate. ``data`` = validated OfferInput."""
    from django.utils.translation import pgettext

    from apps.workforce.services import validate_wage

    from .models import JobOffer

    application = (
        Application.objects.select_for_update()
        .select_related("job__organization", "worker")
        .get(pk=application.pk)
    )
    if application.stage != "selected":
        raise InvalidState(message=pgettext("growth", "Offers can only be sent to selected candidates."))
    expire_offers(application.offers.all())
    if application.offers.filter(status__in=JobOffer.ACTIVE).exists():
        raise InvalidState(
            message=pgettext("growth", "This candidate already has an open offer. Withdraw it first.")
        )
    wage_type = data.get("wage_type") or "monthly"
    validate_wage(
        wage_type,
        data.get("basic_salary"),
        data.get("dearness_allowance"),
        data.get("daily_wage"),
        hourly=data.get("hourly_wage"),
    )
    days = data.get("expires_in_days") or OFFER_DEFAULT_DAYS
    offer = JobOffer.objects.create(
        application=application,
        wage_type=wage_type,
        basic_salary=data.get("basic_salary") if wage_type == "monthly" else None,
        dearness_allowance=data.get("dearness_allowance") if wage_type == "monthly" else None,
        daily_wage=data.get("daily_wage") if wage_type == "daily" else None,
        hourly_wage=data.get("hourly_wage") if wage_type == "hourly" else None,
        start_date=data["start_date"],
        site=data.get("site") or application.job.site,
        designation=data.get("designation") or application.job.title,
        contract_type=data.get("contract_type") or ("daily" if wage_type == "daily" else "permanent"),
        ends_on=data.get("ends_on"),
        expires_at=timezone.now() + dt.timedelta(days=days),
        sent_by=user,
    )
    org = application.job.organization
    _track(
        "offer_sent",
        user=user,
        organization=org,
        job_id=str(application.job_id),
        application_id=str(application.id),
    )
    amount = format_npr(offer_monthly_amount(offer))
    _safe_notify(
        application.worker.user,
        "job_offer",
        f"Job offer from {org.name}",
        f"{org.name} offers you {offer.designation} at {amount}/month from {offer.start_date}. "
        "Accept or decline in the KaamSathi app.",
        title_ne=f"{org.name} बाट कामको प्रस्ताव",
        body_ne=f"{org.name} ले तपाईंलाई {offer.designation} पदमा मासिक {amount} को प्रस्ताव पठाएको छ। "
        "KaamSathi एपमा स्वीकार वा अस्वीकार गर्नुहोस्।",
        data={"offer_id": str(offer.id), "application_id": str(application.id)},
        link="/me/job-offers",
        sms=True,
    )
    if not application.worker.user_id:
        from apps.notifications.services import send_sms

        send_sms(
            application.worker.phone,
            f"KaamSathi: {org.name} offers you {offer.designation} at {amount}/month. "
            "Reply to KaamSathi to accept.",
            kind="job_offer",
        )
    return offer


@transaction.atomic
def withdraw_offer(offer):
    from django.utils.translation import pgettext

    expire_offers(type(offer).objects.filter(pk=offer.pk))
    offer.refresh_from_db()
    if offer.status != "sent":
        raise InvalidState(message=pgettext("growth", "Only an open offer can be withdrawn."))
    offer.status = "withdrawn"
    offer.save(update_fields=["status"])
    return offer


def _notify_employer(offer, accepted: bool):
    org = offer.application.job.organization
    worker = offer.application.worker
    verb = "accepted" if accepted else "declined"
    verb_ne = "स्वीकार" if accepted else "अस्वीकार"
    for m in org.memberships.filter(is_active=True, role__in=["owner", "admin", "hr"]).select_related("user"):
        _safe_notify(
            m.user,
            f"job_offer_{verb}",
            f"{worker.full_name} {verb} your offer",
            f"{worker.full_name} {verb} the offer for {offer.application.job.title}.",
            title_ne=f"{worker.full_name} ले प्रस्ताव {verb_ne} गर्नुभयो",
            link=f"/app/jobs/{offer.application.job_id}",
            data={"offer_id": str(offer.id)},
        )


@transaction.atomic
def respond_to_offer(offer, accept: bool, reason: str = ""):
    from django.utils.translation import pgettext

    from .models import JobOffer

    offer = (
        JobOffer.objects.select_for_update().select_related("application__job__organization").get(pk=offer.pk)
    )
    if offer.status == "sent" and offer.expires_at <= timezone.now():
        offer.status = "expired"
        offer.save(update_fields=["status"])
    if offer.status != "sent":
        raise InvalidState(message=pgettext("growth", "This offer is no longer open."))
    offer.status = "accepted" if accept else "declined"
    offer.responded_at = timezone.now()
    offer.decline_reason = None if accept else (reason or None)
    offer.save(update_fields=["status", "responded_at", "decline_reason"])
    app = offer.application
    if accept and app.worker_response != "interested":
        app.worker_response = "interested"
        app.responded_at = offer.responded_at
        app.save(update_fields=["worker_response", "responded_at"])
    _notify_employer(offer, accept)
    if accept:
        _track(
            "offer_accepted",
            user=app.worker.user if app.worker.user_id else None,
            organization=offer.application.job.organization,
            job_id=str(app.job_id),
            application_id=str(app.id),
        )
    return offer


def accepted_offer(application: Application):
    return application.offers.filter(status="accepted").order_by("-created_at").first()


def employment_from_offer(offer) -> dict:
    """``employment`` payload for a join move, pre-filled from an accepted offer."""
    return {
        "start_date": offer.start_date,
        "site": offer.site,
        "designation": offer.designation,
        "wage_type": offer.wage_type,
        "basic_salary": offer.basic_salary,
        "dearness_allowance": offer.dearness_allowance,
        "daily_wage": offer.daily_wage,
        "hourly_wage": offer.hourly_wage,
    }


# --------------------------------------------------------------------------- job alerts (SEARCH-02)
def _job_district_id(job):
    return (
        job.site.district_id
        if job.site_id and job.site and job.site.district_id
        else job.organization.district_id
    )


def alert_matches(alert, job, district_ids=None) -> bool:
    if alert.trade_id and alert.trade_id != job.trade_id:
        return False
    districts = district_ids if district_ids is not None else {d.pk for d in alert.districts.all()}
    if districts and _job_district_id(job) not in districts:
        return False
    if alert.min_wage:
        monthly = D(job.wage_amount) * {"daily": 30, "hourly": 240}.get(job.wage_type, 1)
        if monthly < D(alert.min_wage):
            return False
    return True


def _alert_candidates(frequency):
    from .models import JobAlert

    return (
        JobAlert.objects.filter(is_active=True, frequency=frequency, worker__user__isnull=False)
        .select_related("worker__user", "trade")
        .prefetch_related("districts")
    )


def notify_instant_alerts(job_id) -> int:
    """Called when a job is published: one notification per matching worker (verified employers only)."""
    job = JobOpening.objects.select_related("organization", "site", "trade").filter(pk=job_id).first()
    if job is None or job.status != "open" or not employer_verified(job.organization):
        return 0
    applied = set(job.applications.values_list("worker_id", flat=True))
    notified: set = set()
    now = timezone.now()
    for alert in _alert_candidates("instant").filter(_trade_q(job)):
        if alert.worker_id in notified or alert.worker_id in applied or not alert_matches(alert, job):
            continue
        org = job.organization
        _safe_notify(
            alert.worker.user,
            "job_alert",
            f"New job: {job.title} at {org.name}",
            f"{job.title} at {org.name}, {format_npr(job.wage_amount)} ({job.wage_type}). "
            "Open KaamSathi to say you're interested.",
            title_ne=f"नयाँ काम: {org.name} मा {job.title}",
            body_ne=f"{org.name} मा {job.title}, {format_npr(job.wage_amount)}। रुचि भए KaamSathi खोल्नुहोस्।",
            data={"job_id": str(job.id)},
            link="/me/jobs/recommended",
            sms=True,
        )
        notified.add(alert.worker_id)
        alert.last_sent_at = now
        alert.save(update_fields=["last_sent_at"])
    return len(notified)


def _trade_q(job):  # noqa: N802 - small query helper
    from django.db.models import Q

    return Q(trade__isnull=True) | Q(trade_id=job.trade_id)


DIGEST_WINDOW = {"daily": dt.timedelta(days=1), "weekly": dt.timedelta(days=7)}


def send_alert_digests(frequency: str) -> int:
    """Daily/weekly digest of jobs published since the alert last fired. Returns workers notified.

    Scheduled by the platform (beat) — safe to call repeatedly (``last_sent_at`` bounds the window).
    """
    if frequency not in DIGEST_WINDOW:
        raise ValueError(f"unknown digest frequency {frequency!r}")
    now = timezone.now()
    window_start = now - DIGEST_WINDOW[frequency]
    jobs = list(
        JobOpening.objects.filter(
            status="open",
            published_at__gte=window_start - dt.timedelta(days=1),
            organization__is_active=True,
            organization__verification_status="verified",
        ).select_related("organization", "site", "trade")
    )
    if not jobs:
        return 0
    sent = 0
    for alert in _alert_candidates(frequency):
        since = max(filter(None, [alert.last_sent_at, window_start]))
        applied = set(Application.objects.filter(worker_id=alert.worker_id).values_list("job_id", flat=True))
        districts = {d.pk for d in alert.districts.all()}
        matched = [
            j
            for j in jobs
            if j.published_at
            and j.published_at > since
            and j.pk not in applied
            and alert_matches(alert, j, districts)
        ]
        if not matched:
            continue
        top = ", ".join(f"{j.title} ({j.organization.name})" for j in matched[:3])
        _safe_notify(
            alert.worker.user,
            "job_alert_digest",
            f"{len(matched)} new job(s) for you",
            f"{top}. Open KaamSathi to see all.",
            title_ne=f"तपाईंका लागि {len(matched)} नयाँ काम",
            body_ne=f"{top}। सबै हेर्न KaamSathi खोल्नुहोस्।",
            data={"job_ids": [str(j.id) for j in matched[:20]]},
            link="/me/jobs/recommended",
        )
        alert.last_sent_at = now
        alert.save(update_fields=["last_sent_at"])
        sent += 1
    return sent
