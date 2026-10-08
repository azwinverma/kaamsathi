"""Worker-profile services: profile completeness (E008), languages (E004), trade search with aliases
(F004)."""

from __future__ import annotations

from django.db import transaction
from django.db.models import Q

from apps.core import labels

from . import labels as worker_labels
from .models import Trade, TradeAlias, Worker, WorkerLanguage

COMPLETENESS_KEYS = (
    "photo",
    "identity",
    "skills",
    "languages",
    "availability",
    "verified_credential",
    "work_history",
    "payment_details",
)


def _exists(app_label: str, model_name: str, **filters) -> bool:
    from django.apps import apps as django_apps

    try:
        model = django_apps.get_model(app_label, model_name)
    except LookupError:
        return False
    return model.objects.filter(**filters).exists()


def _payment_done(worker: Worker) -> bool:
    if worker.payment_method == "bank":
        return bool(worker.bank_name and worker.bank_account_no)
    if worker.payment_method in ("esewa", "khalti"):
        return bool(worker.wallet_id)
    return False  # cash: nothing to record, but digital pay is what we nudge towards


def profile_completeness(worker: Worker) -> dict:
    """``{percent, missing: [key], items: [{key, done, label}]}`` — 8 equally weighted checks."""
    done = {
        "photo": bool(worker.photo),
        "identity": bool((worker.citizenship_no or worker.nid_no) and worker.id_front),
        "skills": worker.skills.exists(),
        "languages": worker.languages.exists(),
        "availability": bool(
            worker.expected_monthly_wage
            or worker.available_from
            or (worker.pk and worker.preferred_districts.exists())
        ),
        "verified_credential": _exists("credentials", "Credential", worker=worker, status="verified"),
        "work_history": worker.employments.exists()
        or _exists("experience", "WorkHistoryEntry", worker=worker, status__in=_HISTORY_OK),
        "payment_details": _payment_done(worker),
    }
    items = [
        {"key": k, "done": done[k], "label": labels.label(worker_labels.COMPLETENESS, k)}
        for k in COMPLETENESS_KEYS
    ]
    n = sum(1 for k in COMPLETENESS_KEYS if done[k])
    return {
        "percent": round(n * 100 / len(COMPLETENESS_KEYS)),
        "missing": [k for k in COMPLETENESS_KEYS if not done[k]],
        "items": items,
    }


_HISTORY_OK = ("self_reported", "reference_pending", "verified")


# --------------------------------------------------------------------------- languages
def language_payload(rows) -> list[dict]:
    return [
        {
            "language": r.language,
            "language_label": labels.label(worker_labels.LANGUAGE, r.language),
            "proficiency": r.proficiency,
            "proficiency_label": labels.label(worker_labels.PROFICIENCY, r.proficiency),
        }
        for r in rows
    ]


@transaction.atomic
def set_languages(worker: Worker, rows: list[dict]) -> None:
    """Replace the worker's spoken languages with ``rows`` (validated ``{language, proficiency}``)."""
    keep = []
    for r in rows:
        obj, _ = WorkerLanguage.objects.update_or_create(
            worker=worker, language=r["language"], defaults={"proficiency": r["proficiency"]}
        )
        keep.append(obj.pk)
    worker.languages.exclude(pk__in=keep).delete()


# --------------------------------------------------------------------------- trade search
def matching_trade_codes(q: str) -> set[str]:
    """Trade codes whose code, English/Nepali name or any alias contains ``q`` (case-insensitive)."""
    q = (q or "").strip()
    if not q:
        return set()
    codes = set(
        Trade.objects.filter(
            Q(code__icontains=q) | Q(name_en__icontains=q) | Q(name_ne__icontains=q)
        ).values_list("code", flat=True)
    )
    codes |= set(TradeAlias.objects.filter(alias__icontains=q).values_list("trade_id", flat=True))
    return codes
