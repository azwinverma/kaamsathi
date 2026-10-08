"""Privacy services: data export bundle, anonymising deletion, request workflow.

Ecosystem models (trust, credentials, partners, finance, …) are looked up lazily through the
app registry so this module works whether or not those apps have shipped their models yet.
"""

from __future__ import annotations

import datetime as dt
import decimal
import io
import json
import logging
import uuid
import zipfile
from collections import Counter
from xml.sax.saxutils import escape

from django.apps import apps as django_apps
from django.conf import settings
from django.core.exceptions import FieldDoesNotExist, FieldError
from django.core.files.base import ContentFile
from django.db import models, transaction
from django.utils import timezone
from django.utils.translation import gettext as _

from apps.core.exceptions import InvalidState

from .models import PrivacyRequest

logger = logging.getLogger("kaamsathi.privacy")

DELETED_NAME = "Deleted worker"
DELETED_NAME_NE = "मेटाइएको कामदार"
DELETED_USER_NAME = "Deleted user"

# Fields never written to an export (secrets, hashes, other people's internals).
SECRET_FIELD_HINTS = ("hash", "secret", "password", "token_key", "api_key")

# (label, app_label, model_name, lookup to the worker) — optional ecosystem data.
LAZY_SOURCES = [
    ("profile_views", "trust", "ProfileView", "worker"),
    ("trust", "trust", "WorkerTrust", "worker"),
    ("disputes", "trust", "Dispute", "worker"),
    ("crew_led", "crews", "Crew", "lead"),
    ("naike_referrals", "crews", "Referral", "worker"),
    ("credentials", "credentials", "Credential", "worker"),
    ("skill_assessments", "credentials", "SkillAssessment", "worker"),
    ("skill_passport", "credentials", "Passport", "worker"),
    ("passport_shares", "credentials", "PassportShare", "worker"),
    ("training_enrollments", "training", "Enrollment", "worker"),
    ("employment_contracts", "compliance", "EmploymentContract", "employment__worker"),
    ("roster", "scheduling", "RosterEntry", "employment__worker"),
    ("payout_items", "payouts", "PayoutItem", "payslip__worker"),
    ("partner_consent_grants", "partners", "ConsentGrant", "worker"),
    ("partner_access_log", "partners", "PartnerAccessLog", "worker"),
    ("financial_profile", "finance", "FinancialProfile", "worker"),
    ("finance_referrals", "finance", "Referral", "worker"),
]

# On deletion: rows removed outright (not legally required, purely the worker's own data).
DELETE_ON_ERASURE = [
    ("credentials", "Credential", "worker"),
    ("credentials", "SkillAssessment", "worker"),
    ("credentials", "PassportShare", "worker"),
    ("credentials", "Passport", "worker"),
    ("finance", "FinancialProfile", "worker"),
    ("trust", "WorkerTrust", "worker"),
]
# On deletion: rows kept for audit but revoked (consent grants to partners).
REVOKE_ON_ERASURE = [
    ("partners", "ConsentGrant", "worker"),
]


# --------------------------------------------------------------------------- helpers
def get_model(app_label: str, model_name: str):
    try:
        return django_apps.get_model(app_label, model_name)
    except LookupError:
        return None


def lazy_qs(app_label: str, model_name: str, lookup: str, worker):
    model = get_model(app_label, model_name)
    if model is None:
        return None
    try:
        return model.objects.filter(**{lookup: worker})
    except (FieldError, FieldDoesNotExist, ValueError):
        return None


def _jsonable(value):
    if isinstance(value, (dt.datetime, dt.date, dt.time)):
        return value.isoformat()
    if isinstance(value, decimal.Decimal):
        return str(value)
    if isinstance(value, uuid.UUID):
        return str(value)
    return value


def row_to_dict(obj) -> dict:
    """Generic, privacy-aware serialisation of a model row for the export."""
    from django.contrib.auth import get_user_model

    user_model = get_user_model()
    out = {}
    for field in obj._meta.concrete_fields:
        name = field.name
        if any(h in name for h in SECRET_FIELD_HINTS):
            continue
        if isinstance(field, models.FileField):
            out[name] = bool(getattr(obj, name))  # presence only; the files are not in the bundle
            continue
        if field.is_relation:
            rel_id = getattr(obj, field.attname)
            if rel_id is None:
                out[name] = None
            elif field.related_model is user_model:
                # Other people's accounts (viewers, verifiers) are not disclosed beyond "a user".
                out[name] = "self" if getattr(obj, "_export_user_id", None) == rel_id else "user"
            else:
                related = getattr(obj, name, None)
                label = getattr(related, "name", None) or getattr(related, "name_en", None)
                out[name] = {"id": str(rel_id), "name": label} if label else str(rel_id)
            continue
        out[name] = _jsonable(getattr(obj, name))
    return out


def _bs(value):
    from apps.core.bs import bs_str

    try:
        return bs_str(value) if value else None
    except Exception:  # noqa: BLE001
        return None


# --------------------------------------------------------------------------- export
def collect_export(user, worker) -> dict:
    """Everything KaamSathi holds about ``user`` / ``worker`` as a JSON-able dict."""
    now = timezone.now()
    data: dict = {
        "format": "kaamsathi-data-export/1",
        "generated_at": now.isoformat(),
        "controller": "KaamSathi",
        "notes": [
            "This is a copy of the personal data KaamSathi holds about you (Individual Privacy Act 2075).",
            "Uploaded documents (ID photos, certificates) are not included; only whether they exist.",
            "Payroll and attendance records are also held by your employer, who must keep them by law.",
        ],
    }
    if user is not None:
        data["account"] = {
            "id": str(user.pk),
            "phone": user.phone,
            "full_name": user.full_name,
            "email": user.email,
            "preferred_language": user.preferred_language,
            "date_joined": _jsonable(user.date_joined),
            "last_login": _jsonable(user.last_login),
            "memberships": [
                {
                    "organization": m.organization.name,
                    "role": m.role,
                    "is_active": m.is_active,
                    "created_at": _jsonable(m.created_at),
                }
                for m in user.memberships.select_related("organization")
            ]
            if hasattr(user, "memberships")
            else [],
        }
    if worker is None:
        return data

    from apps.hiring.models import Application
    from apps.payroll.models import Payslip
    from apps.workers.models import Rating
    from apps.workforce.models import Advance, Attendance, Employment, LeaveRequest

    worker._export_user_id = worker.user_id
    profile = row_to_dict(worker)
    profile["skills"] = [
        {
            "trade": s.trade_id,
            "years_experience": s.years_experience,
            "nstb_level": s.nstb_level,
            "certificate_no": s.certificate_no,
        }
        for s in worker.skills.all()
    ]
    data["worker_profile"] = profile
    data["consents"] = [
        {
            "organization": c.organization.name if c.organization_id else None,
            "scope": c.scope,
            "granted": c.granted,
            "channel": c.channel,
            "created_at": _jsonable(c.created_at),
        }
        for c in worker.consents.select_related("organization").order_by("created_at")
    ]
    employments = list(
        Employment.objects.filter(worker=worker)
        .select_related("organization", "site", "trade")
        .order_by("start_date")
    )
    data["employments"] = [
        {
            "id": str(e.id),
            "organization": e.organization.name,
            "site": e.site.name if e.site_id else None,
            "trade": e.trade_id,
            "designation": e.designation,
            "employee_code": e.employee_code,
            "start_date": _jsonable(e.start_date),
            "start_date_bs": _bs(e.start_date),
            "end_date": _jsonable(e.end_date),
            "end_date_bs": _bs(e.end_date),
            "status": e.status,
            "end_reason": e.end_reason,
            "wage_type": e.wage_type,
            "basic_salary": _jsonable(e.basic_salary),
            "dearness_allowance": _jsonable(e.dearness_allowance),
            "other_allowance": _jsonable(e.other_allowance),
            "daily_wage": _jsonable(e.daily_wage),
            "ssf_enrolled": e.ssf_enrolled,
        }
        for e in employments
    ]
    data["attendance"] = [
        {
            "employment_id": str(a.employment_id),
            "date": _jsonable(a.date),
            "date_bs": _bs(a.date),
            "status": a.status,
            "check_in_at": _jsonable(a.check_in_at),
            "check_out_at": _jsonable(a.check_out_at),
            "method": a.method,
            "overtime_minutes": a.overtime_minutes,
            "note": a.note,
        }
        for a in Attendance.objects.filter(employment__worker=worker).order_by("date")
    ]
    data["leave_requests"] = [
        row_to_dict(x) for x in LeaveRequest.objects.filter(employment__worker=worker).order_by("from_date")
    ]
    data["advances"] = [row_to_dict(x) for x in Advance.objects.filter(employment__worker=worker)]
    data["payslips"] = [
        {
            "organization": p.run.organization.name,
            "bs_year": p.run.bs_year,
            "bs_month": p.run.bs_month,
            **{
                k: _jsonable(getattr(p, k))
                for k in (
                    "wage_type",
                    "days_in_month",
                    "present_days",
                    "paid_leave_days",
                    "holiday_days",
                    "weekly_off_days",
                    "absent_days",
                    "payable_days",
                    "overtime_hours",
                    "basic_earned",
                    "da_earned",
                    "allowance_earned",
                    "overtime_pay",
                    "festival_allowance",
                    "gross_pay",
                    "ssf_employee",
                    "ssf_employer",
                    "tds",
                    "advance_recovery",
                    "other_deductions",
                    "net_pay",
                    "payment_method",
                    "payment_status",
                    "paid_at",
                )
            },
        }
        for p in Payslip.objects.filter(worker=worker)
        .select_related("run__organization")
        .order_by("run__bs_year", "run__bs_month")
    ]
    data["applications"] = [
        {
            "job": a.job.title,
            "organization": a.job.organization.name,
            "stage": a.stage,
            "created_at": _jsonable(a.created_at),
            "stage_changed_at": _jsonable(a.stage_changed_at),
        }
        for a in Application.objects.filter(worker=worker).select_related("job__organization")
    ]

    def _agg(qs):
        rows = list(qs)
        if not rows:
            return {"count": 0, "score_a_avg": None, "score_b_avg": None}
        return {
            "count": len(rows),
            "score_a_avg": round(sum(r.score_a for r in rows) / len(rows), 2),
            "score_b_avg": round(sum(r.score_b for r in rows) / len(rows), 2),
        }

    data["ratings"] = {
        "received_from_employers": _agg(Rating.objects.filter(employment__worker=worker, rater="employer")),
        "given_to_employers": _agg(Rating.objects.filter(employment__worker=worker, rater="worker")),
    }

    for label, app_label, model_name, lookup in LAZY_SOURCES:
        qs = lazy_qs(app_label, model_name, lookup, worker)
        if qs is None:
            continue
        rows = []
        for obj in qs:
            obj._export_user_id = worker.user_id
            rows.append(row_to_dict(obj))
        data[label] = rows

    data["privacy_requests"] = [
        {"kind": r.kind, "status": r.status, "created_at": _jsonable(r.created_at)}
        for r in PrivacyRequest.objects.filter(worker=worker).order_by("created_at")
    ]
    return data


def render_pdf(data: dict) -> bytes:
    """Human-readable summary of the export (the JSON file is the complete record)."""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=15 * mm,
        rightMargin=15 * mm,
        topMargin=15 * mm,
        bottomMargin=15 * mm,
        title="KaamSathi data export",
    )
    styles = getSampleStyleSheet()
    story = []

    def p(text, style="BodyText"):
        story.append(Paragraph(escape(str(text)), styles[style]))

    def table(rows, widths=None):
        if not rows:
            return
        t = Table(
            [
                [Paragraph(escape(str(c if c is not None else "—")), styles["BodyText"]) for c in r]
                for r in rows
            ],
            colWidths=widths,
            repeatRows=1,
        )
        t.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#EEF1FB")),
                    ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#C9CED8")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ]
            )
        )
        story.append(t)
        story.append(Spacer(1, 4 * mm))

    p("KaamSathi — copy of your data", "Title")
    p(f"Generated: {data.get('generated_at')}")
    for note in data.get("notes", []):
        p(note)
    story.append(Spacer(1, 4 * mm))

    acct = data.get("account")
    if acct:
        p("Account", "Heading2")
        table(
            [
                ["Field", "Value"],
                ["Phone", acct["phone"]],
                ["Name", acct["full_name"]],
                ["Email", acct["email"]],
                ["Joined", acct["date_joined"]],
            ]
        )
    prof = data.get("worker_profile")
    if prof:
        p("Worker profile", "Heading2")
        keys = [
            "full_name",
            "phone",
            "gender",
            "date_of_birth",
            "address",
            "citizenship_no",
            "nid_no",
            "verification_status",
            "payment_method",
            "bank_name",
            "bank_account_no",
            "wallet_id",
            "ssf_id",
            "id_front",
            "id_back",
            "photo",
        ]
        table([["Field", "Value"], *[[k, prof.get(k)] for k in keys if k in prof]])
        if prof.get("skills"):
            table(
                [
                    ["Trade", "Years", "NSTB level"],
                    *[[s["trade"], s["years_experience"], s["nstb_level"]] for s in prof["skills"]],
                ]
            )
    if data.get("consents"):
        p("Consents", "Heading2")
        table(
            [
                ["Organisation", "Scope", "Granted", "Date"],
                *[
                    [
                        c["organization"] or "All",
                        c["scope"],
                        "yes" if c["granted"] else "no",
                        c["created_at"][:10],
                    ]
                    for c in data["consents"]
                ],
            ]
        )
    if data.get("employments"):
        p("Employment history", "Heading2")
        table(
            [
                ["Organisation", "Designation", "From", "To", "Status"],
                *[
                    [e["organization"], e["designation"], e["start_date"], e["end_date"], e["status"]]
                    for e in data["employments"]
                ],
            ]
        )
    if data.get("attendance"):
        p("Attendance (hajiri) summary", "Heading2")
        counts = Counter((a["employment_id"], a["status"]) for a in data["attendance"])
        names = {e["id"]: e["organization"] for e in data.get("employments", [])}
        rows = [["Organisation", "Status", "Days"]]
        rows += [[names.get(emp, emp), status, n] for (emp, status), n in sorted(counts.items())]
        table(rows)
    if data.get("payslips"):
        p("Payslips", "Heading2")
        table(
            [
                ["Organisation", "Month (BS)", "Gross", "Net", "Status"],
                *[
                    [
                        s["organization"],
                        f"{s['bs_year']}-{s['bs_month']:02d}",
                        s["gross_pay"],
                        s["net_pay"],
                        s["payment_status"],
                    ]
                    for s in data["payslips"]
                ],
            ]
        )
    if data.get("ratings"):
        r = data["ratings"]
        p("Ratings (aggregated)", "Heading2")
        table(
            [
                ["", "Count", "Avg A", "Avg B"],
                ["From employers", *r["received_from_employers"].values()],
                ["Given to employers", *r["given_to_employers"].values()],
            ]
        )
    other = [
        (k, len(v)) for k, v in data.items() if k in {s[0] for s in LAZY_SOURCES} and isinstance(v, list)
    ]
    if other:
        p("Other records (full detail in the JSON file)", "Heading2")
        table([["Section", "Records"], *other])
    doc.build(story)
    return buf.getvalue()


README = """KaamSathi — copy of your data / तपाईंको डाटाको प्रतिलिपि

data.json  Complete machine-readable copy of the personal data KaamSathi holds about you.
data.pdf   Readable summary.

This file contains personal information. Keep it safe and do not share it unless you choose to.
यो फाइलमा व्यक्तिगत विवरण छ। सुरक्षित राख्नुहोस् र आफूले नचाहेसम्म कसैलाई नदिनुहोस्।

Questions or corrections: use "Privacy requests" in the KaamSathi app.
प्रश्न वा सच्याउनुपर्ने भएमा: कामसाथी एपको "गोपनीयता अनुरोध" प्रयोग गर्नुहोस्।
"""


def build_bundle(data: dict) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("data.json", json.dumps(data, ensure_ascii=False, indent=2, default=str))
        zf.writestr("data.pdf", render_pdf(data))
        zf.writestr("README.txt", README)
    return buf.getvalue()


def generate_export(req: PrivacyRequest) -> PrivacyRequest:
    data = collect_export(req.user, req.worker)
    blob = build_bundle(data)
    if req.file:
        req.file.delete(save=False)
    req.file.save(f"{req.id}.zip", ContentFile(blob), save=False)
    now = timezone.now()
    req.file_expires_at = now + dt.timedelta(hours=settings.PRIVACY_EXPORT_TTL_HOURS)
    req.status = "completed"
    req.completed_at = now
    req.save()
    phone = req.user.phone if req.user_id else (req.worker.phone if req.worker_id else None)
    if phone and phone.isdigit():
        from apps.notifications.services import send_sms

        send_sms(
            phone,
            "KaamSathi: your data copy is ready in the app (Privacy requests) for "
            f"{settings.PRIVACY_EXPORT_TTL_HOURS} hours. / कामसाथी: तपाईंको डाटाको प्रतिलिपि एपमा तयार छ।",
            kind="privacy_export",
        )
    return req


# --------------------------------------------------------------------------- deletion
def pseudonymous_phone(phone: str, prefix: str = "D") -> str:
    """Stable 10-char placeholder (keeps the unique constraint, not reversible without the key).

    Keyed with FIELD_HASH_KEY (via blind_index) so rotating SECRET_KEY doesn't change the mapping.
    """
    from apps.core.crypto import blind_index

    digest = blind_index(phone or "-", "deleted-phone")
    return (prefix + digest)[:10]


def _revoke_consents(worker):
    from apps.workers.models import Consent

    latest = {}
    for c in Consent.objects.filter(worker=worker).order_by("created_at"):
        latest[(c.organization_id, c.scope)] = c.granted
    for (org_id, scope), granted in latest.items():
        if granted:
            Consent.objects.create(
                worker=worker, organization_id=org_id, scope=scope, granted=False, channel="ops"
            )


def _blacklist_tokens(user):
    try:
        from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
    except ImportError:  # pragma: no cover
        return
    for tok in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=tok)


@transaction.atomic
def anonymise_worker(worker, *, actor=None) -> dict:
    """Erase a worker's personal data but keep legally required payroll/attendance rows.

    Kept (linked to the anonymised record): employments, attendance (minus GPS), leave,
    advances, payslips, payout items, ratings (minus comments), consent history, view logs.
    """
    from apps.hiring.models import Application
    from apps.workers.models import Rating
    from apps.workforce.models import Attendance

    summary: dict = {"documents_deleted": 0, "rows_deleted": {}, "rows_revoked": {}}
    now = timezone.now()

    for field in ("id_front", "id_back", "photo"):
        f = getattr(worker, field)
        if f:
            f.delete(save=False)
            summary["documents_deleted"] += 1

    _revoke_consents(worker)

    for app_label, model_name, lookup in REVOKE_ON_ERASURE:
        qs = lazy_qs(app_label, model_name, lookup, worker)
        if qs is not None:
            try:
                n = qs.filter(revoked_at__isnull=True).update(revoked_at=now)
            except FieldError:
                n = 0
            summary["rows_revoked"][model_name] = n

    for app_label, model_name, lookup in DELETE_ON_ERASURE:
        qs = lazy_qs(app_label, model_name, lookup, worker)
        if qs is None:
            continue
        for obj in qs:
            for fld in obj._meta.concrete_fields:
                if isinstance(fld, models.FileField) and getattr(obj, fld.name):
                    getattr(obj, fld.name).delete(save=False)
                    summary["documents_deleted"] += 1
        try:
            n, _detail = qs.delete()
        except models.ProtectedError:
            n = 0
            logger.warning("privacy: %s rows protected for worker %s", model_name, worker.pk)
        summary["rows_deleted"][model_name] = n

    worker.skills.all().delete()
    Attendance.objects.filter(employment__worker=worker).update(
        check_in_lat=None, check_in_lng=None, check_out_lat=None, check_out_lng=None
    )
    Rating.objects.filter(employment__worker=worker).update(comment=None)
    Application.objects.filter(worker=worker).update(notes=None, rejection_reason=None)

    user = worker.user
    old_phone = worker.phone
    worker.full_name = DELETED_NAME
    worker.full_name_ne = DELETED_NAME_NE
    worker.phone = pseudonymous_phone(old_phone)
    for name in (
        "date_of_birth",
        "permanent_district",
        "current_district",
        "address",
        "citizenship_no",
        "nid_no",
        "expected_monthly_wage",
        "available_from",
        "bank_name",
        "bank_account_no",
        "bank_account_name",
        "wallet_id",
        "ssf_id",
        "naike",
        "notes",
        "verification_note",
    ):
        setattr(worker, name, None)
    worker.is_available = False
    worker.user = None
    worker.save()

    if user is not None:
        summary["account"] = anonymise_user(user)
    return summary


def anonymise_user(user) -> str:
    """Deactivate + scrub a login account unless it still administers an organisation."""
    if user.memberships.filter(is_active=True).exists():
        return "kept (active organisation membership — remove the membership, then repeat)"
    user.full_name = DELETED_USER_NAME
    user.phone = pseudonymous_phone(user.phone, prefix="U")
    user.email = None
    user.is_active = False
    user.set_unusable_password()
    user.save()
    _blacklist_tokens(user)
    return "anonymised and deactivated"


# --------------------------------------------------------------------------- workflow
def create_request(user, kind: str, details: str | None = None) -> PrivacyRequest:
    from apps.core.exceptions import Duplicate

    worker = getattr(user, "worker", None)
    if PrivacyRequest.objects.filter(user=user, kind=kind, status__in=("received", "in_progress")).exists():
        raise Duplicate(message=_("You already have an open request of this kind."))
    req = PrivacyRequest.objects.create(user=user, worker=worker, kind=kind, details=details or None)
    if kind == "export":
        req.status = "in_progress"
        req.save(update_fields=["status", "updated_at"])
        _enqueue_export(req)
    elif kind == "correction" and worker is not None:
        _open_correction_dispute(req)
    return req


def _enqueue_export(req):
    from apps.notifications.services import enqueue

    from .tasks import generate_export as task

    enqueue(task, str(req.id))


def _open_correction_dispute(req):
    """Corrections go to the ops dispute queue when the trust app is installed."""
    Dispute = get_model("trust", "Dispute")
    if Dispute is None:
        return
    try:
        Dispute.objects.create(
            worker=req.worker,
            kind="identity",
            description=f"[Privacy correction request {req.id}] {req.details or ''}".strip(),
        )
    except Exception:  # noqa: BLE001 — schema differences must never block the request
        logger.exception("privacy: could not open correction dispute for %s", req.id)


def process_request(req: PrivacyRequest, *, action: str, note: str | None, actor) -> PrivacyRequest:
    if req.status not in ("received", "in_progress"):
        raise InvalidState(message=_("This request has already been handled."))
    req.handled_by = actor
    if note:
        req.response_note = note
    if action == "reject":
        req.status = "rejected"
        req.completed_at = timezone.now()
        req.save()
        return req
    if req.kind == "export":
        req.status = "in_progress"
        req.save()
        _enqueue_export(req)
        return req
    if req.kind == "deletion":
        if req.worker is not None:
            summary = anonymise_worker(req.worker, actor=actor)
        elif req.user is not None:
            summary = {"account": anonymise_user(req.user)}
        else:
            summary = {}
        req.response_note = (
            req.response_note or "Data anonymised; payroll and attendance kept as required by law."
        )
        req.status = "completed"
        req.completed_at = timezone.now()
        req.save()
        from apps.audit.models import AuditLog

        AuditLog.objects.create(
            actor=actor,
            action="privacy.deletion",
            object_type="privacyrequest",
            object_id=str(req.id),
            changes=summary,
        )
        return req
    # correction: ops has applied the fix through the normal worker endpoints
    req.status = "completed"
    req.completed_at = timezone.now()
    req.save()
    return req


def purge_expired_exports(now=None) -> int:
    now = now or timezone.now()
    n = 0
    for req in (
        PrivacyRequest.objects.filter(file_expires_at__lte=now).exclude(file="").exclude(file__isnull=True)
    ):
        req.file.delete(save=False)
        req.file = None
        req.save(update_fields=["file", "updated_at"])
        n += 1
    return n


def purge_stale_records(now=None) -> dict:
    """Retention for short-lived operational data (OTPs, SMS bodies)."""
    now = now or timezone.now()
    out = {}
    from apps.accounts.models import PhoneOTP

    out["otps"], _detail = PhoneOTP.objects.filter(created_at__lt=now - dt.timedelta(days=30)).delete()
    SMS = get_model("notifications", "SMSMessage")
    if SMS is not None:
        days = getattr(settings, "SMS_LOG_RETENTION_DAYS", 180)
        out["sms"], _detail = SMS.objects.filter(created_at__lt=now - dt.timedelta(days=days)).delete()
    return out


def can_download_check(rest: str, user, name: str) -> bool:
    """apps.core.files re-check for ``check="privacy:<request id>"`` tokens."""
    req = PrivacyRequest.objects.filter(pk=rest).first() if _is_uuid(rest) else None
    if req is None or not req.file or req.file.name != name or not req.file_available:
        return False
    if user is None:
        return False
    return user.is_staff or req.user_id == user.pk


def _is_uuid(value: str) -> bool:
    try:
        uuid.UUID(str(value))
    except ValueError:
        return False
    return True
