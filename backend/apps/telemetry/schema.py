"""What may be tracked. Anything not listed here is rejected (client) or dropped (server).

No PII: never names, phone numbers, emails, ID/bank numbers, free text or precise location.
Internal UUIDs (job/application ids) are allowed — they identify records, not people, and raw
events are purged after ``TELEMETRY_RETENTION_DAYS`` (400).
"""

from __future__ import annotations

import re

# Emitted by the backend only (funnels rely on them, so clients cannot forge them).
SERVER_EVENTS = frozenset(
    {
        "offer_sent",
        "offer_accepted",
        "user_registered",
        "org_created",
        "worker_profile_created",
        "worker_onboarded",
        "worker_verified",
        "job_published",
        "application_stage_changed",
        "shortlist_accepted",
        "worker_placed",
        "first_attendance",
        "payroll_approved",
        # Bolau (docs/CONTRACT-BOLAU.md)
        "bolau_sipalu_joined",
        "bolau_onboarding_step",
        "bolau_booking_requested",
        "bolau_booking_status_changed",
        "bolau_request_posted",
        "bolau_offer_sent",
        "bolau_offer_accepted",
        "bolau_rating_submitted",
    }
)

# Accepted from web / mobile clients via POST /telemetry/events.
CLIENT_EVENTS = frozenset(
    {
        "app_open",
        "page_view",
        "login_success",
        "otp_requested",
        "onboarding_step",
        "job_created",
        "payroll_run_created",
        "search_performed",
        "feature_used",
    }
)

ALLOWED_PROPERTIES = frozenset(
    {
        "app_version",
        "application_id",
        "booking_id",
        "bs_month",
        "bs_year",
        "channel",
        "count",
        "duration_ms",
        "error_code",
        "feature",
        "from_stage",
        "from_status",
        "has_photo",
        "industry",
        "instant",
        "job_id",
        "kind",
        "lang",
        "method",
        "openings",
        "org_role",
        "page",
        "plan",
        "price_type",
        "request_id",
        "result",
        "role",
        "score",
        "screen",
        "source",
        "status",
        "step",
        "to_stage",
        "to_status",
        "trade",
        "via",
        "wage_type",
    }
)

MAX_BATCH = 50
MAX_PROPERTIES = 20
MAX_STRING = 120

PLATFORMS_CLIENT = frozenset({"web", "android", "ios"})
NAME_RE = re.compile(r"^[a-z][a-z0-9_]{1,63}$")
ANON_RE = re.compile(r"^[A-Za-z0-9_-]{8,64}$")
# Defence in depth: values that look like personal data are refused even under an allowed key.
_PHONE_RE = re.compile(r"(?<!\d)(?:\+?977[- ]?)?9[678]\d{8}(?!\d)")
_EMAIL_RE = re.compile(r"[^@\s]+@[^@\s]+\.[A-Za-z]{2,}")


def looks_like_pii(value: str) -> bool:
    return bool(_PHONE_RE.search(value) or _EMAIL_RE.search(value))


def clean_properties(props, *, strict: bool) -> tuple[dict, dict]:
    """Return ``(clean, errors)``. ``strict`` (client) reports every problem; otherwise bad keys are
    just dropped. Errors map key → message."""
    clean, errors = {}, {}
    if props is None:
        return clean, errors
    if not isinstance(props, dict):
        return clean, {"properties": "Must be an object."}
    if len(props) > MAX_PROPERTIES:
        errors["properties"] = f"At most {MAX_PROPERTIES} properties."
    for key, value in props.items():
        if key not in ALLOWED_PROPERTIES:
            errors[str(key)[:40]] = "Property not allowed."
            continue
        if isinstance(value, bool) or value is None or isinstance(value, (int, float)):
            clean[key] = value
            continue
        if isinstance(value, str):
            if len(value) > MAX_STRING:
                errors[key] = f"At most {MAX_STRING} characters."
                continue
            if looks_like_pii(value):
                errors[key] = "Looks like personal data."
                continue
            if key == "page":
                value = value.split("?", 1)[0].split("#", 1)[0]
            clean[key] = value
            continue
        errors[key] = "Only strings, numbers, booleans or null."
    return clean, errors
