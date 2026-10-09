# ruff: noqa: E501 — demo data tables
"""Bolau demo data (``seed(stdout, rng)``; idempotent) — docs/CONTRACT-BOLAU.md.

* Turns the ``bolau`` flag ON through a FeatureFlag row (the code default stays off).
* 12 verified Sipalu in the Kathmandu Valley (electrician, plumber, HVAC, cook, cleaner, solar) with
  handles, services at realistic prices (hourly ≥ the Rs 107 minimum), availability and service areas;
  Ram Bahadur Thapa (9800000010, the demo worker) is also a Sipalu (``ram-bhanse``).
* Ghardhani 9800000020 (Sita Sharma, Baneshwor + office in Lalitpur) and 9800000021 (Prakash Joshi,
  Bhaktapur) — OTP 123456 in dev.
* Bookings in every status, historical confirmed bookings with two-way ratings, two Kaam requests
  with offers.
"""

from __future__ import annotations

import datetime as dt
from decimal import Decimal

from django.utils import timezone

GHARDHANI = [
    ("9800000020", "Sita Sharma", "सीता शर्मा"),
    ("9800000021", "Prakash Joshi", "प्रकाश जोशी"),
]
# (phone, handle, name, name_ne, gender, trade, years, nstb, district, municipality, headline, headline_ne,
#  instant, [(title, title_ne, price_type, price, visit_fee, minutes)], [(weekday, start, end)])
WEEKDAYS = [0, 1, 2, 3, 4, 5]
EVERY_DAY = [0, 1, 2, 3, 4, 5, 6]
SIPALU = [
    ("9800000301", "suman-electric", "Suman Maharjan", "सुमन महर्जन", "male", "electrician", 9, "level2",
     "lalitpur", "Lalitpur Metropolitan City", "Licensed electrician — wiring, fans, MCB", "दर्ता भएको इलेक्ट्रिसियन — वायरिङ, पंखा, MCB",
     True, [("Ceiling fan installation", "सिलिङ पंखा जडान", "fixed", 600, None, 60),
            ("Wiring repair", "वायरिङ मर्मत", "hourly", 450, None, 120),
            ("Inverter / MCB check", "इन्भर्टर / MCB जाँच", "visit_then_quote", 0, 300, 60)], (EVERY_DAY, 8, 19)),
    ("9800000302", "rajesh-bijuli", "Rajesh Shrestha", "राजेश श्रेष्ठ", "male", "electrician", 5, "level1",
     "kathmandu", "Kathmandu Metropolitan City", "House wiring and lights, same-day visits", "घरको वायरिङ र बत्ती, सोही दिन",
     False, [("Light fitting", "बत्ती जडान", "fixed", 400, None, 45),
            ("Electrical work per hour", "बिजुली काम प्रति घण्टा", "hourly", 400, None, 60)], (WEEKDAYS, 9, 18)),
    ("9800000303", "dipak-plumber", "Dipak Tamang", "दिपक तामाङ", "male", "plumber", 11, "level2",
     "kathmandu", "Kathmandu Metropolitan City", "Taps, tanks and bathroom fittings", "धारा, ट्याङ्की र बाथरुम फिटिङ",
     True, [("Tap repair or replacement", "धारा मर्मत वा फेर्ने", "fixed", 500, None, 45),
            ("Water tank cleaning", "पानी ट्याङ्की सफाइ", "fixed", 1800, None, 180),
            ("Leak inspection", "चुहावट जाँच", "visit_then_quote", 0, 350, 60)], (EVERY_DAY, 7, 18)),
    ("9800000304", "bishnu-dhara", "Bishnu Karki", "विष्णु कार्की", "male", "plumber", 4, "none",
     "bhaktapur", "Bhaktapur Municipality", "Plumbing in Bhaktapur and Thimi", "भक्तपुर र ठिमीमा प्लम्बिङ",
     False, [("Pipe fitting per hour", "पाइप फिटिङ प्रति घण्टा", "hourly", 350, None, 60),
            ("Toilet flush repair", "ट्वाइलेट फ्लस मर्मत", "fixed", 700, None, 60)], (WEEKDAYS, 8, 17)),
    ("9800000305", "anil-cooling", "Anil Shakya", "अनिल शाक्य", "male", "hvac_technician", 8, "level2",
     "lalitpur", "Lalitpur Metropolitan City", "AC and fridge service", "एसी र फ्रिज सर्भिस",
     False, [("AC servicing (split unit)", "एसी सर्भिसिङ (स्प्लिट)", "fixed", 1500, None, 90),
            ("Fridge gas refill", "फ्रिज ग्यास भर्ने", "visit_then_quote", 0, 500, 60)], (WEEKDAYS, 10, 18)),
    ("9800000306", "kiran-hvac", "Kiran Bajracharya", "किरण बज्राचार्य", "male", "hvac_technician", 6, "level1",
     "kathmandu", "Kathmandu Metropolitan City", "Cooling and heating repairs", "चिसो र तातो मेसिन मर्मत",
     False, [("AC gas top-up", "एसी ग्यास टप-अप", "fixed", 2500, None, 90),
            ("Repair visit per hour", "मर्मत प्रति घण्टा", "hourly", 600, None, 60)], (EVERY_DAY, 9, 19)),
    ("9800000307", "laxmi-bhanse", "Laxmi Gurung", "लक्ष्मी गुरुङ", "female", "cook", 12, "level2",
     "kathmandu", "Kathmandu Metropolitan City", "Home cook — dal bhat, parties, festivals", "घरको भान्से — दाल भात, भोज, चाडपर्व",
     False, [("Daily cooking (2 meals)", "दैनिक खाना (दुई छाक)", "hourly", 250, None, 180),
            ("Party cooking up to 20 guests", "२० जनासम्मको भोज", "fixed", 4500, None, 360)], (EVERY_DAY, 6, 20)),
    ("9800000308", "sarita-cook", "Sarita Rai", "सरिता राई", "female", "cook", 7, "none",
     "lalitpur", "Godawari Municipality", "Newari and Nepali dishes at home", "घरमै नेवारी र नेपाली परिकार",
     True, [("Cooking per hour", "खाना पकाउने प्रति घण्टा", "hourly", 220, None, 120)], (WEEKDAYS, 7, 14)),
    ("9800000309", "sunita-safai", "Sunita Lama", "सुनिता लामा", "female", "cleaner", 5, "none",
     "kathmandu", "Budhanilkantha Municipality", "Deep cleaning for flats and houses", "फ्ल्याट र घरको गहिरो सफाइ",
     True, [("2BHK deep cleaning", "२ कोठा गहिरो सफाइ", "fixed", 3500, None, 300),
            ("Cleaning per hour", "सफाइ प्रति घण्टा", "hourly", 200, None, 120)], (EVERY_DAY, 8, 18)),
    ("9800000310", "maya-clean", "Maya Thapa Magar", "माया थापा मगर", "female", "cleaner", 3, "none",
     "bhaktapur", "Madhyapur Thimi Municipality", "Kitchen and bathroom cleaning", "भान्सा र बाथरुम सफाइ",
     False, [("Kitchen deep clean", "भान्सा गहिरो सफाइ", "fixed", 1500, None, 180),
            ("Cleaning per hour", "सफाइ प्रति घण्टा", "hourly", 180, None, 120)], (WEEKDAYS, 9, 17)),
    ("9800000311", "ramesh-solar", "Ramesh Adhikari", "रमेश अधिकारी", "male", "solar_technician", 10, "level2",
     "kathmandu", "Tokha Municipality", "Solar water heaters and panels", "सोलार वाटर हिटर र प्यानल",
     False, [("Solar water heater service", "सोलार वाटर हिटर सर्भिस", "fixed", 1200, None, 90),
            ("Solar panel inspection", "सोलार प्यानल जाँच", "visit_then_quote", 0, 400, 60)], (WEEKDAYS, 9, 17)),
    ("9800000312", "nabin-solar", "Nabin K.C.", "नबिन के.सी.", "male", "solar_technician", 4, "level1",
     "lalitpur", "Mahalaxmi Municipality", "Solar and inverter installs", "सोलार र इन्भर्टर जडान",
     False, [("Inverter installation", "इन्भर्टर जडान", "fixed", 2000, None, 120)], (EVERY_DAY, 8, 18)),
]  # fmt: skip
VALLEY = ["kathmandu", "lalitpur", "bhaktapur"]


def _user(phone, full_name, lang="ne"):
    from apps.accounts.models import User

    user, created = User.objects.get_or_create(
        phone=phone, defaults={"full_name": full_name, "preferred_language": lang}
    )
    if created:
        user.set_unusable_password()
        user.save(update_fields=["password"])
    return user


def _flag():
    from apps.core import flags
    from apps.core.models import FeatureFlag

    FeatureFlag.objects.update_or_create(
        key="bolau",
        defaults={
            "enabled": True,
            "rollout": "all",
            "client_visible": True,
            "description": "Bolau — Sipalu self-profiles and Ghardhani bookings (demo: on).",
        },
    )
    FeatureFlag.objects.get_or_create(
        key="bolau_fee",
        defaults={
            "enabled": False,
            "client_visible": True,
            "description": "Collect the Ghardhani booking fee (off → waived until a gateway merchant agreement exists).",
        },
    )
    flags.invalidate()


def _sipalu(row, rng):
    from apps.geo.models import District
    from apps.workers.models import Consent, Trade, Worker, WorkerLanguage, WorkerSkill

    from .models import AvailabilityRule, SipaluProfile, SipaluService

    (phone, handle, name, name_ne, gender, trade, years, nstb, district, municipality, headline, headline_ne,
     instant, services, (days, start_h, end_h)) = row  # fmt: skip
    user = _user(phone, name)
    d = District.objects.get(code=district)
    worker, _ = Worker.objects.get_or_create(
        phone=phone,
        defaults={
            "full_name": name,
            "full_name_ne": name_ne,
            "gender": gender,
            "current_district": d,
            "user": user,
        },
    )
    changed = False
    if worker.user_id is None:
        worker.user, changed = user, True
    if worker.verification_status != "verified":
        worker.verification_status, worker.verified_at, changed = "verified", timezone.now(), True
    if not worker.wallet_id:
        worker.payment_method, worker.wallet_id, changed = "esewa", phone, True
    if changed:
        worker.save()
    WorkerSkill.objects.get_or_create(
        worker=worker,
        trade=Trade.objects.get(code=trade),
        defaults={"years_experience": years, "nstb_level": nstb},
    )
    WorkerLanguage.objects.get_or_create(worker=worker, language="ne", defaults={"proficiency": "native"})
    if rng.random() < 0.5:
        WorkerLanguage.objects.get_or_create(worker=worker, language="en", defaults={"proficiency": "basic"})
    if not Consent.objects.filter(worker=worker, scope="data_processing").exists():
        Consent.objects.create(worker=worker, scope="data_processing", granted=True, channel="app")
        Consent.objects.create(worker=worker, scope="profile_share", granted=True, channel="app")
    profile, created = SipaluProfile.objects.get_or_create(
        worker=worker,
        defaults={
            "handle": handle,
            "headline": headline,
            "headline_ne": headline_ne,
            "bio": f"{years} years as a {Trade.objects.get(code=trade).name_en.lower()} in the Kathmandu Valley. "
            "I bring my own tools and explain the price before I start.",
            "bio_ne": f"काठमाडौं उपत्यकामा {years} वर्षको अनुभव। आफ्नै औजार ल्याउँछु र काम सुरु गर्नुअघि मूल्य बताउँछु।",
            "bolau_enabled": True,
            "instant_booking": instant,
            "service_municipality": municipality,
            "service_radius_km": 8,
            "base_lat": Decimal({"kathmandu": "27.71", "lalitpur": "27.67", "bhaktapur": "27.67"}[district]),
            "base_lng": Decimal({"kathmandu": "85.32", "lalitpur": "85.32", "bhaktapur": "85.43"}[district]),
            "gender_visible": gender == "female",
            "public_consent_at": timezone.now(),
            "years_total": years,
        },
    )
    if created:
        others = [c for c in VALLEY if c != district]
        profile.service_districts.set(District.objects.filter(code__in=[district, rng.choice(others)]))
        for i, (title, title_ne, ptype, price, visit_fee, minutes) in enumerate(services):
            SipaluService.objects.create(
                profile=profile,
                trade_id=trade,
                title=title,
                title_ne=title_ne,
                price_type=ptype,
                price=Decimal(price),
                visit_fee=Decimal(visit_fee) if visit_fee else None,
                estimated_minutes=minutes,
                order=i,
            )
        for wd in days:
            AvailabilityRule.objects.create(
                profile=profile, weekday=wd, start_time=dt.time(start_h, 0), end_time=dt.time(end_h, 0)
            )
    return profile


def _ram_sipalu():
    """The demo worker (9800000010) also takes home-cooking bookings on his days off."""
    from apps.workers.models import Worker

    from .models import AvailabilityRule, SipaluProfile, SipaluService

    worker = Worker.objects.filter(phone="9800000010").first()
    if worker is None or SipaluProfile.objects.filter(worker=worker).exists():
        return
    profile = SipaluProfile.objects.create(
        worker=worker,
        handle="ram-bhanse",
        headline="Hotel cook — home cooking on Saturdays",
        headline_ne="होटलका भान्से — शनिबार घरमा खाना पकाउने",
        bolau_enabled=worker.verification_status == "verified",
        public_consent_at=timezone.now(),
        years_total=8,
    )
    profile.service_districts.add("kathmandu")
    SipaluService.objects.create(
        profile=profile, trade_id="cook", title="Home cooking per hour", title_ne="घरमा खाना प्रति घण्टा",
        price_type="hourly", price=Decimal("250"), estimated_minutes=180,
    )  # fmt: skip
    AvailabilityRule.objects.create(
        profile=profile, weekday=6, start_time=dt.time(8, 0), end_time=dt.time(18, 0)
    )


def _ghardhani():
    from apps.geo.models import District

    from .models import Address, GhardhaniProfile

    out = []
    for i, (phone, name, _ne) in enumerate(GHARDHANI):
        user = _user(phone, name)
        GhardhaniProfile.objects.get_or_create(
            user=user, defaults={"display_name": name, "preferred_language": "ne"}
        )
        if not Address.objects.filter(ghardhani=user).exists():
            if i == 0:
                Address.objects.create(
                    ghardhani=user, label="home", line="House 21, Shantinagar Marg, New Baneshwor", ward=10,
                    municipality="Kathmandu Metropolitan City", district=District.objects.get(code="kathmandu"),
                    landmark="Opposite the Shantinagar gate", lat=Decimal("27.688500"), lng=Decimal("85.339200"),
                    is_default=True,
                )  # fmt: skip
                Address.objects.create(
                    ghardhani=user, label="office", line="3rd floor, Jhamsikhel Road", ward=3,
                    municipality="Lalitpur Metropolitan City", district=District.objects.get(code="lalitpur"),
                    lat=Decimal("27.678000"), lng=Decimal("85.307500"),
                )  # fmt: skip
            else:
                Address.objects.create(
                    ghardhani=user, label="home", line="Tole 4, Suryabinayak", ward=7,
                    municipality="Suryabinayak Municipality", district=District.objects.get(code="bhaktapur"),
                    landmark="Behind the temple", lat=Decimal("27.661000"), lng=Decimal("85.437000"), is_default=True,
                )  # fmt: skip
        out.append(user)
    return out


def _booking(gh, profile, *, status, start, rng, service_idx=0, address=None, **extra):
    from . import bookings as svc
    from . import payments
    from .common import new_code, quoted_price
    from .models import Address, Booking, BookingEvent

    service = list(profile.services.filter(is_active=True).order_by("order"))[
        service_idx % profile.services.count()
    ]
    minutes = service.estimated_minutes or 60
    addr = address or Address.objects.filter(ghardhani=gh, is_default=True).first()
    now = timezone.now()
    b = Booking(
        code=new_code("BK", Booking),
        ghardhani=gh,
        sipalu=profile.worker,
        service=service,
        trade_id=service.trade_id,
        description=extra.pop("description", service.title),
        address=addr,
        scheduled_start=start,
        scheduled_end=start + dt.timedelta(minutes=minutes),
        estimated_minutes=minutes,
        price_type=service.price_type,
        quoted_price=quoted_price(service.price_type, service.price, service.visit_fee, minutes),
        visit_fee=service.visit_fee if service.price_type == "visit_then_quote" else None,
        status="requested",
        expires_at=min(now + dt.timedelta(minutes=30), start - dt.timedelta(minutes=15)),
    )
    b.save()
    b.created_at = start - dt.timedelta(days=1)  # auto_now_add → fix after insert
    Booking.objects.filter(pk=b.pk).update(created_at=b.created_at)
    path = {
        "requested": [],
        "declined": ["declined"],
        "expired": ["expired"],
        "accepted": ["accepted"],
        "on_the_way": ["accepted", "on_the_way"],
        "arrived": ["accepted", "on_the_way", "arrived"],
        "in_progress": ["accepted", "on_the_way", "arrived", "in_progress"],
        "completed": ["accepted", "on_the_way", "arrived", "in_progress", "completed"],
        "confirmed": ["accepted", "on_the_way", "arrived", "in_progress", "completed", "confirmed"],
        "cancelled": ["accepted", "cancelled"],
        "no_show": ["accepted", "no_show"],
        "disputed": ["accepted", "on_the_way", "arrived", "in_progress", "completed", "disputed"],
    }[status]
    BookingEvent.objects.create(booking=b, to_status="requested", by=gh, by_party="ghardhani")
    prev = "requested"
    for step in path:
        if step == "accepted":
            b.accepted_at = b.created_at + dt.timedelta(minutes=rng.randint(4, 25))
            b.responded_at = b.accepted_at
            b.address_snapshot = svc.address_snapshot(addr)
            svc._issue_arrival_code(b)
            payments.open_fee(b)
        elif step == "declined":
            b.responded_at = b.created_at + dt.timedelta(minutes=rng.randint(3, 20))
            b.decline_reason = "Already booked that day"
        elif step == "arrived":
            b.arrival_verified_at = start
        elif step == "in_progress":
            b.started_at = start + dt.timedelta(minutes=5)
        elif step == "completed":
            b.completed_at = b.scheduled_end
            b.final_price = b.quoted_price if b.price_type != "visit_then_quote" else Decimal("1200")
            if b.price_type == "visit_then_quote":
                b.quote_amount, b.quote_status = Decimal("1200"), "approved"
        elif step == "confirmed":
            b.confirmed_at = b.scheduled_end + dt.timedelta(hours=3)
            b.payment_method_to_sipalu = rng.choice(["cash", "esewa", "khalti"])
            b.paid_marked_by_ghardhani_at = b.paid_to_sipalu_at = b.confirmed_at
            b.paid_method_ghardhani = b.payment_method_to_sipalu
            b.paid_to_sipalu_marked_by = gh
        elif step == "cancelled":
            b.cancelled_by, b.cancel_reason, b.cancelled_at = "ghardhani", "Family function that day", now
            payments.settle_fee(b, refundable=True)
        elif step == "no_show":
            payments.settle_fee(b, refundable=True)
        elif step == "disputed":
            from apps.trust.models import Dispute

            b.status_before_dispute = "completed"
            Dispute.objects.create(
                worker=b.sipalu, booking=b, kind="booking",
                description=f"[{b.code} · raised by ghardhani] Asked for Rs 500 more than the quoted price after the job.",
            )  # fmt: skip
        b.status = step
        b.save()
        party = "ghardhani" if step in ("confirmed", "cancelled", "no_show", "disputed") else "sipalu"
        BookingEvent.objects.create(booking=b, from_status=prev, to_status=step, by_party=party)
        prev = step
    return b


def _rate(b, rng):
    from .models import BookingRating

    comments = [
        ("Came on time and fixed it quickly.", ["on_time", "skilled"]),
        ("Very polite, cleaned up after the work.", ["polite", "clean_work"]),
        ("Fair price, explained everything.", ["fair_price", "explained_work"]),
        ("Good work.", ["skilled"]),
    ]
    text, tags = rng.choice(comments)
    BookingRating.objects.get_or_create(
        booking=b, side="ghardhani",
        defaults={"rater": b.ghardhani, "score": rng.choice([4, 5, 5, 5]), "comment": text, "tags": tags},
    )  # fmt: skip
    BookingRating.objects.get_or_create(
        booking=b, side="sipalu",
        defaults={"rater": b.sipalu.user, "score": 5, "comment": "", "tags": ["respectful", "paid_as_agreed"]},
    )  # fmt: skip


def _requests(ghardhani, profiles_by_handle, rng):
    from .common import new_code
    from .models import Address, KaamRequest, Offer

    now = timezone.now()
    tz = timezone.get_current_timezone()
    day = timezone.localtime(now).date() + dt.timedelta(days=2)

    def at(h):
        return timezone.make_aware(dt.datetime.combine(day, dt.time(h, 0)), tz)

    specs = [
        (ghardhani[0], "plumber", "Bathroom tap leaking and low water pressure", "बाथरुमको धारा चुहिन्छ, पानीको प्रेसर कम",
         Decimal("2000"), [("dipak-plumber", 1200, 10), ("bishnu-dhara", 1000, 13)]),
        (ghardhani[1], "cleaner", "Deep cleaning before Tihar (3 rooms + kitchen)", "तिहारअघि गहिरो सफाइ (३ कोठा + भान्सा)",
         Decimal("5000"), [("maya-clean", 4200, 9)]),
    ]  # fmt: skip
    for gh, trade, title, desc, budget, offers in specs:
        if KaamRequest.objects.filter(ghardhani=gh, title=title).exists():
            continue
        req = KaamRequest.objects.create(
            code=new_code("KR", KaamRequest),
            ghardhani=gh,
            trade_id=trade,
            title=title,
            description=desc,
            address=Address.objects.filter(ghardhani=gh, is_default=True).first(),
            preferred_window_start=at(8),
            preferred_window_end=at(18),
            budget_max=budget,
            status="offers_received",
            expires_at=now + dt.timedelta(hours=20),
            notified_count=len(offers) + 2,
        )
        for slot, (handle, price, hour) in enumerate(offers, start=1):
            Offer.objects.create(
                request=req,
                sipalu=profiles_by_handle[handle].worker,
                slot=slot,
                price_type="fixed",
                price=Decimal(price),
                estimated_minutes=120,
                message="I can come with all tools. Price includes small parts.",
                proposed_start=at(hour),
            )


def seed(stdout, rng):
    from . import profiles as profile_svc
    from .models import Booking

    _flag()
    sipalu = [_sipalu(row, rng) for row in SIPALU]
    _ram_sipalu()
    by_handle = {p.handle: p for p in sipalu}
    ghardhani = _ghardhani()
    if Booking.objects.filter(ghardhani__in=ghardhani).exists():
        stdout.write("  bolau: demo bookings already present (flag on, profiles refreshed)")
        return
    now = timezone.now()
    tz = timezone.get_current_timezone()
    today = timezone.localtime(now).date()

    def at(days, hour, minute=0):
        return timezone.make_aware(
            dt.datetime.combine(today + dt.timedelta(days=days), dt.time(hour, minute)), tz
        )

    sita, prakash = ghardhani
    plan = [
        # (ghardhani, handle, status, start, service_idx)
        (sita, "suman-electric", "requested", at(1, 10), 0),
        (sita, "dipak-plumber", "accepted", at(1, 14), 0),
        (prakash, "bishnu-dhara", "accepted", at(2, 9), 1),
        (sita, "laxmi-bhanse", "on_the_way", now + dt.timedelta(minutes=20), 0),
        (prakash, "sunita-safai", "arrived", now - dt.timedelta(minutes=10), 1),
        (sita, "anil-cooling", "in_progress", now - dt.timedelta(minutes=40), 0),
        (prakash, "maya-clean", "completed", now - dt.timedelta(hours=5), 0),
        (sita, "kiran-hvac", "confirmed", at(-3, 11), 0),
        (sita, "rajesh-bijuli", "declined", at(1, 16), 0),
        (prakash, "ramesh-solar", "expired", at(-1, 10), 0),
        (sita, "nabin-solar", "cancelled", at(3, 12), 0),
        (prakash, "sarita-cook", "no_show", at(-2, 9), 0),
        (sita, "ramesh-solar", "disputed", at(-4, 13), 0),
    ]
    made = []
    for gh, handle, status, start, idx in plan:
        made.append(_booking(gh, by_handle[handle], status=status, start=start, rng=rng, service_idx=idx))
    # History: confirmed + rated bookings so Sipalu carry ratings / completed jobs.
    for i, p in enumerate(sipalu):
        for k in range(rng.randint(1, 4)):
            gh = ghardhani[(i + k) % 2]
            b = _booking(
                gh,
                p,
                status="confirmed",
                start=at(-10 - 7 * k - i % 5, 9 + (k * 2) % 8),
                rng=rng,
                service_idx=k,
            )
            _rate(b, rng)
    confirmed = [b for b in made if b.status == "confirmed"]
    for b in confirmed:
        _rate(b, rng)
    _requests(ghardhani, by_handle, rng)
    for p in sipalu:
        profile_svc.refresh_stats(p)
    stdout.write(
        f"  bolau: flag on · {len(sipalu)} Sipalu · Ghardhani 9800000020/9800000021 · "
        f"{Booking.objects.filter(ghardhani__in=ghardhani).count()} bookings · 2 Kaam requests"
    )
