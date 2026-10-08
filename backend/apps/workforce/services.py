"""Workforce domain services: wage validation, onboarding, attendance upsert, leave."""

from __future__ import annotations

import datetime as dt
from decimal import Decimal

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone
from django.utils.translation import gettext as _
from django.utils.translation import pgettext

from apps.core.exceptions import APIError, BelowMinimumWage, Duplicate, InvalidState
from apps.core.money import D, format_npr
from apps.core.phone import is_valid_phone, normalize_phone
from apps.hiring.models import MinimumWage
from apps.workers.models import Worker

from .models import Attendance, Employment, LeaveRequest


def validate_wage(wage_type, basic=None, da=None, daily=None, on=None, hourly=None, part_time=False):
    """Raise 400 below_minimum_wage when pay is under the current minimum wage.

    Hourly (R005): ≥ ``MinimumWage.hourly`` (101), or ``hourly_part_time`` (107) for part-time staff.
    """
    mw = MinimumWage.current(on)
    if wage_type == "monthly":
        missing = {}
        if basic in (None, ""):
            missing["basic_salary"] = [_("This field is required for monthly wage.")]
        if da in (None, ""):
            missing["dearness_allowance"] = [_("This field is required for monthly wage.")]
        if missing:
            raise APIError("validation_error", fields=missing)
        if mw and D(basic) + D(da) < mw.monthly_total:
            msg = _("Basic + DA must be at least %(amount)s per month (minimum wage).") % {
                "amount": format_npr(mw.monthly_total)
            }
            raise BelowMinimumWage(message=msg, fields={"basic_salary": [msg]})
    elif wage_type == "daily":
        if daily in (None, ""):
            raise APIError(
                "validation_error", fields={"daily_wage": [_("This field is required for daily wage.")]}
            )
        if mw and D(daily) < mw.daily:
            msg = _("Daily wage must be at least %(amount)s (minimum wage).") % {
                "amount": format_npr(mw.daily)
            }
            raise BelowMinimumWage(message=msg, fields={"daily_wage": [msg]})
    elif wage_type == "hourly":
        if hourly in (None, ""):
            raise APIError(
                "validation_error",
                fields={"hourly_wage": [pgettext("complete2", "This field is required for hourly wage.")]},
            )
        minimum = (mw.hourly_part_time if part_time else mw.hourly) if mw else None
        if minimum is not None and D(hourly) < minimum:
            msg = pgettext("complete2", "Hourly wage must be at least %(amount)s (minimum wage).") % {
                "amount": format_npr(minimum)
            }
            raise BelowMinimumWage(message=msg, fields={"hourly_wage": [msg]})
    else:
        raise APIError(
            "validation_error",
            fields={"wage_type": [pgettext("complete2", "Must be monthly, daily or hourly.")]},
        )


WORKER_INPUT_FIELDS = (
    "full_name",
    "full_name_ne",
    "gender",
    "date_of_birth",
    "address",
    "citizenship_no",
    "nid_no",
    "payment_method",
    "bank_name",
    "bank_account_no",
    "bank_account_name",
    "wallet_id",
    "ssf_id",
)


def get_or_create_worker(data: dict) -> tuple[Worker, bool]:
    phone = normalize_phone(data.get("phone"))
    if not is_valid_phone(phone):
        raise APIError(
            "validation_error", fields={"worker.phone": [_("Enter a valid 10-digit mobile number.")]}
        )
    worker = Worker.objects.filter(phone=phone).first()
    if worker:
        changed = []
        for f in WORKER_INPUT_FIELDS:
            if data.get(f) not in (None, "") and not getattr(worker, f):
                setattr(worker, f, data[f])
                changed.append(f)
        if changed:
            worker.save(update_fields=changed + ["updated_at"])
        return worker, False
    if not data.get("full_name"):
        raise APIError("validation_error", fields={"worker.full_name": [_("This field is required.")]})
    values = {f: data[f] for f in WORKER_INPUT_FIELDS if data.get(f) not in (None, "")}
    for fk in ("permanent_district", "current_district"):
        if data.get(fk):
            values[f"{fk}_id"] = getattr(data[fk], "pk", data[fk])
    return Worker.objects.create(phone=phone, **values), True


def create_employment(org, worker, data: dict, application=None) -> Employment:
    wage_type = data.get("wage_type") or "monthly"
    validate_wage(
        wage_type,
        data.get("basic_salary"),
        data.get("dearness_allowance"),
        data.get("daily_wage"),
        hourly=data.get("hourly_wage"),
        part_time=bool(data.get("part_time")),
    )
    if Employment.objects.filter(organization=org, worker=worker, status="active").exists():
        raise Duplicate(message=_("This worker already has an active employment in your organization."))
    start = data["start_date"]
    replacement_until = (
        start + dt.timedelta(days=settings.REPLACEMENT_WINDOW_DAYS) if application is not None else None
    )
    try:
        with transaction.atomic():
            return Employment.objects.create(
                organization=org,
                worker=worker,
                site=data.get("site"),
                trade=data.get("trade"),
                designation=data.get("designation") or "",
                employee_code=data.get("employee_code") or None,
                start_date=start,
                wage_type=wage_type,
                basic_salary=data.get("basic_salary") if wage_type == "monthly" else None,
                dearness_allowance=data.get("dearness_allowance") if wage_type == "monthly" else None,
                other_allowance=data.get("other_allowance") or Decimal("0"),
                daily_wage=data.get("daily_wage") if wage_type == "daily" else None,
                hourly_wage=data.get("hourly_wage") if wage_type == "hourly" else None,
                part_time=bool(data.get("part_time")) if wage_type == "hourly" else False,
                ssf_enrolled=bool(data.get("ssf_enrolled")),
                supervisor=data.get("supervisor"),
                shift=data.get("shift"),
                application=application,
                replacement_eligible_until=replacement_until,
            )
    except IntegrityError as exc:
        raise Duplicate() from exc


# ---------------------------------------------------------------------------
# Attendance
# ---------------------------------------------------------------------------


def upsert_attendance(employment, day: dt.date, values: dict, client_uuid=None, user=None) -> Attendance:
    """Idempotent upsert keyed by client_uuid, then (employment, date)."""
    from apps.payroll.services import is_month_locked

    if is_month_locked(employment.organization, day):
        raise InvalidState(message=_("Payroll for this month is approved; attendance is locked."))
    if not employment.is_active_on(day):
        raise InvalidState(message=_("The worker is not employed on this date."))
    with transaction.atomic():
        record = None
        if client_uuid:
            record = Attendance.objects.select_for_update().filter(client_uuid=client_uuid).first()
            if record and (record.employment_id != employment.id or record.date != day):
                raise Duplicate(message=_("client_uuid already used for another record."))
        if record is None:
            record = Attendance.objects.select_for_update().filter(employment=employment, date=day).first()
        if record is None:
            record = Attendance(employment=employment, date=day)
        for k, v in values.items():
            setattr(record, k, v)
        if client_uuid and record.client_uuid is None:
            record.client_uuid = client_uuid
        record.recorded_by = user
        record.save()
    return record


@transaction.atomic
def approve_leave(leave: LeaveRequest, user) -> LeaveRequest:
    from apps.payroll.services import is_month_locked

    if leave.status != "pending":
        raise InvalidState()
    emp = leave.employment
    day = leave.from_date
    while day <= leave.to_date:
        if emp.is_active_on(day):
            if is_month_locked(emp.organization, day):
                raise InvalidState(message=_("Payroll for this month is approved; attendance is locked."))
            Attendance.objects.update_or_create(
                employment=emp,
                date=day,
                defaults={
                    "status": "leave",
                    "method": "supervisor",
                    "recorded_by": user,
                    "note": f"leave:{leave.leave_type}",
                },
            )
        day += dt.timedelta(days=1)
    leave.status = "approved"
    leave.decided_by = user
    leave.decided_at = timezone.now()
    leave.save(update_fields=["status", "decided_by", "decided_at"])
    return leave


def end_employment(emp: Employment, end_date: dt.date, end_reason: str) -> Employment:
    if emp.status != "active":
        raise InvalidState()
    if end_date < emp.start_date:
        raise APIError("validation_error", fields={"end_date": [_("End date cannot be before start date.")]})
    emp.end_date = end_date
    emp.end_reason = end_reason
    emp.status = "ended"
    emp.save(update_fields=["end_date", "end_reason", "status"])
    return emp
