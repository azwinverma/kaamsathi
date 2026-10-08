"""Versioned legal documents and acceptances (PRIV-02).

``pending_for(user)`` = current terms + privacy not yet accepted, plus the current employer
agreement for organisation owners and the worker agreement for users linked to a worker profile
(only when such a document is published). Clients show an accept screen while it is non-empty.
"""

from __future__ import annotations

from django.db import transaction

from .models import LegalAcceptance, LegalDocument

ALWAYS = ("terms", "privacy")


def required_kinds(user) -> list[str]:
    kinds = list(ALWAYS)
    if user.memberships.filter(role="owner", is_active=True, organization__is_active=True).exists():
        kinds.append("employer_agreement")
    if hasattr(user, "worker"):
        try:
            if user.worker is not None:
                kinds.append("worker_agreement")
        except Exception:  # noqa: BLE001 — RelatedObjectDoesNotExist
            pass
    return kinds


def pending_for(user) -> list[LegalDocument]:
    if not (user and user.is_authenticated):
        return []
    docs = LegalDocument.objects.filter(is_current=True, kind__in=required_kinds(user))
    accepted = set(
        LegalAcceptance.objects.filter(user=user, document__in=docs).values_list("document_id", flat=True)
    )
    return [d for d in docs if d.pk not in accepted]


def doc_ref(doc: LegalDocument) -> dict:
    return {"id": str(doc.pk), "kind": doc.kind, "version": doc.version, "url": doc.url}


def accept(user, documents, *, ip=None, user_agent="", channel="other") -> list[LegalAcceptance]:
    out = []
    with transaction.atomic():
        for doc in documents:
            obj, _ = LegalAcceptance.objects.get_or_create(
                user=user,
                document=doc,
                defaults={"ip": ip, "user_agent": (user_agent or "")[:300], "channel": channel},
            )
            out.append(obj)
    return out
