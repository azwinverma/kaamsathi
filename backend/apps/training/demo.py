"""Demo training providers, courses and enrolments (called by ``seed_demo``; idempotent).

Provider names are illustrative (not real institutions).
"""

from __future__ import annotations

import datetime as dt
from decimal import Decimal

from apps.core.bs import today_ad

PROVIDERS = [
    {
        "name": "Kathmandu Technical Training Centre",
        "name_ne": "काठमाडौं प्राविधिक तालिम केन्द्र",
        "kind": "ctevt_affiliated",
        "ctevt_affiliation_no": "CTEVT/AFF/2071/112",
        "district": "kathmandu",
        "address": "Balaju-16, Kathmandu",
        "phone": "014350112",
        "email": "info@kttc.edu.np",
    },
    {
        "name": "Hetauda Skill Development Institute",
        "name_ne": "हेटौंडा सीप विकास प्रतिष्ठान",
        "kind": "ctevt_affiliated",
        "ctevt_affiliation_no": "CTEVT/AFF/2068/047",
        "district": "makwanpur",
        "address": "Hetauda-4, Makwanpur",
        "phone": "057520447",
        "email": None,
    },
    {
        "name": "Himalayan Culinary & Hospitality Academy",
        "name_ne": "हिमालयन पाककला तथा आतिथ्य एकेडेमी",
        "kind": "private",
        "ctevt_affiliation_no": None,
        "district": "kathmandu",
        "address": "Thamel, Kathmandu-26",
        "phone": "9851023456",
        "email": "admissions@hcha.com.np",
    },
    {
        "name": "Sakshyam Skills Foundation",
        "name_ne": "सक्षम सीप प्रतिष्ठान",
        "kind": "ngo",
        "ctevt_affiliation_no": None,
        "district": "lalitpur",
        "address": "Satdobato, Lalitpur",
        "phone": "015530921",
        "email": "skills@sakshyam.org.np",
    },
]

# (provider idx, trade, title, title_ne, level, days, fee, mode, district, starts_in_days, seats,
#  status, leads_to_nstb, sponsor_note)
COURSES = [
    (
        0,
        "electrician",
        "Building Electrician — Level 1",
        "भवन विद्युत् मिस्त्री — तह १",
        "level1",
        90,
        "18500",
        "classroom",
        "kathmandu",
        12,
        24,
        "open",
        True,
        "Employer sponsorship welcome",
    ),
    (
        0,
        "plumber",
        "Plumber — Level 1",
        "प्लम्बर — तह १",
        "level1",
        60,
        "15000",
        "classroom",
        "kathmandu",
        20,
        20,
        "open",
        True,
        None,
    ),
    (
        1,
        "welder",
        "Arc Welding & Fabrication",
        "आर्क वेल्डिङ तथा फेब्रिकेसन",
        "level1",
        75,
        "16000",
        "classroom",
        "makwanpur",
        8,
        18,
        "open",
        True,
        "50% fee waiver for women trainees",
    ),
    (
        1,
        "mason",
        "Mason Skill Upgrade (NSTB prep)",
        "डकर्मी सीप स्तरोन्नति (NSTB तयारी)",
        "level2",
        30,
        "6000",
        "on_site",
        "makwanpur",
        -40,
        25,
        "completed",
        True,
        None,
    ),
    (
        1,
        "electrician",
        "Electrical Safety Refresher",
        "विद्युत् सुरक्षा पुनर्ताजगी",
        "refresher",
        5,
        "2500",
        "on_site",
        "makwanpur",
        30,
        30,
        "open",
        False,
        "Run on your site for 10+ workers",
    ),
    (
        2,
        "cook",
        "Commercial Cook — Level 1",
        "व्यावसायिक भान्से — तह १",
        "level1",
        90,
        "35000",
        "classroom",
        "kathmandu",
        15,
        16,
        "open",
        True,
        None,
    ),
    (
        2,
        "cook",
        "Nepali & Continental Cuisine — Level 2",
        "नेपाली तथा कन्टिनेन्टल परिकार — तह २",
        "level2",
        45,
        "28000",
        "classroom",
        "kathmandu",
        -10,
        12,
        "open",
        True,
        "Hotel sponsorship available",
    ),
    (
        2,
        "waiter",
        "Food & Beverage Service",
        "खाद्य तथा पेय सेवा",
        "basic",
        30,
        "12000",
        "classroom",
        "kathmandu",
        25,
        20,
        "open",
        False,
        None,
    ),
    (
        3,
        "technician",
        "HVAC Technician — Basic",
        "एचभीएसी प्राविधिक — आधारभूत",
        "basic",
        60,
        "0",
        "classroom",
        "lalitpur",
        18,
        15,
        "open",
        False,
        "Free for workers (donor funded)",
    ),
    (
        3,
        "housekeeping",
        "Professional Housekeeping",
        "व्यावसायिक हाउसकिपिङ",
        "basic",
        21,
        "0",
        "classroom",
        "lalitpur",
        35,
        20,
        "open",
        False,
        "Free for workers (donor funded)",
    ),
]

# (worker phone, course idx, status, sponsor org name | None)
ENROLMENTS = [
    ("9800000010", 6, "enrolled", "Hotel Annapurna View Pvt. Ltd."),
    ("9800000103", 5, "applied", "Hotel Annapurna View Pvt. Ltd."),
    ("9800000110", 5, "applied", None),
    ("9800000101", 9, "enrolled", None),
    ("9800000106", 9, "applied", None),
    ("9800000115", 3, "completed", "Shivam Builders & Construction"),
    ("9800000114", 3, "completed", "Shivam Builders & Construction"),
    ("9800000117", 2, "applied", "Shivam Builders & Construction"),
    ("9800000116", 4, "enrolled", "Shivam Builders & Construction"),
    ("9800000105", 1, "rejected", None),
]


def seed(stdout, rng) -> None:
    from apps.geo.models import District
    from apps.orgs.models import Organization
    from apps.training.models import Course, Enrollment, TrainingProvider
    from apps.training.services import set_enrollment_status
    from apps.workers.models import Trade, Worker

    today = today_ad()
    providers = []
    for data in PROVIDERS:
        data = dict(data)
        district = District.objects.get(code=data.pop("district"))
        provider, _ = TrainingProvider.objects.update_or_create(
            name=data["name"], defaults={**data, "district": district, "is_active": True}
        )
        providers.append(provider)

    courses = []
    for (
        p_idx,
        trade,
        title,
        title_ne,
        level,
        days,
        fee,
        mode,
        district,
        starts_in,
        seats,
        status,
        nstb,
        note,
    ) in COURSES:
        course = Course.objects.filter(provider=providers[p_idx], title=title).first()
        if course is None:
            course = Course.objects.create(
                provider=providers[p_idx],
                trade=Trade.objects.get(code=trade),
                title=title,
                title_ne=title_ne,
                description=_description(title, days, nstb),
                level=level,
                duration_days=days,
                fee=Decimal(fee),
                sponsor_note=note,
                mode=mode,
                district=District.objects.get(code=district),
                starts_on=today + dt.timedelta(days=starts_in),
                seats=seats,
                status=status,
                leads_to_nstb=nstb,
            )
        courses.append(course)

    n = 0
    for phone, c_idx, status, org_name in ENROLMENTS:
        worker = Worker.objects.filter(phone=phone).first()
        if worker is None:
            continue
        org = Organization.objects.filter(name=org_name).first() if org_name else None
        enrollment, created = Enrollment.objects.get_or_create(
            course=courses[c_idx], worker=worker, defaults={"status": "applied", "sponsored_by_org": org}
        )
        n += int(created)
        if enrollment.status == "applied" and status != "applied":
            if status == "completed":
                set_enrollment_status(enrollment, "enrolled")
                set_enrollment_status(
                    enrollment,
                    "completed",
                    completed_on=courses[c_idx].starts_on + dt.timedelta(days=courses[c_idx].duration_days),
                )
            else:
                set_enrollment_status(enrollment, status)
    stdout.write(f"  Training: {len(providers)} providers, {len(courses)} courses, {n} new enrolments")


def _description(title: str, days: int, nstb: bool) -> str:
    text = f"{title}: {days} days of hands-on practical training with a certificate on completion."
    if nstb:
        text += " Prepares you for the NSTB skill test."
    return text
