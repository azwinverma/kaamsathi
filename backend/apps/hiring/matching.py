"""Matching configuration (K001), persisted runs (K010) and algorithm versioning (K012).

* ``MatchConfig`` (singleton) holds ops-editable weights; defaults are the v2 constants, so an
  untouched install scores exactly as before. Every save bumps ``revision``.
* ``ALGORITHM_VERSION`` names the scoring code. A ``MatchRun`` records it together with a snapshot of
  the weights (and revision) and the ranked ``MatchCandidate`` rows. ``GET /ops/jobs/{id}/matches``
  reuses a run younger than 10 minutes with the same version + revision unless ``?refresh=1``.
* Shortlisting copies the worker's score and the version onto the ``Application``.
"""

from __future__ import annotations

import datetime as dt

from django.db import transaction
from django.utils import timezone

from apps.core.exceptions import APIError

from .models import Application, MatchCandidate, MatchConfig, MatchRun

ALGORITHM_VERSION = "v2.1"
RUN_REUSE_MINUTES = 10
MAX_PERSISTED = 100

DEFAULT_WEIGHTS: dict[str, int] = {
    "trade": 50,
    "district": 20,
    "verified": 10,
    "nstb_per_level": 5,
    "experience_per_year": 1,
    "experience_max": 10,
    "reliability_max": 5,
    "preferred_district": 5,
    "outcomes_max": 5,
    "requirement_met": 5,
    "wage_penalty": 10,
    "declined_penalty": 10,
}
# (min, max) per weight. Penalties are stored positive and subtracted.
WEIGHT_LIMITS: dict[str, tuple[int, int]] = {
    "trade": (1, 100),
    "district": (0, 100),
    "verified": (0, 100),
    "nstb_per_level": (0, 30),
    "experience_per_year": (0, 20),
    "experience_max": (0, 50),
    "reliability_max": (0, 50),
    "preferred_district": (0, 50),
    "outcomes_max": (0, 50),
    "requirement_met": (0, 50),
    "wage_penalty": (0, 100),
    "declined_penalty": (0, 100),
}


def get_config() -> MatchConfig:
    config, _ = MatchConfig.objects.get_or_create(pk=1, defaults={"weights": dict(DEFAULT_WEIGHTS)})
    return config


def current_weights() -> dict[str, int]:
    """Defaults overlaid with the stored config (unknown keys ignored)."""
    config = MatchConfig.objects.filter(pk=1).first()
    stored = config.weights if config else {}
    return {k: int(stored.get(k, v)) for k, v in DEFAULT_WEIGHTS.items()}


def current_revision() -> int:
    config = MatchConfig.objects.filter(pk=1).only("revision").first()
    return config.revision if config else 0


def validate_weights(data) -> dict[str, int]:
    """Partial update → full validated weights; 400 ``validation_error`` with per-key messages."""
    if not isinstance(data, dict):
        raise APIError("validation_error", fields={"weights": ["Expected an object of weights."]})
    errors: dict[str, list[str]] = {}
    merged = current_weights()
    for key, value in data.items():
        if key not in WEIGHT_LIMITS:
            errors[f"weights.{key}"] = ["Unknown weight."]
            continue
        if isinstance(value, bool) or not isinstance(value, int):
            errors[f"weights.{key}"] = ["Must be a whole number."]
            continue
        lo, hi = WEIGHT_LIMITS[key]
        if not lo <= value <= hi:
            errors[f"weights.{key}"] = [f"Must be between {lo} and {hi}."]
            continue
        merged[key] = value
    if errors:
        raise APIError("validation_error", fields=errors)
    return merged


@transaction.atomic
def update_config(weights: dict, user) -> MatchConfig:
    config = MatchConfig.objects.select_for_update().filter(pk=1).first() or get_config()
    config.weights = weights
    config.revision = (config.revision or 0) + 1
    config.updated_by = user if getattr(user, "is_authenticated", False) else None
    config.save()
    return config


def reset_config(user) -> MatchConfig:
    return update_config(dict(DEFAULT_WEIGHTS), user)


def config_payload(config: MatchConfig | None = None) -> dict:
    config = config or get_config()
    return {
        "algorithm_version": ALGORITHM_VERSION,
        "revision": config.revision,
        "weights": current_weights(),
        "defaults": dict(DEFAULT_WEIGHTS),
        "limits": {k: {"min": lo, "max": hi} for k, (lo, hi) in WEIGHT_LIMITS.items()},
        "updated_by": (
            {"id": str(config.updated_by_id), "full_name": config.updated_by.full_name}
            if config.updated_by_id
            else None
        ),
        "updated_at": timezone.localtime(config.updated_at).isoformat() if config.updated_at else None,
    }


# --------------------------------------------------------------------------- runs
@transaction.atomic
def create_run(job, user=None) -> MatchRun:
    from .services import score_candidates

    revision = current_revision()
    scored = score_candidates(job)
    run = MatchRun.objects.create(
        job=job,
        algorithm_version=ALGORITHM_VERSION,
        config={"revision": revision, "weights": current_weights()},
        candidates_count=len(scored),
        created_by=user if getattr(user, "is_authenticated", False) else None,
    )
    MatchCandidate.objects.bulk_create(
        [
            MatchCandidate(
                run=run,
                worker=c["worker"],
                score=c["score"],
                rank=i + 1,
                explain={"points": c["explain"], "reasons": c["reasons"], "requirements": c["requirements"]},
            )
            for i, c in enumerate(scored[:MAX_PERSISTED])
        ]
    )
    return run


def run_for(job, *, user=None, refresh: bool = False) -> MatchRun:
    """The reusable recent run for ``job`` or a fresh one."""
    if not refresh:
        since = timezone.now() - dt.timedelta(minutes=RUN_REUSE_MINUTES)
        run = (
            MatchRun.objects.filter(job=job, created_at__gte=since, algorithm_version=ALGORITHM_VERSION)
            .order_by("-created_at")
            .first()
        )
        if run is not None and run.config.get("revision") == current_revision():
            return run
    return create_run(job, user)


def rows_from_run(run: MatchRun, limit: int, request=None) -> list[dict]:
    """Match rows from a persisted run, skipping workers who entered the pipeline since."""
    from apps.workers.models import Worker
    from apps.workers.serializers import card_queryset, worker_card

    job = run.job
    in_pipeline = set(
        Application.employer_visible(job.applications.all()).values_list("worker_id", flat=True)
    )
    interested = set(
        job.applications.filter(stage="sourced", source="worker_interest").values_list("worker_id", flat=True)
    )
    cands = [c for c in run.candidates.order_by("rank") if c.worker_id not in in_pipeline][:limit]
    workers = {w.pk: w for w in card_queryset(Worker.objects.filter(pk__in=[c.worker_id for c in cands]))}
    rows = []
    for c in cands:
        w = workers.get(c.worker_id)
        if w is None:
            continue
        rows.append(
            {
                "worker": worker_card(w, request),
                "score": c.score,
                "reasons": c.explain.get("reasons", []),
                "explain": c.explain.get("points", {}),
                "requirements": c.explain.get("requirements", []),
                "interested": w.pk in interested,
                "rank": c.rank,
                "run_id": str(run.id),
                "algorithm_version": run.algorithm_version,
            }
        )
    return rows


def run_payload(run: MatchRun, *, with_candidates: bool = False, request=None) -> dict:
    data = {
        "id": str(run.id),
        "job_id": str(run.job_id),
        "algorithm_version": run.algorithm_version,
        "config": run.config,
        "candidates_count": run.candidates_count,
        "created_by": (
            {"id": str(run.created_by_id), "full_name": run.created_by.full_name}
            if run.created_by_id
            else None
        ),
        "created_at": timezone.localtime(run.created_at).isoformat(),
    }
    if with_candidates:
        cands = list(run.candidates.select_related("worker").order_by("rank"))
        data["candidates"] = [
            {
                "rank": c.rank,
                "score": c.score,
                "worker": {"id": str(c.worker_id), "full_name": c.worker.full_name},
                "explain": c.explain.get("points", {}),
                "reasons": c.explain.get("reasons", []),
                "requirements": c.explain.get("requirements", []),
            }
            for c in cands
        ]
    return data


def score_for_shortlist(job, worker) -> tuple[int, str]:
    """(score, algorithm_version) to stamp on a new shortlist: the latest persisted run's score for
    this worker, else a live score."""
    cand = (
        MatchCandidate.objects.filter(run__job=job, worker=worker)
        .select_related("run")
        .order_by("-run__created_at")
        .first()
    )
    if cand is not None:
        return cand.score, cand.run.algorithm_version
    from .services import match_explain

    return match_explain(job, worker)[0], ALGORITHM_VERSION
