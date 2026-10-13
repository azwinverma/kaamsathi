"""Remove Bolau data left behind by local E2E runs (dev only; dry-run unless ``--apply``).

* Bookings whose description starts with ``E2E:`` (web/e2e/bolau.spec.ts) — with their events,
  ratings, reports, booking-fee charges and the in-app notifications that point at them. A booking
  that has a dispute is skipped (disputes are trust records; resolve or remove them by hand).
* Test Sipalu made by web/e2e/bolau-join.spec.ts: phone ``98000009xx`` that is not a seeded demo
  phone, verification not ``verified``, Bolau switched off, no bookings (either side), no offers and
  no employments. The Worker (and its Sipalu profile, services, availability, portfolio, consents,
  skills) and the User are deleted.

Refuses to run unless ``DEBUG`` is on or the settings module is ``config.settings.dev``.
"""

from __future__ import annotations

import re

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import ProtectedError

E2E_PREFIX = "E2E:"
TEST_PHONE = re.compile(r"^98000009\d{2}$")


def dev_allowed() -> bool:
    return bool(settings.DEBUG) or str(getattr(settings, "SETTINGS_MODULE", "")).endswith("settings.dev")


def seeded_phones() -> set[str]:
    """Every phone the demo seed (seed_demo + Bolau demo) creates — never touched."""
    from apps.bolau import demo
    from apps.core.management.commands import seed_demo as sd

    phones = {p for p, *_ in demo.GHARDHANI} | {row[0] for row in demo.SIPALU}
    phones |= {sd.OWNER_PHONE, sd.SUPERVISOR_PHONE, sd.OPS_PHONE, sd.WORKER_USER_PHONE}
    for value in vars(sd).values():  # any other *_PHONE constant
        if isinstance(value, str) and re.fullmatch(r"98\d{8}", value):
            phones.add(value)
    return phones


def e2e_bookings():
    from apps.bolau.models import Booking

    return Booking.objects.filter(description__startswith=E2E_PREFIX).order_by("created_at")


def sipalu_candidates():
    """``(worker, reason_or_None)`` for every 98000009xx Sipalu; reason set = kept."""
    from apps.bolau.models import Booking, Offer
    from apps.workers.models import Worker

    seeded = seeded_phones()
    out = []
    qs = Worker.objects.filter(phone__startswith="98000009", sipalu__isnull=False).select_related("sipalu")
    for w in qs.order_by("phone"):
        p = w.sipalu
        reason = None
        if not TEST_PHONE.match(w.phone or "") or w.phone in seeded:
            reason = "seeded or not a test phone"
        elif w.verification_status == "verified":
            reason = "verified"
        elif p.bolau_enabled or p.public_indexable:
            reason = "public (Bolau on or indexable)"
        elif Booking.objects.filter(sipalu=w).exists() or (
            w.user_id and Booking.objects.filter(ghardhani_id=w.user_id).exists()
        ):
            reason = "has bookings"
        elif Offer.objects.filter(sipalu=w).exists():
            reason = "has offers"
        elif w.employments.exists():
            reason = "has employments"
        out.append((w, reason))
    return out


class Command(BaseCommand):
    help = "Dev only: remove E2E-created Bolau bookings and test Sipalu (dry run unless --apply)."

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true", help="Delete (default: only list what would go).")

    def handle(self, *args, **opts):
        if not dev_allowed():
            raise CommandError(
                "Refusing to run: needs DEBUG=True or DJANGO_SETTINGS_MODULE=config.settings.dev."
            )
        apply = opts["apply"]
        verb = "Deleting" if apply else "Would delete"
        totals = {
            "bookings": 0,
            "events": 0,
            "ratings": 0,
            "reports": 0,
            "charges": 0,
            "notifications": 0,
            "sipalu": 0,
            "users": 0,
            "skipped": 0,
        }

        # ------------------------------------------------------------------ bookings
        from apps.billing.models import Charge
        from apps.notifications.models import Notification

        for b in e2e_bookings():
            if b.disputes.exists():
                totals["skipped"] += 1
                self.stdout.write(f"  skip booking {b.code}: has a dispute")
                continue
            n_notes = Notification.objects.filter(data__booking_id=str(b.id))
            counts = (b.events.count(), b.ratings.count(), b.reports.count(), n_notes.count())
            charge = Charge.objects.filter(pk=b.fee_charge_id).first() if b.fee_charge_id else None
            if charge is not None and charge.invoice_lines.exists():
                charge = None  # invoiced: keep the charge (only SET_NULL from the booking)
            self.stdout.write(
                f"  {verb} booking {b.code} ({b.status}): {counts[0]} events, {counts[1]} ratings, "
                f"{counts[2]} reports, {'1 fee charge' if charge else 'no fee charge'}, "
                f"{counts[3]} notifications"
            )
            totals["bookings"] += 1
            totals["events"] += counts[0]
            totals["ratings"] += counts[1]
            totals["reports"] += counts[2]
            totals["notifications"] += counts[3]
            totals["charges"] += 1 if charge else 0
            if apply:
                with transaction.atomic():
                    n_notes.delete()
                    b.delete()  # events, ratings, reports cascade
                    if charge is not None:
                        charge.delete()

        # ------------------------------------------------------------------ test Sipalu
        for w, reason in sipalu_candidates():
            label = f"{w.phone} @{w.sipalu.handle}"
            if reason:
                totals["skipped"] += 1
                self.stdout.write(f"  keep Sipalu {label}: {reason}")
                continue
            self.stdout.write(
                f"  {verb} test Sipalu {label} ({w.verification_status}){' + user' if w.user_id else ''}"
            )
            if not apply:
                totals["sipalu"] += 1
                totals["users"] += 1 if w.user_id else 0
                continue
            try:
                with transaction.atomic():
                    user = w.user
                    w.delete()
                    if user is not None:
                        user.delete()
            except ProtectedError as exc:
                totals["skipped"] += 1
                blockers = sorted({type(o).__name__ for o in exc.protected_objects})
                self.stdout.write(f"    skipped {label}: protected by {blockers}")
                continue
            totals["sipalu"] += 1
            totals["users"] += 1 if user is not None else 0

        summary = ", ".join(f"{v} {k}" for k, v in totals.items())
        self.stdout.write(self.style.SUCCESS(f"{'Deleted' if apply else 'Dry run'}: {summary}"))
        if not apply:
            self.stdout.write("Nothing changed. Re-run with --apply to delete.")
