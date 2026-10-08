"""Demo data for worker growth (external work history, interest, shortlist responses). Idempotent.

Called through ``seed_demo``'s ecosystem hook (``apps/<app>/demo.py: seed(stdout, rng)``).
"""

from __future__ import annotations

import datetime as dt

from django.utils import timezone

from apps.core.bs import today_ad

HOTEL = "Hotel Annapurna View Pvt. Ltd."
BUILDERS = "Shivam Builders & Construction"
OPS_PHONE = "9800000003"
RAM_PHONE = "9800000010"

# Off-platform employers by trade category (realistic Nepali businesses).
PAST_EMPLOYERS = {
    "hospitality": [
        ("Hotel Yak & Yeti (outsourced kitchen)", "Kathmandu"),
        ("Pokhara Lakeside Resort", "Kaski"),
        ("Bhojan Griha Restaurant", "Kathmandu"),
        ("Chitwan Jungle Lodge", "Chitwan"),
    ],
    "construction": [
        ("Gorkha Nirman Sewa", "Gorkha"),
        ("Himal Buildcon Pvt. Ltd.", "Lalitpur"),
        ("Bagmati Road Project (contractor)", "Makwanpur"),
    ],
    "security": [("Nepal Guard Services", "Kathmandu"), ("Everest Security Pvt. Ltd.", "Lalitpur")],
    "other": [("Bhatbhateni Supermarket (store)", "Kathmandu"), ("Sajha Yatayat", "Lalitpur")],
}
REFERENCES = [
    ("Shyam Prasad Koirala (head chef)", "9851023456"),
    ("Mohan Gurung (site supervisor)", "9841122334"),
    ("Sunita Shrestha (HR)", "9803344556"),
    ("Bikash Thapa (manager)", "9818899001"),
    ("Kumar Rai (owner)", "9862233445"),
]
# status cycle over the ~15 workers → mixed states, several waiting in the ops queue
STATUSES = [
    "reference_pending",
    "verified",
    "reference_pending",
    "self_reported",
    "verified",
    "reference_pending",
    "unverifiable",
    "verified",
    "reference_pending",
    "rejected",
    "verified",
    "self_reported",
    "reference_pending",
    "verified",
    "reference_pending",
]


def _category(worker) -> str:
    skill = next(iter(worker.skills.all()), None)
    cat = skill.trade.category if skill else "other"
    return cat if cat in PAST_EMPLOYERS else "other"


def seed(stdout, rng) -> None:
    from apps.accounts.models import User
    from apps.experience.models import WorkHistoryEntry
    from apps.geo.models import District
    from apps.hiring.models import Application, JobOpening, StageEvent
    from apps.orgs.models import Organization
    from apps.workers.models import Worker

    ops = User.objects.filter(phone=OPS_PHONE).first()
    today = today_ad()
    now = timezone.now()
    workers = list(
        Worker.objects.filter(phone__startswith="98000001")
        .prefetch_related("skills__trade")
        .order_by("phone")[:15]
    )
    ram = Worker.objects.filter(phone=RAM_PHONE).first()
    if ram is not None:
        workers = [ram, *workers[:14]]
    districts = {d.name_en: d for d in District.objects.all()}
    hotel = Organization.objects.filter(name=HOTEL).first()

    created = 0
    for i, w in enumerate(workers):
        if WorkHistoryEntry.objects.filter(worker=w).exists():
            continue
        skill = next(iter(w.skills.all()), None)
        employer, district_name = rng.choice(PAST_EMPLOYERS[_category(w)])
        years_back = rng.randint(2, 6)
        start = today - dt.timedelta(days=365 * years_back + rng.randint(0, 200))
        end = start + dt.timedelta(days=rng.randint(9, 30) * 30)
        end = min(end, today - dt.timedelta(days=60))
        status = STATUSES[i % len(STATUSES)]
        ref_name, ref_phone = REFERENCES[i % len(REFERENCES)]
        with_ref = status != "self_reported"
        method = None
        if status == "verified":
            method = rng.choice(["reference_call", "reference_call", "document"])
        decided = status in ("verified", "unverifiable", "rejected")
        WorkHistoryEntry.objects.create(
            worker=w,
            employer_name=employer,
            trade=skill.trade if skill else None,
            role_title=(skill.trade.name_en if skill else "Helper"),
            district=districts.get(district_name),
            start_date=start,
            end_date=end,
            description="Worked full time; left to move closer to family.",
            reference_name=ref_name if with_ref else None,
            reference_phone=ref_phone if with_ref else None,
            status=status,
            verification_method=method,
            verified_by=ops if decided else None,
            verified_at=now - dt.timedelta(days=rng.randint(3, 40)) if decided else None,
            note={
                "verified": "Reference confirmed role and dates by phone.",
                "unverifiable": "Reference number switched off on three attempts.",
                "rejected": "Reference says the worker was never employed there.",
            }.get(status),
        )
        created += 1

    # One worker names the hotel as a past employer → shows in the hotel's confirmations tab.
    if hotel is not None and len(workers) > 5:
        w = workers[5]
        if not WorkHistoryEntry.objects.filter(worker=w, employer_org=hotel).exists():
            WorkHistoryEntry.objects.create(
                worker=w,
                employer_name=hotel.name,
                employer_org=hotel,
                trade=next(iter(w.skills.all()), None).trade if w.skills.exists() else None,
                role_title="Seasonal helper (Dashain–Tihar)",
                district=hotel.district,
                start_date=today - dt.timedelta(days=760),
                end_date=today - dt.timedelta(days=640),
                status="reference_pending",
            )
            created += 1

    # Worker interest + pending shortlist responses on open jobs.
    interest = responses = 0
    for job in JobOpening.objects.filter(status="open", organization__name__in=[HOTEL, BUILDERS]):
        in_pipeline = set(job.applications.values_list("worker_id", flat=True))
        free = (
            Worker.objects.exclude(pk__in=in_pipeline)
            .exclude(employments__organization=job.organization, employments__status="active")
            .exclude(employments__status="active")
        )
        same_trade = list(free.filter(skills__trade=job.trade).distinct().order_by("phone")[:2])
        same_category = list(
            free.filter(skills__trade__category=job.trade.category).distinct().order_by("phone")[:2]
        )
        pool = (same_trade + [w for w in same_category if w not in same_trade])[:2]
        if job.applications.filter(source="worker_interest").exists():
            pool = []
        for w in pool[:2]:
            app, made = Application.objects.get_or_create(
                job=job,
                worker=w,
                defaults={
                    "stage": "sourced",
                    "source": "worker_interest",
                    "worker_response": "interested",
                    "responded_at": now - dt.timedelta(hours=rng.randint(2, 48)),
                },
            )
            if made:
                StageEvent.objects.create(
                    application=app,
                    from_stage=None,
                    to_stage="sourced",
                    by=w.user,
                    note="Worker expressed interest",
                )
                interest += 1
        # existing ops shortlists without an answer yet → waiting on the worker
        responses += Application.objects.filter(
            job=job, stage="shortlisted", source="ops", worker_response__isnull=True
        ).update(worker_response="pending")
        # candidates who moved on past the shortlist evidently said yes
        Application.objects.filter(
            job=job, stage__in=["interview", "selected", "joined"], worker_response="pending"
        ).update(worker_response="interested", responded_at=now - dt.timedelta(days=2))
        # one confirmed
        first = (
            Application.objects.filter(
                job=job, stage__in=["interview", "selected"], worker_response__isnull=True
            )
            .order_by("created_at")
            .first()
        )
        if first is not None:
            first.worker_response = "interested"
            first.responded_at = now - dt.timedelta(days=1)
            first.save(update_fields=["worker_response", "responded_at"])

    stdout.write(
        f"  experience: {created} work-history entries, {interest} worker-interest applications, "
        f"{responses} shortlists awaiting the worker."
    )
