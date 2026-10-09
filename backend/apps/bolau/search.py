"""Discovery: ``GET /bolau/search`` ranking and ``GET /bolau/trades`` (docs/CONTRACT-BOLAU.md §3).

Score (0–100):
* availability for the asked slot 25 (asked date only: has hours that day 15; no date: free within
  7 days 10);
* trade match 20 (primary skill) / 15 (other skill or service);
* area 10 when the asked district is in the service area;
* rating 15 × Bayesian average / 5 (prior 4.0 with weight 5 ratings);
* completed jobs up to 10 (1 per job);
* response time up to 5 (≤ 15 min = 5, ≤ 60 = 3, ≤ 240 = 1);
* reliability score up to 15 (``trust.reliability_score`` / 100 × 15; unknown = 9).
``q`` matches trade code/name/aliases (Nepali + romanised) via ``apps.workers.services``, or the
Sipalu's name / headline.
"""

from __future__ import annotations

import datetime as dt
import statistics
from decimal import Decimal

from django.db.models import Prefetch, Q
from django.utils import timezone

from apps.core.geo import haversine_m
from apps.insights.services import K_ANONYMITY

from . import payloads, profiles
from .availability import next_available, on_time_off, within_rules
from .common import money
from .models import AvailabilityRule, Booking, SipaluService, TimeOff

PRIOR_MEAN, PRIOR_WEIGHT = Decimal("4.0"), 5


def bayes(avg, n) -> float:
    if not n or avg is None:
        return float(PRIOR_MEAN)
    return float((PRIOR_MEAN * PRIOR_WEIGHT + Decimal(avg) * n) / (PRIOR_WEIGHT + n))


def distance_band(profile, lat, lng) -> str | None:
    if lat is None or lng is None or profile.base_lat is None or profile.base_lng is None:
        return None
    km = haversine_m(float(profile.base_lat), float(profile.base_lng), float(lat), float(lng)) / 1000
    if km < 3:
        return "under_3_km"
    if km < 10:
        return "3_10_km"
    return "over_10_km"


def _slot(date: dt.date | None, time: dt.time | None, minutes: int = 60):
    if date is None or time is None:
        return None
    tz = timezone.get_current_timezone()
    start = timezone.make_aware(dt.datetime.combine(date, time), tz)
    return start, start + dt.timedelta(minutes=minutes)


def search(params: dict) -> list[tuple[float, dict]]:
    """Return ``[(score, context)]`` sorted best first; the view paginates and renders cards."""
    qs = (
        profiles.bookable_profiles()
        .select_related("worker", "worker__trust")
        .prefetch_related(
            Prefetch("services", queryset=SipaluService.objects.select_related("trade")),
            "worker__skills__trade",
            "availability",
            "time_off",
            "service_districts",
        )
    )
    trade = params.get("trade")
    q = (params.get("q") or "").strip()
    if trade:
        qs = qs.filter(
            Q(worker__skills__trade_id=trade) | Q(services__trade_id=trade, services__is_active=True)
        )
    q_trades: set[str] = set()
    if q:
        from apps.workers.services import matching_trade_codes

        q_trades = matching_trade_codes(q)
        qs = qs.filter(
            Q(worker__skills__trade_id__in=q_trades)
            | Q(services__trade_id__in=q_trades, services__is_active=True)
            | Q(worker__full_name__icontains=q)
            | Q(headline__icontains=q)
            | Q(headline_ne__icontains=q)
            | Q(services__title__icontains=q)
        )
    if params.get("instant"):
        qs = qs.filter(instant_booking=True)
    if params.get("min_rating") is not None:
        qs = qs.filter(rating_avg__gte=params["min_rating"])
    if params.get("language"):
        qs = qs.filter(worker__languages__language=params["language"])
    if params.get("gender"):
        qs = qs.filter(gender_visible=True, worker__gender=params["gender"])
    district = params.get("district")
    qs = qs.distinct()

    date, time = params.get("date"), params.get("time")
    slot = _slot(date, time)
    now = timezone.now()
    horizon = now + dt.timedelta(days=8)
    busy_rows = Booking.objects.filter(
        sipalu_id__in=qs.values("worker_id"),
        status__in=Booking.ACTIVE,
        scheduled_end__gt=now,
        scheduled_start__lt=horizon,
    ).values_list("sipalu_id", "scheduled_start", "scheduled_end")
    busy: dict = {}
    for wid, s, e in busy_rows:
        busy.setdefault(wid, []).append((s, e))

    max_price = params.get("max_price")
    lat, lng = params.get("lat"), params.get("lng")
    out = []
    for p in qs:
        rules: list[AvailabilityRule] = list(p.availability.all())
        time_off: list[TimeOff] = list(p.time_off.all())
        services = [s for s in p.services.all() if s.is_active]
        fp = payloads.from_price(services)
        if max_price is not None and (fp is None or Decimal(fp) > Decimal(max_price)):
            continue
        districts = {d.code for d in p.service_districts.all()} or (
            {p.worker.current_district_id} if p.worker.current_district_id else set()
        )
        if district and district not in districts:
            in_radius = False
            if p.service_radius_km and lat is not None and p.base_lat is not None:
                in_radius = haversine_m(float(p.base_lat), float(p.base_lng), float(lat), float(lng)) <= (
                    p.service_radius_km * 1000
                )
            if not in_radius:
                continue
        my_busy = busy.get(p.worker_id, [])
        nxt = next_available(p, rules=rules, time_off=time_off, busy=my_busy, now=now)
        score = 0.0
        if slot:
            s, e = slot
            free = (
                within_rules(rules, s, e)
                and not on_time_off(p, s, e, time_off)
                and not any(bs < e and be > s for bs, be in my_busy)
            )
            score += 25 if free else 0
        elif date:
            from apps.core.bs import js_weekday

            day_ok = any(r.weekday == js_weekday(date) for r in rules) and not any(
                t.from_date <= date <= t.to_date for t in time_off
            )
            score += 15 if day_ok else 0
        elif nxt is not None:
            score += 10
        skills = sorted(p.worker.skills.all(), key=lambda s: -s.years_experience)
        wanted = {trade} if trade else q_trades
        top_trade = None
        if wanted:
            if skills and skills[0].trade_id in wanted:
                score += 20
                top_trade = skills[0].trade
            elif any(s.trade_id in wanted for s in skills) or any(s.trade_id in wanted for s in services):
                score += 15
                match = next((s.trade for s in skills if s.trade_id in wanted), None) or next(
                    (s.trade for s in services if s.trade_id in wanted), None
                )
                top_trade = match
        if district and district in districts:
            score += 10
        score += 15 * bayes(p.rating_avg, p.rating_count) / 5
        score += min(p.jobs_completed, 10)
        rt = p.response_time_minutes
        score += (
            5
            if rt is not None and rt <= 15
            else 3
            if rt is not None and rt <= 60
            else 1
            if rt is not None and rt <= 240
            else 0
        )
        trust = getattr(p.worker, "trust", None) if hasattr(p.worker, "trust") else None
        reliability = getattr(trust, "reliability_score", None)
        score += 15 * (reliability / 100) if reliability is not None else 9
        out.append(
            (
                round(score, 2),
                {"profile": p, "next": nxt, "band": distance_band(p, lat, lng), "top_trade": top_trade},
            )
        )
    out.sort(key=lambda x: (-x[0], x[1]["profile"].handle))
    return out


def trades_summary() -> list[dict]:
    """Trades with ≥ 1 bookable Sipalu + typical services; price stats only with ≥ 5 distinct Sipalu."""
    from apps.workers.models import Trade

    services = list(
        SipaluService.objects.filter(is_active=True, profile__in=profiles.bookable_profiles()).select_related(
            "trade"
        )
    )
    by_trade: dict[str, list] = {}
    for s in services:
        by_trade.setdefault(s.trade_id, []).append(s)
    trades = {t.code: t for t in Trade.objects.filter(code__in=by_trade)}
    out = []
    for code, rows in by_trade.items():
        t = trades[code]
        sipalu_ids = {s.profile_id for s in rows}
        titles: dict[str, int] = {}
        for s in rows:
            titles[s.title] = titles.get(s.title, 0) + 1
        price_stats = {}
        for kind in ("fixed", "hourly"):
            vals = [s for s in rows if s.price_type == kind]
            if len({s.profile_id for s in vals}) >= K_ANONYMITY:
                prices = sorted(float(s.price) for s in vals)
                price_stats[kind] = {
                    "median": money(statistics.median(prices)),
                    "min": money(prices[0]),
                    "max": money(prices[-1]),
                }
            else:
                price_stats[kind] = None
        out.append(
            {
                "code": t.code,
                "name_en": t.name_en,
                "name_ne": t.name_ne,
                "category": t.category,
                "sipalu_count": len(sipalu_ids),
                "typical_services": [
                    k for k, _ in sorted(titles.items(), key=lambda kv: (-kv[1], kv[0]))[:5]
                ],
                "price": price_stats,
                "k_anonymity": K_ANONYMITY,
            }
        )
    out.sort(key=lambda r: (-r["sipalu_count"], r["name_en"]))
    return out
