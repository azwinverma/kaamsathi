"""Shared builders for tests/test_bolau_*.py."""

from __future__ import annotations

import datetime as dt
from decimal import Decimal

from django.utils import timezone

from apps.bolau.models import Address, AvailabilityRule, SipaluProfile, SipaluService
from apps.core.models import FeatureFlag
from tests import factories as f
from tests.conftest import auth_client

ALL_DAY = [(d, dt.time(6, 0), dt.time(21, 0)) for d in range(7)]


def flag_on(key="bolau"):
    FeatureFlag.objects.update_or_create(
        key=key, defaults={"enabled": True, "rollout": "all", "client_visible": True}
    )


def flag_off(key="bolau"):
    FeatureFlag.objects.update_or_create(key=key, defaults={"enabled": False})


def make_sipalu(
    handle="ram-electric",
    trade="electrician",
    *,
    verified=True,
    instant=False,
    district="kathmandu",
    price_type="fixed",
    price="600",
    visit_fee=None,
    minutes=60,
    rules=ALL_DAY,
    consent=True,
):
    user = f.UserFactory(full_name=f"{handle.title()} Thapa")
    worker = f.WorkerFactory(
        user=user,
        phone=user.phone,
        full_name=user.full_name,
        verification_status="verified" if verified else "pending",
        current_district=f.district(district),
    )
    f.WorkerSkillFactory(worker=worker, trade=f.trade(trade), years_experience=6)
    profile = SipaluProfile.objects.create(
        worker=worker,
        handle=handle,
        headline=f"{trade} at your door",
        bolau_enabled=True,
        instant_booking=instant,
        public_consent_at=timezone.now() if consent else None,
    )
    profile.service_districts.add(district)
    service = SipaluService.objects.create(
        profile=profile,
        trade=f.trade(trade),
        title=f"{trade} visit",
        price_type=price_type,
        price=Decimal(price),
        visit_fee=Decimal(visit_fee) if visit_fee else None,
        estimated_minutes=minutes,
    )
    for d, s, e in rules:
        AvailabilityRule.objects.create(profile=profile, weekday=d, start_time=s, end_time=e)
    return profile, service, auth_client(user)


def make_ghardhani(district="kathmandu", phone=None):
    user = f.UserFactory(full_name="Sita Sharma", **({"phone": phone} if phone else {}))
    addr = Address.objects.create(
        ghardhani=user,
        line="House 12, Bhatbhateni Marg",
        ward=4,
        municipality="Kathmandu Metropolitan City",
        district=f.district(district),
        landmark="Near the blue gate",
        lat=Decimal("27.717200"),
        lng=Decimal("85.324000"),
        is_default=True,
    )
    return user, addr, auth_client(user)


def tomorrow_at(hour=10, minute=0, days=1):
    tz = timezone.get_current_timezone()
    day = timezone.localtime(timezone.now()).date() + dt.timedelta(days=days)
    return timezone.make_aware(dt.datetime.combine(day, dt.time(hour, minute)), tz)


def book(client, profile, addr, service=None, start=None, **extra):
    body = {
        "sipalu_handle": profile.handle,
        "address_id": str(addr.id),
        "scheduled_start": (start or tomorrow_at()).isoformat(),
        "description": "Fan is not working",
        **extra,
    }
    if service is not None:
        body["service_id"] = str(service.id)
    return client.post("/api/v1/bolau/bookings", body, format="json")
