"""Prometheus metrics with counters kept in Redis (safe across gunicorn workers + Celery).

Metric families (``GET /metrics``, bearer ``METRICS_TOKEN``; 404 when unset):
* ``http_requests_total{method,status_class,group}`` and ``http_request_duration_seconds`` histogram,
  ``group`` = first two path segments after ``/api/v1`` (ids collapsed to ``:id``; unrouted = ``unmatched``)
* ``celery_tasks_total{task,state}``
* ``otp_requests_total{result}``
* ``sms_messages_total{backend,status}``

Each family is one Redis hash: field = canonical label string, value = counter. With a local-memory
cache (tests) an in-process store is used instead.
"""

from __future__ import annotations

import logging
import re
import threading
from collections import defaultdict

from django.conf import settings

logger = logging.getLogger("kaamsathi.metrics")

PREFIX = "ks:metrics:"
BUCKETS = (0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0)
HELP = {
    "http_requests_total": ("counter", "HTTP requests by method, status class and route group."),
    "http_request_duration_seconds": ("histogram", "HTTP request latency by route group."),
    "celery_tasks_total": ("counter", "Celery task outcomes."),
    "otp_requests_total": ("counter", "OTP verifications by result."),
    "sms_messages_total": ("counter", "SMS sends by backend and status."),
}
_WORD = re.compile(r"^[a-z][a-z0-9_\-.]{0,39}$")


class _MemoryStore:
    def __init__(self):
        self.data: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
        self.lock = threading.Lock()

    def incr(self, items: list[tuple[str, str, float]]):
        with self.lock:
            for key, field, amount in items:
                self.data[key][field] += amount

    def dump(self, key):
        with self.lock:
            return dict(self.data.get(key, {}))

    def reset(self):
        with self.lock:
            self.data.clear()


_memory = _MemoryStore()
_redis = None


def _use_memory() -> bool:
    backend = settings.CACHES.get("default", {}).get("BACKEND", "")
    return "locmem" in backend.lower() or "dummy" in backend.lower()


def _client():
    global _redis
    if _redis is None:
        import redis

        url = getattr(settings, "METRICS_REDIS_URL", "") or settings.REDIS_URL
        _redis = redis.Redis.from_url(url, socket_timeout=0.3, socket_connect_timeout=0.3)
    return _redis


def _labels(**labels) -> str:
    return ",".join(f'{k}="{_escape(str(v))}"' for k, v in sorted(labels.items()))


def _escape(v: str) -> str:
    return v.replace("\\", "\\\\").replace('"', '\\"').replace("\n", " ")[:120]


def _apply(items: list[tuple[str, str, float]]) -> None:
    if _use_memory():
        _memory.incr(items)
        return
    try:
        pipe = _client().pipeline(transaction=False)
        for key, field, amount in items:
            if float(amount).is_integer():
                pipe.hincrby(PREFIX + key, field, int(amount))
            else:
                pipe.hincrbyfloat(PREFIX + key, field, amount)
        pipe.execute()
    except Exception:  # noqa: BLE001 — never fail the caller because metrics are down
        logger.debug("metrics redis unavailable", exc_info=True)


def inc(name: str, amount: float = 1, **labels) -> None:
    _apply([(name, _labels(**labels), amount)])


def route_group(request) -> str:
    match = getattr(request, "resolver_match", None)
    if match is None:
        return "unmatched"
    path = request.path.strip("/")
    if path.startswith("api/v1/"):
        path = path[len("api/v1/") :]
    elif path == "api/v1":
        path = ""
    segs = [s for s in path.split("/") if s][:2]
    out = [s if _WORD.match(s) and not re.search(r"\d{3,}", s) else ":id" for s in segs]
    return "/".join(out) or "root"


def observe_request(request, status: int, seconds: float) -> None:
    group = route_group(request)
    if group == "metrics":
        return
    method = (
        request.method
        if request.method in {"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"}
        else "OTHER"
    )
    items = [
        ("http_requests_total", _labels(method=method, status_class=f"{status // 100}xx", group=group), 1),
        ("http_request_duration_seconds", _labels(group=group, le="sum"), round(seconds, 6)),
        ("http_request_duration_seconds", _labels(group=group, le="count"), 1),
    ]
    for b in BUCKETS:
        if seconds <= b:
            items.append(("http_request_duration_seconds", _labels(group=group, le=str(b)), 1))
    items.append(("http_request_duration_seconds", _labels(group=group, le="+Inf"), 1))
    _apply(items)


def _dump(name: str) -> dict[str, float]:
    if _use_memory():
        return _memory.dump(name)
    try:
        raw = _client().hgetall(PREFIX + name)
    except Exception:  # noqa: BLE001
        return {}
    return {k.decode(): float(v) for k, v in raw.items()}


def _num(v: float) -> str:
    return str(int(v)) if float(v).is_integer() else repr(v)


def render() -> str:
    lines: list[str] = []
    for name, (kind, help_text) in HELP.items():
        lines.append(f"# HELP {name} {help_text}")
        lines.append(f"# TYPE {name} {kind}")
        data = _dump(name)
        if kind != "histogram":
            for labels, value in sorted(data.items()):
                lines.append(f"{name}{{{labels}}} {_num(value)}")
            continue
        # fields look like: group="x",le="0.1" | le="sum" | le="count"
        for labels, value in sorted(data.items()):
            m = re.search(r'le="([^"]+)"', labels)
            le = m.group(1) if m else ""
            base = re.sub(r',?le="[^"]+"', "", labels).strip(",")
            if le == "sum":
                lines.append(f"{name}_sum{{{base}}} {_num(value)}")
            elif le == "count":
                lines.append(f"{name}_count{{{base}}} {_num(value)}")
            else:
                lines.append(f'{name}_bucket{{{base},le="{le}"}} {_num(value)}')
    return "\n".join(lines) + "\n"


def reset() -> None:
    """Tests only."""
    _memory.reset()
