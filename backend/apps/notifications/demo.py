"""Demo inbox notifications for Ram (worker) and the hotel owner. Idempotent (keyed by kind+title)."""

from __future__ import annotations

OWNER_PHONE = "9800000001"
WORKER_PHONE = "9800000010"

ITEMS = {
    WORKER_PHONE: [
        (
            "payslip_ready",
            "Salary paid",
            "तलब भुक्तानी भयो",
            "Your salary from Hotel Annapurna View is paid. See the payslip in the app.",
            "होटल अन्नपूर्ण भ्यूबाट तपाईंको तलब भुक्तानी भयो। एपमा तलबी पर्चा हेर्नुहोस्।",
            None,
            True,
        ),
    ],
    OWNER_PHONE: [
        (
            "dispute_raised",
            "A worker raised a dispute",
            "कामदारले उजुरी दर्ता गर्नुभयो",
            "A worker raised an attendance dispute. Please respond in Disputes.",
            "एक कामदारले हाजिरीसम्बन्धी उजुरी दर्ता गर्नुभयो। उजुरी पृष्ठमा जवाफ दिनुहोस्।",
            "/app/disputes",
            False,
        ),
        (
            "timesheets_pending",
            "Timesheets ready to approve",
            "स्वीकृतिका लागि टाइमसिट तयार",
            "This week's timesheets are drafted. Review overtime and approve.",
            "यस हप्ताका टाइमसिट तयार छन्। ओभरटाइम हेरेर स्वीकृत गर्नुहोस्।",
            "/app/timesheets",
            False,
        ),
        (
            "shortlist",
            "New candidates shortlisted",
            "नयाँ उम्मेदवार छनोट भए",
            "2 new candidates shortlisted for Cook. Review in Candidates.",
            "कुक पदका लागि २ नयाँ उम्मेदवार छनोट भए। उम्मेदवार पृष्ठमा हेर्नुहोस्।",
            "/app/candidates",
            True,
        ),
    ],
}


def seed(stdout, rng) -> None:
    from django.utils import timezone

    from apps.accounts.models import User

    from .models import Notification

    made = 0
    for phone, items in ITEMS.items():
        user = User.objects.filter(phone=phone).first()
        if user is None:
            continue
        for kind, title, title_ne, body, body_ne, link, read in items:
            if Notification.objects.filter(user=user, kind=kind, title=title, data__demo=True).exists():
                continue
            Notification.objects.create(
                user=user,
                kind=kind,
                title=title,
                title_ne=title_ne,
                body=body,
                body_ne=body_ne,
                link=link,
                data={"demo": True},
                read_at=timezone.now() if read else None,
            )
            created = True
            made += int(created)
    stdout.write(f"  notifications: {made} inbox items added")
