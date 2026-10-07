"""Demo data for the trust layer (called from seed_demo). Idempotent."""

from __future__ import annotations

import datetime as dt

from django.utils import timezone

HOTEL = "Hotel Annapurna View Pvt. Ltd."
BUILDERS = "Shivam Builders & Construction"
OWNER_PHONE = "9800000001"
OPS_PHONE = "9800000003"

# worker → employer ratings (pay on time, conditions) so the hotel shows an employer reputation
WORKER_RATINGS = {
    "Ram Bahadur Thapa": (5, 4, "Salary comes on the 1st every month."),
    "Sita Kumari Tamang": (4, 4, None),
    "Hari Prasad Adhikari": (4, 3, "Long evening shifts in Dashain season."),
    "Krishna Bahadur Gurung": (5, 4, None),
    "Dil Bahadur Syangtan": (3, 3, "Daily wage sometimes paid a week late."),
    "Tek Bahadur Bohara": (4, 4, None),
}

DISPUTES = [
    # (worker, org, kind, description, status, employer_note, resolution_note)
    (
        "Ram Bahadur Thapa",
        HOTEL,
        "attendance",
        "I was marked absent on a day I worked the morning shift (kitchen inventory).",
        "open",
        None,
        None,
    ),
    (
        "Rajendra Shah",
        BUILDERS,
        "employment_dates",
        "My last working day was 2 days later than recorded; the shuttering job ran over.",
        "employer_responded",
        "Site register shows the last day as recorded; we will recheck with the supervisor.",
        None,
    ),
    (
        "Nabin Karki",
        HOTEL,
        "wage",
        "Overtime for the last week before I left was not included in the final payslip.",
        "resolved",
        "OT of 6 hours confirmed; added to the final settlement.",
        "Employer paid the missing OT in cash; worker confirmed by phone.",
    ),
]


def seed(stdout, rng) -> None:
    from apps.accounts.models import User
    from apps.orgs.models import Organization
    from apps.trust.models import Dispute, ProfileView
    from apps.trust.services import recompute_trust
    from apps.workers.models import Rating, Worker
    from apps.workforce.models import Employment

    orgs = {o.name: o for o in Organization.objects.filter(name__in=[HOTEL, BUILDERS])}
    if not orgs:
        stdout.write("trust demo: demo organizations missing — run seed_demo first.")
        return
    owner = User.objects.filter(phone=OWNER_PHONE).first()
    ops = User.objects.filter(phone=OPS_PHONE).first()
    today = timezone.localdate()
    workers = {w.full_name: w for w in Worker.objects.all()}

    # worker → employer ratings (only after 30 days of work)
    rated = 0
    for name, (a, b, comment) in WORKER_RATINGS.items():
        emp = (
            Employment.objects.filter(worker__full_name=name, organization__in=orgs.values())
            .order_by("start_date")
            .first()
        )
        if emp is None or (today - emp.start_date).days < 30:
            continue
        _, created = Rating.objects.get_or_create(
            employment=emp, rater="worker", defaults={"score_a": a, "score_b": b, "comment": comment}
        )
        rated += int(created)

    # disputes
    raised = 0
    for name, org_name, kind, desc, status, emp_note, res_note in DISPUTES:
        worker, org = workers.get(name), orgs.get(org_name)
        if worker is None or org is None or Dispute.objects.filter(worker=worker, description=desc).exists():
            continue
        emp = Employment.objects.filter(worker=worker, organization=org).order_by("-start_date").first()
        payslip = (
            emp.payslips.order_by("-run__bs_year", "-run__bs_month").first()
            if emp and kind == "wage"
            else None
        )
        now = timezone.now()
        d = Dispute.objects.create(
            worker=worker,
            organization=org,
            employment=emp,
            payslip=payslip,
            attendance_date=today - dt.timedelta(days=6) if kind == "attendance" else None,
            kind=kind,
            description=desc,
            status=status,
            employer_note=emp_note,
            resolution_note=res_note,
            responded_at=now - dt.timedelta(days=2) if emp_note else None,
            resolved_by=ops if status in ("resolved", "rejected") else None,
            resolved_at=now - dt.timedelta(days=1) if status in ("resolved", "rejected") else None,
        )
        Dispute.objects.filter(pk=d.pk).update(raised_at=now - dt.timedelta(days=rng.randint(3, 9)))
        raised += 1

    # profile views (who looked at the worker's full profile)
    logged = 0
    hotel = orgs.get(HOTEL)
    candidates = [w for w in workers.values() if w.applications.filter(job__organization=hotel).exists()]
    for w in candidates[:8]:
        if ProfileView.objects.filter(worker=w).exists():
            continue
        app = w.applications.filter(job__organization=hotel).first()
        rows = [
            ProfileView(
                worker=w, organization=hotel, viewer=owner, context="application", object_id=str(app.id)
            ),
            ProfileView(worker=w, viewer=ops, context="ops", object_id=str(w.id)),
        ]
        for row in rows:
            row.save()
            when = timezone.now() - dt.timedelta(days=rng.randint(1, 14), hours=rng.randint(0, 10))
            ProfileView.objects.filter(pk=row.pk).update(created_at=when)
            logged += 1
    ram = workers.get("Ram Bahadur Thapa")
    if ram and hotel and not ProfileView.objects.filter(worker=ram, context="employment").exists():
        emp = Employment.objects.filter(worker=ram, organization=hotel).first()
        if emp:
            ProfileView.objects.create(
                worker=ram, organization=hotel, viewer=owner, context="employment", object_id=str(emp.id)
            )
            logged += 1

    # reliability score + verification level for everyone
    n = 0
    for w in Worker.objects.all():
        recompute_trust(w)
        n += 1
    stdout.write(
        f"trust demo: {rated} worker→employer ratings, {raised} disputes, {logged} profile views, "
        f"trust computed for {n} workers."
    )
