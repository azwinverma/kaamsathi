"""Bolau demo seed: idempotent, flag on, every booking status present."""

import io
import random

import pytest

from apps.bolau import demo
from apps.bolau.models import Booking, KaamRequest, Offer, SipaluProfile
from apps.core.flags import is_enabled

pytestmark = pytest.mark.django_db


def test_demo_seed_idempotent_and_complete():
    out = io.StringIO()
    demo.seed(out, random.Random("t"))
    assert is_enabled("bolau") and not is_enabled("bolau_fee")
    n = Booking.objects.count()
    statuses = set(Booking.objects.values_list("status", flat=True))
    assert statuses >= {
        "requested", "accepted", "on_the_way", "arrived", "in_progress", "completed", "confirmed",
        "declined", "expired", "cancelled", "no_show", "disputed",
    }  # fmt: skip
    assert SipaluProfile.objects.filter(worker__verification_status="verified").count() >= 12
    assert KaamRequest.objects.count() == 2 and Offer.objects.count() == 3
    assert SipaluProfile.objects.filter(rating_count__gt=0).count() >= 10
    demo.seed(out, random.Random("t"))
    assert Booking.objects.count() == n and SipaluProfile.objects.count() == 12
