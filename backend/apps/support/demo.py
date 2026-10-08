"""Demo support cases in every status, with staff replies and internal notes. Idempotent."""

from __future__ import annotations

import datetime as dt

from django.utils import timezone

HOTEL = "Hotel Annapurna View Pvt. Ltd."
BUILDERS = "Shivam Builders & Construction"
OWNER_PHONE = "9800000001"
OPS_PHONE = "9800000003"
WORKER_PHONE = "9800000010"

# (requester phone, org name | None, subject, description, category, priority, channel, status,
#  hours ago, assign to ops?, escalated?, [(from_staff, internal, body, minutes after creation)])
CASES = [
    (
        WORKER_PHONE,
        None,
        "Overtime missing on my Bhadra payslip",
        "I worked 6 hours overtime in the last week of Bhadra but the payslip shows 0 overtime hours.",
        "payment",
        "normal",
        "app",
        "open",
        5,
        False,
        False,
        [],
    ),
    (
        WORKER_PHONE,
        None,
        "QR check-in says I am outside the site",
        "Since yesterday the app says 'outside the work site area' when I scan the kitchen QR.",
        "technical",
        "high",
        "app",
        "pending_user",
        30,
        True,
        False,
        [
            (
                True,
                True,
                "Site geofence is 200 m; worker phone GPS may be off indoors. Ask for a screenshot.",
                40,
            ),
            (
                True,
                False,
                "Namaste Ram ji. Please turn on location (GPS) and send us a screenshot of the error.",
                45,
            ),
        ],
    ),
    (
        WORKER_PHONE,
        None,
        "My employer has not paid wages for two months",
        "I worked at a construction site in Hetauda for Shrawan and Bhadra and was not paid.",
        "payment",
        "urgent",
        "phone",
        "open",
        6,
        True,
        True,
        [
            (
                True,
                True,
                "Not a KaamSathi employer. Refer to Labour Office Hetauda; call back with the number.",
                30,
            )
        ],
    ),
    (
        OWNER_PHONE,
        HOTEL,
        "How do I add a second site?",
        "We are opening a branch in Lalitpur and want separate hajiri for it.",
        "account",
        "low",
        "web",
        "resolved",
        96,
        True,
        False,
        [
            (
                True,
                False,
                "Go to Settings → Sites → Add site. Each site gets its own QR code for check-in.",
                120,
            ),
            (False, False, "Done, thank you!", 300),
        ],
    ),
    (
        OWNER_PHONE,
        BUILDERS,
        "SSF portal rejected our contribution file",
        "The SSF portal says 'invalid SSF ID' for two workers in the Bhadra file.",
        "payment",
        "high",
        "web",
        "open",
        30,
        False,
        True,
        [],
    ),
    (
        OWNER_PHONE,
        HOTEL,
        "Remove an old test job",
        "We created a test job 'Test cook' by mistake. Please remove it.",
        "job",
        "normal",
        "web",
        "closed",
        24 * 20,
        True,
        False,
        [(True, False, "Closed the job for you. Draft jobs can also be deleted from the job page.", 60)],
    ),
]


def seed(stdout, rng) -> None:
    from apps.accounts.models import User
    from apps.orgs.models import Organization

    from .models import CaseMessage, SupportCase
    from .services import create_case

    ops = User.objects.filter(phone=OPS_PHONE).first()
    users = {u.phone: u for u in User.objects.filter(phone__in=[OWNER_PHONE, WORKER_PHONE])}
    orgs = {o.name: o for o in Organization.objects.filter(name__in=[HOTEL, BUILDERS])}
    if not users or not orgs:
        stdout.write("  support: demo users missing — run seed_demo first.")
        return
    now = timezone.now()
    made = 0
    for (
        phone,
        org_name,
        subject,
        description,
        category,
        priority,
        channel,
        status,
        hours,
        assign,
        escalated,
        messages,
    ) in CASES:
        requester = users.get(phone)
        if requester is None or SupportCase.objects.filter(requester=requester, subject=subject).exists():
            continue
        created_at = now - dt.timedelta(hours=hours)
        case = create_case(
            requester=requester,
            subject=subject,
            description=description,
            category=category,
            priority=priority,
            channel=channel,
            worker=getattr(requester, "worker", None) if org_name is None else None,
            organization=orgs.get(org_name) if org_name else None,
            created_at=created_at,
        )
        first_response = None
        for from_staff, internal, body, minutes in messages:
            at = created_at + dt.timedelta(minutes=minutes)
            CaseMessage.objects.create(
                case=case,
                author=ops if from_staff else requester,
                body=body,
                internal=internal,
                from_staff=from_staff,
                created_at=at,
            )
            if from_staff and not internal and first_response is None:
                first_response = at
        SupportCase.objects.filter(pk=case.pk).update(
            status=status,
            assignee=ops if assign else None,
            first_response_at=first_response,
            resolved_at=created_at + dt.timedelta(hours=6) if status in ("resolved", "closed") else None,
            escalated=escalated,
        )
        made += 1
    # a confidential safety report about the construction site (never shown to the employer)
    worker_user = users.get(WORKER_PHONE)
    subject = "Scaffolding without guard rails at the Hetauda site"
    if worker_user and not SupportCase.objects.filter(requester=worker_user, subject=subject).exists():
        safety = create_case(
            requester=worker_user,
            subject=subject,
            description="No harness on the 4th floor slab; scaffolding has no guard rails.",
            category="safety",
            safety_kind="unsafe_workplace",
            anonymous=True,
            worker=getattr(worker_user, "worker", None),
            organization=orgs.get(BUILDERS),
            created_at=now - dt.timedelta(hours=3),
        )
        CaseMessage.objects.create(
            case=safety,
            author=ops,
            body="Called reporter back; photos received. Site visit before sharing with employer.",
            internal=True,
            from_staff=True,
            channel="phone",
            created_at=now - dt.timedelta(hours=2),
        )
        SupportCase.objects.filter(pk=safety.pk).update(assignee=ops)
        made += 1
    from .help_content import install
    from .models import HelpArticle

    install(HelpArticle)
    stdout.write(f"  support: {made} demo cases added ({SupportCase.objects.count()} total)")
