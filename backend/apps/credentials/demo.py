"""Demo credentials, assessments and passports (called by ``seed_demo``; idempotent)."""

from __future__ import annotations

import datetime as dt

from django.utils import timezone

from apps.core.bs import today_ad

RAM_PHONE = "9800000010"
RAM_PUBLIC_CODE = "ramthapa83"
NSTB = "National Skill Testing Board (NSTB)"

# trade → [(kind, title, issuer, level, valid_years | None)]
TEMPLATES = {
    "cook": [
        ("nstb", "Cook — NSTB skill test", NSTB, "Level 2", None),
        ("safety", "Food Safety & Hygiene", "Department of Food Technology and Quality Control", None, 2),
    ],
    "kitchen_helper": [
        ("safety", "Food Safety & Hygiene", "Department of Food Technology and Quality Control", None, 2)
    ],
    "housekeeping": [("nstb", "Housekeeping — NSTB skill test", NSTB, "Level 1", None)],
    "waiter": [("ctevt_training", "Food & Beverage Service (390 hrs)", "CTEVT", "Level 1", None)],
    "security_guard": [("safety", "First Aid Certificate", "Nepal Red Cross Society", None, 2)],
    "driver": [("license", "Driving Licence — Category B", "Department of Transport Management", "B", 5)],
    "heavy_driver": [
        ("license", "Driving Licence — Category E", "Department of Transport Management", "E", 5)
    ],
    "mason": [("nstb", "Mason — NSTB skill test", NSTB, "Level 2", None)],
    "carpenter": [("nstb", "Carpenter — NSTB skill test", NSTB, "Level 2", None)],
    "electrician": [
        ("nstb", "Building Electrician — NSTB skill test", NSTB, "Level 1", None),
        ("safety", "Electrical Safety at Work", "Nepal Electricity Authority Training Centre", None, 2),
    ],
    "plumber": [("nstb", "Plumber — NSTB skill test", NSTB, "Level 1", None)],
    "welder": [("ctevt_training", "Arc Welding (390 hrs)", "CTEVT", "Level 1", None)],
    "rebar_worker": [
        ("safety", "Construction Site Safety", "Federation of Contractors' Associations of Nepal", None, 3)
    ],
    "helper": [
        ("safety", "Construction Site Safety", "Federation of Contractors' Associations of Nepal", None, 3)
    ],
    "machine_operator": [
        ("license", "Heavy Equipment Operator Licence", "Department of Transport Management", None, 5)
    ],
}
DEFAULT = [("language", "Basic English for Workplace", "Kathmandu Language Centre", "A2", None)]

# Index-driven status mix (deterministic → idempotent).
#   0 verified · 1 verified, expiring in ~12 days · 2 pending · 3 verified · 4 rejected
#   5 verified, expired last month · 6 pending · 7 verified, expiring in 25 days
PLAN = ["verified", "expiring_12", "pending", "verified", "rejected", "expired", "pending", "expiring_25"]


def seed(stdout, rng) -> None:
    from apps.credentials.models import Credential, Passport, PassportShare, SkillAssessment
    from apps.credentials.services import get_passport
    from apps.workers.models import Trade, Worker

    today = today_ad()
    ops = _ops_user()
    workers = list(
        Worker.objects.filter(phone__startswith="980000")
        .prefetch_related("skills__trade")
        .order_by("phone")[:22]
    )
    created = 0
    for idx, worker in enumerate(workers):
        skills = list(worker.skills.all())
        trade = skills[0].trade_id if skills else None
        templates = TEMPLATES.get(trade, DEFAULT)
        for t_idx, (kind, title, issuer, level, valid_years) in enumerate(templates):
            plan = "verified" if worker.phone == RAM_PHONE else PLAN[(idx + t_idx) % len(PLAN)]
            issued = today - dt.timedelta(days=200 + rng.randint(0, 900))
            expires = issued + dt.timedelta(days=365 * valid_years) if valid_years else None
            status = "verified"
            if plan == "pending":
                status = "pending"
            elif plan == "rejected":
                status = "rejected"
            elif plan.startswith("expiring_"):
                expires = today + dt.timedelta(days=int(plan.split("_")[1]))
            elif plan == "expired":
                expires = today - dt.timedelta(days=30)
                status = "expired"
            if status == "verified" and expires and expires < today:
                expires = today + dt.timedelta(days=180 + rng.randint(0, 400))
            cert_no = f"{kind.upper()[:4]}-{issued.year}-{worker.phone[-5:]}{t_idx}"
            cred, was_created = Credential.objects.get_or_create(
                worker=worker,
                title=title,
                defaults={
                    "kind": kind,
                    "issuer": issuer,
                    "level": level,
                    "certificate_no": cert_no,
                    "issued_on": issued,
                    "expires_on": expires,
                    "status": status,
                    "verification_method": None
                    if status == "pending"
                    else ("ops_call" if kind == "license" else "document"),
                    "verified_by": None if status == "pending" else ops,
                    "verified_at": None
                    if status == "pending"
                    else timezone.now() - dt.timedelta(days=rng.randint(5, 120)),
                    "note": "Certificate number does not match issuer records."
                    if status == "rejected"
                    else None,
                },
            )
            created += int(was_created)

    # Skill assessments (KaamSathi ops-run practical tests).
    assessments = 0
    by_phone = {w.phone: w for w in workers}
    plans = [
        (
            RAM_PHONE,
            "cook",
            "pass",
            86,
            "Level 2",
            "Strong on Nepali thali and continental breakfast; good hygiene.",
        ),
        (
            "9800000102",
            "waiter",
            "pass",
            74,
            "Level 1",
            "Good service etiquette; needs practice on wine service.",
        ),
        (
            "9800000107",
            "waiter",
            "fail",
            48,
            None,
            "Re-test recommended after 4 weeks of supervised practice.",
        ),
    ]
    for phone, trade_code, result, score, level, notes in plans:
        worker = by_phone.get(phone) or Worker.objects.filter(phone=phone).first()
        trade = Trade.objects.filter(code=trade_code).first()
        if not worker or not trade:
            continue
        _, was_created = SkillAssessment.objects.get_or_create(
            worker=worker,
            trade=trade,
            defaults={
                "assessed_on": today - dt.timedelta(days=rng.randint(20, 90)),
                "result": result,
                "score": score,
                "level": level,
                "notes": notes,
                "assessor_user": ops,
            },
        )
        assessments += int(was_created)

    # Ram's passport is public (demo of /p/<code>) with an active share link for a hotel.
    ram = Worker.objects.filter(phone=RAM_PHONE).first()
    if ram:
        passport = Passport.objects.filter(worker=ram).first()
        if passport is None:
            if Passport.objects.filter(public_code=RAM_PUBLIC_CODE).exists():
                passport = get_passport(ram)
            else:
                passport = Passport.objects.create(worker=ram, public_code=RAM_PUBLIC_CODE)
        passport.is_public = True
        passport.save(update_fields=["is_public", "updated_at"])
        if not PassportShare.objects.filter(worker=ram, audience_label="Hotel Everest Crown HR").exists():
            PassportShare.objects.create(
                worker=ram,
                audience_label="Hotel Everest Crown HR",
                purpose="job",
                expires_at=timezone.now() + dt.timedelta(days=30),
                include_contact=True,
                views=3,
            )
        stdout.write(f"  Skill Passport (public): /p/{passport.public_code}")

    for worker in workers:
        _recompute(worker)
    stdout.write(f"  Credentials: {created} created, {assessments} assessments")


def _ops_user():
    from apps.accounts.models import User

    return User.objects.filter(is_staff=True).order_by("date_joined").first()


def _recompute(worker):
    from apps.credentials.services import recompute_trust

    recompute_trust(worker)
