"""Fraud detectors. Each returns the number of flags it raised or refreshed.

* ``duplicate_identity(worker)`` — on Worker save (signal): same citizenship / NID blind index.
* nightly ``apps.risk.tasks.scan``: ``shared_bank_accounts``, ``document_reuse``,
  ``attendance_anomalies`` (outside geofence, buddy punching, check-out before check-in) and
  ``onboarding_velocity``.

Detectors never store plaintext identifiers in a flag: details carry worker ids and names only.
"""

from __future__ import annotations

import datetime as dt
import hashlib
import logging
from collections import defaultdict

from django.db.models import Q
from django.utils import timezone

from .services import flag

logger = logging.getLogger("kaamsathi.risk")

GEOFENCE_MIN_EVENTS = 3  # ≥ 3 check-ins outside the geofence …
GEOFENCE_WINDOW_DAYS = 7  # … within 7 days
BUDDY_WINDOW_SECONDS = 60
VELOCITY_MIN_ORGS = 3
VELOCITY_WINDOW_DAYS = 7


def _ref(worker) -> dict:
    return {"worker_id": str(worker.pk), "full_name": worker.full_name}


# --------------------------------------------------------------------------- on save
def duplicate_identity(worker) -> int:
    """Flag ``worker`` and every other worker sharing its citizenship or NID number (high)."""
    from apps.workers.models import Worker

    q = Q()
    if worker.citizenship_no_hash:
        q |= Q(citizenship_no_hash=worker.citizenship_no_hash)
    if worker.nid_no_hash:
        q |= Q(nid_no_hash=worker.nid_no_hash)
    if not q:
        return 0
    others = list(Worker.objects.filter(q).exclude(pk=worker.pk))
    raised = 0
    for other in others:
        reasons = []
        if worker.citizenship_no_hash and other.citizenship_no_hash == worker.citizenship_no_hash:
            reasons.append("same_citizenship")
        if worker.nid_no_hash and other.nid_no_hash == worker.nid_no_hash:
            reasons.append("same_nid")
        for a, b in ((worker, other), (other, worker)):
            flag(a, "duplicate_identity", "high", {"reasons": reasons, "matches": [_ref(b)]})
            raised += 1
    return raised


# --------------------------------------------------------------------------- nightly
def shared_bank_accounts() -> int:
    """Workers whose bank account numbers match (blind index computed in memory)."""
    from apps.core.crypto import blind_index
    from apps.workers.models import Worker

    groups: dict[str, list] = defaultdict(list)
    for w in (
        Worker.objects.exclude(bank_account_no__isnull=True)
        .exclude(bank_account_no="")
        .only("id", "full_name", "bank_account_no", "bank_name")
    ):
        h = blind_index(w.bank_account_no, "bank")
        if h:
            groups[h].append(w)
    raised = 0
    for members in groups.values():
        if len(members) < 2:
            continue
        for w in members:
            matches = [_ref(o) for o in members if o.pk != w.pk]
            flag(w, "shared_bank_account", "medium", {"reasons": ["same_bank_account"], "matches": matches})
            raised += 1
    return raised


def _file_sha256(field_file) -> str | None:
    if not field_file or not getattr(field_file, "name", None):
        return None
    try:
        h = hashlib.sha256()
        with field_file.storage.open(field_file.name, "rb") as fh:
            for chunk in iter(lambda: fh.read(64 * 1024), b""):
                h.update(chunk)
        return h.hexdigest()
    except Exception:  # noqa: BLE001 - missing file in storage: nothing to compare
        return None


def _worker_documents():
    """Yield (worker, document_label, FieldFile) for every stored worker document."""
    from django.apps import apps

    from apps.workers.models import Worker

    for w in Worker.objects.filter(Q(id_front__gt="") | Q(id_back__gt="") | Q(photo__gt="")).only(
        "id", "full_name", "id_front", "id_back", "photo"
    ):
        for field in ("id_front", "id_back", "photo"):
            ff = getattr(w, field)
            if ff:
                yield w, field, ff
    if apps.is_installed("apps.credentials"):
        Credential = apps.get_model("credentials", "Credential")
        for c in (
            Credential.objects.select_related("worker").exclude(document="").exclude(document__isnull=True)
        ):
            yield c.worker, "credential", c.document


def document_reuse() -> int:
    """The same file (sha256) uploaded for two or more different workers."""
    by_hash: dict[str, dict] = defaultdict(dict)
    for worker, label, ff in _worker_documents():
        digest = _file_sha256(ff)
        if digest:
            by_hash[digest].setdefault(worker.pk, (worker, set()))[1].add(label)
    raised = 0
    for workers in by_hash.values():
        if len(workers) < 2:
            continue
        for wid, (w, docs) in workers.items():
            matches = [_ref(o) for oid, (o, _d) in workers.items() if oid != wid]
            flag(
                w,
                "document_reuse",
                "high",
                {"reasons": ["same_document"], "documents": sorted(docs), "matches": matches},
            )
            raised += 1
    return raised


def attendance_anomalies(now=None) -> int:
    from apps.core.geo import haversine_m
    from apps.workforce.models import Attendance

    now = now or timezone.now()
    since = now - dt.timedelta(days=GEOFENCE_WINDOW_DAYS)
    rows = list(
        Attendance.objects.filter(check_in_at__gte=since, check_in_at__lte=now)
        .select_related("employment__site", "employment__worker", "employment__organization")
        .order_by("check_in_at")
    )
    raised = 0

    # 1. ≥3 check-ins outside the site geofence within 7 days (per employment) → geo_anomaly
    outside: dict = defaultdict(list)
    for a in rows:
        site = a.employment.site
        if (
            site is None
            or site.lat is None
            or site.lng is None
            or a.check_in_lat is None
            or a.check_in_lng is None
        ):
            continue
        dist = haversine_m(site.lat, site.lng, a.check_in_lat, a.check_in_lng)
        if dist > float(site.geofence_radius_m or 0):
            outside[a.employment].append((a, round(dist)))
    for emp, events in outside.items():
        if len(events) >= GEOFENCE_MIN_EVENTS:
            flag(
                emp,
                "geo_anomaly",
                "medium",
                {
                    "reasons": ["outside_geofence"],
                    "worker": _ref(emp.worker),
                    "events": [{"date": a.date.isoformat(), "distance_m": d} for a, d in events[-10:]],
                },
            )
            raised += 1

    # 2. buddy punching: identical coordinates, different workers, check-ins within 60 s → each record
    by_coords: dict = defaultdict(list)
    for a in rows:
        if a.check_in_lat is None or a.check_in_lng is None:
            continue
        by_coords[(a.check_in_lat, a.check_in_lng)].append(a)
    for group in by_coords.values():
        if len(group) < 2:
            continue
        group.sort(key=lambda r: r.check_in_at)
        for a in group:
            buddies = [
                b
                for b in group
                if b is not a
                and b.employment.worker_id != a.employment.worker_id
                and abs((b.check_in_at - a.check_in_at).total_seconds()) <= BUDDY_WINDOW_SECONDS
            ]
            if not buddies:
                continue
            flag(
                a,
                "attendance_anomaly",
                "high",
                {
                    "reasons": ["buddy_punching"],
                    "worker": _ref(a.employment.worker),
                    "matches": [_ref(b.employment.worker) for b in buddies],
                },
            )
            raised += 1

    # 3. check-out recorded before check-in
    for a in rows:
        if a.check_out_at and a.check_in_at and a.check_out_at < a.check_in_at:
            flag(
                a,
                "attendance_anomaly",
                "low",
                {"reasons": ["checkout_before_checkin"], "worker": _ref(a.employment.worker)},
            )
            raised += 1
    return raised


def onboarding_velocity(now=None) -> int:
    """A worker onboarded by ≥ 3 different organisations within 7 days."""
    from apps.workers.models import Worker
    from apps.workforce.models import Employment

    now = now or timezone.now()
    since = now - dt.timedelta(days=VELOCITY_WINDOW_DAYS)
    orgs: dict = defaultdict(dict)
    for emp in Employment.objects.filter(created_at__gte=since).select_related("organization"):
        orgs[emp.worker_id][emp.organization_id] = emp.organization.name
    raised = 0
    flagged = {wid: names for wid, names in orgs.items() if len(names) >= VELOCITY_MIN_ORGS}
    for worker in Worker.objects.filter(pk__in=flagged):
        flag(
            worker,
            "velocity",
            "medium",
            {
                "reasons": ["onboarded_by_many"],
                "organizations": sorted(flagged[worker.pk].values()),
                "window_days": VELOCITY_WINDOW_DAYS,
            },
        )
        raised += 1
    return raised


NIGHTLY = {
    "shared_bank_account": shared_bank_accounts,
    "document_reuse": document_reuse,
    "attendance": attendance_anomalies,
    "velocity": onboarding_velocity,
}


def run_all() -> dict:
    results = {}
    for name, fn in NIGHTLY.items():
        try:
            results[name] = fn()
        except Exception:  # noqa: BLE001 - one detector failing must not stop the others
            logger.exception("Risk detector %s failed", name)
            results[name] = None
    return results
