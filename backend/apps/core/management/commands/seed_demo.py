"""Demo data for KaamSathi (CONTRACT.md §4).

    python manage.py seed_demo            # idempotent: upserts base data, adds activity once
    python manage.py seed_demo --reset    # wipe demo orgs/workers and rebuild (attendance ends today)

State transitions go through the real services (hiring.move_application,
workforce.create_employment / approve_leave / end_employment / upsert_attendance,
payroll.create_run / approve_run / mark_paid, billing.create_subscription_charge)
so derived rows (placement charges, leave attendance, payslips, advance recovery)
are internally consistent.
"""

from __future__ import annotations

import datetime as dt
import random
from decimal import Decimal

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.core.bs import BSMonth, bs_str, bs_to_ad, js_weekday

SEED = 2083
OTP_HINT = "123456"
WINDOW_DAYS = 60

OWNER_PHONE = "9800000001"
SUPERVISOR_PHONE = "9800000002"
OPS_PHONE = "9800000003"
WORKER_USER_PHONE = "9800000010"

HOTEL = "Hotel Annapurna View Pvt. Ltd."
BUILDERS = "Shivam Builders & Construction"

# Ecosystem apps may ship ``apps/<app>/demo.py`` with ``seed(stdout, rng)``; run in this order.
ECOSYSTEM_DEMOS = (
    "trust",
    "crews",
    "credentials",
    "training",
    "compliance",
    "payouts",
    "scheduling",
    "partners",
    "finance",
    "privacy",
)

# fmt: off
# (key, full_name, full_name_ne, gender, [(trade, years, nstb)], permanent_district, current_district, birth_year)  # noqa: E501
WORKERS = [
    # 0–13: hotel staff (direct)
    ("ram", "Ram Bahadur Thapa", "राम बहादुर थापा", "male", [("cook", 8, "level2"), ("kitchen_helper", 3, "none")], "gorkha", "kathmandu", 1989),  # noqa: E501
    ("sita", "Sita Kumari Tamang", "सीता कुमारी तामाङ", "female", [("housekeeping", 4, "level1")], "nuwakot", "kathmandu", 1994),  # noqa: E501
    ("hari", "Hari Prasad Adhikari", "हरि प्रसाद अधिकारी", "male", [("waiter", 5, "level1")], "syangja", "kathmandu", 1992),  # noqa: E501
    ("gita", "Gita Magar", "गीता मगर", "female", [("kitchen_helper", 2, "none")], "palpa", "kathmandu", 1999),
    ("bishnu", "Bishnu Kumar Shrestha", "विष्णु कुमार श्रेष्ठ", "male", [("cook", 12, "level3")], "kathmandu", "kathmandu", 1983),  # noqa: E501
    ("krishna", "Krishna Bahadur Gurung", "कृष्ण बहादुर गुरुङ", "male", [("security_guard", 6, "none")], "lamjung", "kathmandu", 1980),  # noqa: E501
    ("laxmi", "Laxmi Rai", "लक्ष्मी राई", "female", [("housekeeping", 3, "elementary")], "khotang", "kathmandu", 1996),  # noqa: E501
    ("dipak", "Dipak Khadka", "दीपक खड्का", "male", [("waiter", 3, "none")], "dolakha", "kathmandu", 2000),
    ("sarita", "Sarita Lama", "सरिता लामा", "female", [("cleaner", 2, "none"), ("housekeeping", 1, "none")], "sindhupalchok", "kathmandu", 1997),  # noqa: E501
    ("ramesh", "Ramesh Bhandari", "रमेश भण्डारी", "male", [("driver", 9, "none")], "kavrepalanchok", "kathmandu", 1986),  # noqa: E501
    ("kamala", "Kamala Sunuwar", "कमला सुनुवार", "female", [("kitchen_helper", 1, "none")], "ramechhap", "kathmandu", 2002),  # noqa: E501
    ("bikram", "Bikram Rana Magar", "विक्रम राना मगर", "male", [("security_guard", 4, "none")], "baglung", "kathmandu", 1991),  # noqa: E501
    ("mina", "Mina Shahi", "मीना शाही", "female", [("housekeeping", 5, "level1")], "kalikot", "lalitpur", 1993),  # noqa: E501
    ("suman", "Suman Maharjan", "सुमन महर्जन", "male", [("store_keeper", 6, "none")], "lalitpur", "lalitpur", 1990),  # noqa: E501
    # 14–26: construction crew (direct)
    ("shyam", "Shyam Lal Chaudhary", "श्याम लाल चौधरी", "male", [("mason", 15, "level2"), ("helper", 5, "none")], "bara", "makwanpur", 1979),  # noqa: E501
    ("dil", "Dil Bahadur Syangtan", "दिल बहादुर स्याङ्तान", "male", [("mason", 7, "level1")], "makwanpur", "makwanpur", 1990),  # noqa: E501
    ("raju", "Raju Pakhrin", "राजु पाख्रिन", "male", [("carpenter", 10, "level2")], "makwanpur", "makwanpur", 1987),  # noqa: E501
    ("mohan", "Mohan Yadav", "मोहन यादव", "male", [("rebar_worker", 5, "none")], "dhanusha", "makwanpur", 1995),  # noqa: E501
    ("santosh", "Santosh Mahato", "सन्तोष महतो", "male", [("helper", 2, "none")], "sarlahi", "makwanpur", 2001),  # noqa: E501
    ("pramod", "Pramod Ghising", "प्रमोद घिसिङ", "male", [("electrician", 8, "level2")], "makwanpur", "makwanpur", 1988),  # noqa: E501
    ("arjun", "Arjun Thing", "अर्जुन थिङ", "male", [("helper", 1, "none")], "makwanpur", "makwanpur", 2003),
    ("balkrishna", "Bal Krishna Paudel", "बालकृष्ण पौडेल", "male", [("plumber", 6, "level1")], "chitwan", "makwanpur", 1990),  # noqa: E501
    ("nirmala", "Nirmala Bishwakarma", "निर्मला विश्वकर्मा", "female", [("helper", 3, "none")], "makwanpur", "makwanpur", 1995),  # noqa: E501
    ("ganesh", "Ganesh Pariyar", "गणेश परियार", "male", [("painter", 4, "none")], "tanahun", "makwanpur", 1993),  # noqa: E501
    ("sanjay", "Sanjay Sah", "सञ्जय साह", "male", [("welder", 7, "level1")], "parsa", "makwanpur", 1989),
    ("tek", "Tek Bahadur Bohara", "टेक बहादुर बोहरा", "male", [("heavy_driver", 11, "none"), ("driver", 14, "none")], "kailali", "makwanpur", 1982),  # noqa: E501
    ("kumar", "Kumar Moktan", "कुमार मोक्तान", "male", [("loader", 2, "none"), ("helper", 2, "none")], "makwanpur", "makwanpur", 1998),  # noqa: E501
    # 27–29: hired through the pipeline (joined)
    ("anil", "Anil Gurung", "अनिल गुरुङ", "male", [("cook", 4, "level1")], "kaski", "kathmandu", 1995),
    ("sabina", "Sabina Tamang", "सबिना तामाङ", "female", [("housekeeping", 2, "none")], "makwanpur", "kathmandu", 1998),  # noqa: E501
    ("bir", "Bir Bahadur Lama", "बीर बहादुर लामा", "male", [("mason", 9, "level1")], "sindhuli", "makwanpur", 1986),  # noqa: E501
    # 30–31: ended employments
    ("nabin", "Nabin Karki", "नबिन कार्की", "male", [("waiter", 3, "none")], "okhaldhunga", "kathmandu", 1997),
    ("rajendra", "Rajendra Shah", "राजेन्द्र शाह", "male", [("carpenter", 5, "level1")], "mahottari", "makwanpur", 1992),  # noqa: E501
    # 32–44: available pool
    ("pabitra", "Pabitra Khatri", "पवित्रा खत्री", "female", [("cook", 3, "elementary")], "jumla", "kathmandu", 1996),  # noqa: E501
    ("sunil", "Sunil Basnet", "सुनिल बस्नेत", "male", [("cook", 6, "level1")], "jhapa", "kathmandu", 1991),
    ("manisha", "Manisha Chaudhary", "मनिषा चौधरी", "female", [("housekeeping", 1, "none")], "kailali", "kathmandu", 2002),  # noqa: E501
    ("kiran", "Kiran Bista", "किरण बिष्ट", "male", [("kitchen_helper", 2, "none"), ("cook", 1, "none")], "dadeldhura", "kathmandu", 2000),  # noqa: E501
    ("anjali", "Anjali Rai", "अञ्जली राई", "female", [("housekeeping", 2, "none")], "bhojpur", "lalitpur", 1999),  # noqa: E501
    ("dhan", "Dhan Bahadur Budha", "धन बहादुर बुढा", "male", [("mason", 6, "none")], "rukum-west", "makwanpur", 1990),  # noqa: E501
    ("upendra", "Upendra Mandal", "उपेन्द्र मण्डल", "male", [("mason", 4, "none")], "siraha", "makwanpur", 1994),
    ("lok", "Lok Bahadur Thapa", "लोक बहादुर थापा", "male", [("mason", 12, "level2")], "gorkha", "chitwan", 1984),  # noqa: E501
    ("chandra", "Chandra Tamang", "चन्द्र तामाङ", "male", [("helper", 3, "none"), ("mason", 1, "none")], "makwanpur", "makwanpur", 1999),  # noqa: E501
    ("sunita", "Sunita Pun", "सुनिता पुन", "female", [("waiter", 2, "none"), ("housekeeping", 1, "none")], "myagdi", "kaski", 1998),  # noqa: E501
    ("bhim", "Bhim Prasad Dahal", "भीम प्रसाद दाहाल", "male", [("security_guard", 8, "none")], "ilam", "kathmandu", 1981),  # noqa: E501
    ("ashok", "Ashok Kumar Jha", "अशोक कुमार झा", "male", [("electrician", 5, "level1")], "saptari", "kathmandu", 1993),  # noqa: E501
    ("manoj", "Manoj Oli", "मनोज ओली", "male", [("mason", 3, "elementary")], "dailekh", "makwanpur", 1997),
]

# Direct (pre-existing staff) employments:
# key -> (org, site, shift, designation, wage_type, basic|daily, other_allowance, ssf, start_date)
HOTEL_STAFF = {
    "ram":     ("thamel", "morning", "Cook", "monthly", 17500, 3000, True, dt.date(2023, 4, 16)),
    "sita":    ("thamel", "general", "Housekeeping Attendant", "monthly", 12500, 1500, True, dt.date(2024, 1, 15)),  # noqa: E501
    "hari":    ("thamel", "evening", "Waiter", "monthly", 13000, 2000, True, dt.date(2023, 9, 1)),
    "gita":    ("thamel", "morning", "Kitchen Helper", "monthly", 12170, 1000, False, dt.date(2025, 6, 1)),
    "bishnu":  ("thamel", "morning", "Head Cook", "monthly", 26000, 5000, True, dt.date(2021, 8, 17)),
    "krishna": ("thamel", "night", "Security Guard", "monthly", 13000, 1500, True, dt.date(2022, 11, 1)),
    "laxmi":   ("boudha", "general", "Housekeeping Attendant", "monthly", 12170, 1500, False, dt.date(2024, 7, 20)),  # noqa: E501
    "dipak":   ("thamel", "evening", "Waiter", "monthly", 12170, 1500, False, dt.date(2025, 2, 10)),
    "sarita":  ("boudha", "general", "Cleaner", "daily", 800, 0, False, dt.date(2025, 9, 5)),
    "ramesh":  ("thamel", "general", "Driver", "monthly", 15000, 2000, True, dt.date(2022, 3, 14)),
    "kamala":  ("boudha", "morning", "Kitchen Helper", "daily", 780, 0, False, dt.date(2026, 9, 1)),
    "bikram":  ("boudha", "night", "Security Guard", "monthly", 12500, 1500, False, dt.date(2024, 10, 1)),
    "mina":    ("boudha", "general", "Housekeeping Supervisor", "monthly", 16000, 2500, True, dt.date(2023, 1, 9)),  # noqa: E501
    "suman":   ("thamel", "general", "Store Keeper", "monthly", 14500, 1500, True, dt.date(2023, 6, 18)),
}
BUILDER_STAFF = {
    "shyam":      ("hetauda", "day", "Head Mason (Naike)", "monthly", 22000, 3000, True, dt.date(2022, 1, 10)),  # noqa: E501
    "dil":        ("hetauda", "day", "Mason", "daily", 1250, 0, False, dt.date(2024, 11, 3)),
    "raju":       ("hetauda", "day", "Carpenter", "daily", 1300, 0, False, dt.date(2024, 4, 21)),
    "mohan":      ("hetauda", "day", "Rebar Worker", "daily", 1050, 0, False, dt.date(2025, 3, 2)),
    "santosh":    ("hetauda", "day", "Helper", "daily", 800, 0, False, dt.date(2025, 10, 12)),
    "pramod":     ("warehouse", "day", "Site Electrician", "monthly", 18000, 2000, True, dt.date(2023, 5, 1)),
    "arjun":      ("hetauda", "day", "Helper", "daily", 754, 0, False, dt.date(2026, 8, 24)),
    "balkrishna": ("warehouse", "day", "Plumber", "daily", 1200, 0, False, dt.date(2025, 1, 15)),
    "nirmala":    ("hetauda", "day", "Helper", "daily", 780, 0, False, dt.date(2025, 7, 7)),
    "ganesh":     ("warehouse", "day", "Painter", "daily", 1000, 0, False, dt.date(2025, 12, 1)),
    "sanjay":     ("warehouse", "day", "Welder", "monthly", 16500, 1500, True, dt.date(2024, 2, 5)),
    "tek":        ("hetauda", "day", "Excavator / Tipper Driver", "monthly", 20000, 2500, True, dt.date(2023, 8, 1)),  # noqa: E501
    "kumar":      ("warehouse", "day", "Loader", "daily", 800, 0, False, dt.date(2026, 2, 16)),
}
# fmt: on

STANDARD_DA = Decimal("7380")


class Command(BaseCommand):
    help = (
        "Seed KaamSathi demo data (orgs, users, 45 workers, employments, hajiri, payroll, hiring pipeline)."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset", action="store_true", help="Delete demo orgs/workers first, then rebuild."
        )
        parser.add_argument(
            "--allow-production",
            action="store_true",
            help="Allow running with DEBUG=False (demo users with known phones; never on live data).",
        )

    # ------------------------------------------------------------------ entry
    def handle(self, *args, **opts):
        if not settings.DEBUG and not opts["allow_production"]:
            raise CommandError(
                "seed_demo refuses to run with DEBUG=False (production). Demo data creates users with "
                "known phone numbers and fake workers. Use `seed_reference` for reference data, or pass "
                "--allow-production on a throwaway staging database."
            )
        call_command("seed_reference", stdout=self.stdout)
        self.rng = random.Random(SEED)
        self.today = timezone.localdate()
        with transaction.atomic():
            if opts["reset"]:
                self._reset()
            self._base()
            from apps.workforce.models import Employment

            if Employment.objects.filter(organization__in=self.orgs.values()).exists():
                self.stdout.write(
                    self.style.WARNING(
                        "Demo activity already present — base data refreshed, activity left as is "
                        "(use --reset to rebuild with attendance ending today)."
                    )
                )
            else:
                self._activity()
        self._ecosystem()
        self._summary()

    def _ecosystem(self):
        """Call each ecosystem app's optional ``apps/<app>/demo.py: seed(stdout, rng)``."""
        import importlib

        for app in ECOSYSTEM_DEMOS:
            module_name = f"apps.{app}.demo"
            try:
                module = importlib.import_module(module_name)
            except ImportError as exc:
                if getattr(exc, "name", None) != module_name:
                    self.stdout.write(self.style.WARNING(f"  {app}: demo skipped ({exc})"))
                continue
            seed = getattr(module, "seed", None)
            if seed is None:
                continue
            with transaction.atomic():
                seed(self.stdout, random.Random(f"{SEED}-{app}"))

    # ------------------------------------------------------------------ reset
    def _reset(self):
        from apps.billing.models import Charge
        from apps.orgs.models import Organization
        from apps.payroll.models import PayrollRun, Payslip
        from apps.workers.models import Worker
        from apps.workforce.models import Employment

        orgs = Organization.objects.filter(name__in=[HOTEL, BUILDERS])
        phones = [self._worker_phone(i) for i in range(len(WORKERS))]
        # Ecosystem rows that PROTECT workers/payslips must go first (real data keeps them on purpose).
        from django.apps import apps as registry

        for label, lookup in (
            ("finance.Referral", "worker__phone__in"),
            ("partners.ConsentGrant", "worker__phone__in"),
            ("crews.Referral", "worker__phone__in"),
            ("crews.Referral", "crew__lead__phone__in"),
        ):
            if registry.is_installed(f"apps.{label.split('.')[0]}"):
                registry.get_model(label).objects.filter(**{lookup: phones}).delete()
        Payslip.objects.filter(run__organization__in=orgs).delete()
        Payslip.objects.filter(worker__phone__in=phones).delete()
        PayrollRun.objects.filter(organization__in=orgs).delete()
        Charge.objects.filter(organization__in=orgs).delete()
        Employment.objects.filter(organization__in=orgs).delete()
        Employment.objects.filter(worker__phone__in=phones).delete()
        n_orgs = orgs.count()
        orgs.delete()
        Worker.objects.filter(phone__in=phones).delete()
        self.stdout.write(f"Reset: removed {n_orgs} demo organizations and their data, demo workers.")

    # ------------------------------------------------------------------ base layer (always upserted)
    @staticmethod
    def _worker_phone(idx: int) -> str:
        return WORKER_USER_PHONE if idx == 0 else f"98000001{idx:02d}"

    def _user(self, phone, full_name, **extra):
        from apps.accounts.models import User

        user, created = User.objects.get_or_create(phone=phone, defaults={"full_name": full_name, **extra})
        if created:
            user.set_unusable_password()
            user.save(update_fields=["password"])
        else:
            changed = [k for k, v in {"full_name": full_name, **extra}.items() if getattr(user, k) != v]
            for k in changed:
                setattr(user, k, {"full_name": full_name, **extra}[k])
            if changed:
                user.save(update_fields=changed)
        return user

    def _base(self):
        from apps.orgs.models import Membership, Organization, Shift, Site

        self.owner = self._user(OWNER_PHONE, "Suresh Shrestha", email="suresh@annapurnaview.com.np")
        self.supervisor = self._user(SUPERVISOR_PHONE, "Bikash Gurung")
        self.ops = self._user(OPS_PHONE, "Anita Karki", is_staff=True, email="ops@kaamsathi.com.np")
        self.worker_user = self._user(WORKER_USER_PHONE, "Ram Bahadur Thapa", preferred_language="ne")

        hotel, _ = Organization.objects.update_or_create(
            name=HOTEL,
            defaults=dict(
                name_ne="होटल अन्नपूर्ण भ्यू प्रा. लि.",
                pan_no="609874512",
                vat_registered=True,
                ssf_employer_no="SSF-ER-3021457",
                industry="hospitality",
                district_id="kathmandu",
                municipality="Kathmandu Metropolitan City",
                ward=26,
                address="Chaksibari Marg, Thamel",
                phone="01-4701234",
                email="info@annapurnaview.com.np",
                plan="standard",
                weekly_off_day=6,
            ),
        )
        builders, _ = Organization.objects.update_or_create(
            name=BUILDERS,
            defaults=dict(
                name_ne="शिवम् बिल्डर्स एण्ड कन्स्ट्रक्सन",
                pan_no="301245678",
                vat_registered=True,
                ssf_employer_no="SSF-ER-5104433",
                industry="construction",
                district_id="makwanpur",
                municipality="Hetauda Sub-Metropolitan City",
                ward=4,
                address="Main Road, Hetauda-4",
                phone="057-521456",
                email="shivambuilders@gmail.com",
                plan="pilot",
                weekly_off_day=6,
            ),
        )
        self.orgs = {"hotel": hotel, "builders": builders}

        site_rows = [
            (
                "thamel",
                hotel,
                "Thamel Main Building",
                "Chaksibari Marg, Thamel, Kathmandu-26",
                "kathmandu",
                "27.715400",
                "85.312300",
                150,
            ),
            (
                "boudha",
                hotel,
                "Boudha Annex",
                "Phulbari, Boudha, Kathmandu-6",
                "kathmandu",
                "27.721500",
                "85.362000",
                150,
            ),
            (
                "hetauda",
                builders,
                "Hetauda Commercial Complex",
                "Main Road, Hetauda-4",
                "makwanpur",
                "27.428700",
                "85.032200",
                300,
            ),
            (
                "warehouse",
                builders,
                "Hetauda Industrial Area Warehouse",
                "Industrial Area, Hetauda-8",
                "makwanpur",
                "27.416600",
                "85.008300",
                250,
            ),
        ]
        self.sites = {}
        for key, org, name, address, district, lat, lng, radius in site_rows:
            site, _ = Site.objects.update_or_create(
                organization=org,
                name=name,
                defaults=dict(
                    address=address,
                    district_id=district,
                    lat=Decimal(lat),
                    lng=Decimal(lng),
                    geofence_radius_m=radius,
                    is_active=True,
                ),
            )
            self.sites[key] = site

        shift_rows = [
            ("morning", hotel, "Morning", dt.time(6, 0), dt.time(14, 0), 30),
            ("evening", hotel, "Evening", dt.time(14, 0), dt.time(22, 0), 30),
            ("general", hotel, "General", dt.time(9, 0), dt.time(18, 0), 60),
            ("night", hotel, "Night", dt.time(22, 0), dt.time(6, 0), 30),
            ("day", builders, "Day", dt.time(8, 0), dt.time(17, 0), 60),
        ]
        self.shifts = {}
        for key, org, name, start, end, brk in shift_rows:
            shift, _ = Shift.objects.update_or_create(
                organization=org, name=name, defaults=dict(start_time=start, end_time=end, break_minutes=brk)
            )
            self.shifts[key] = shift

        for org in (hotel, builders):
            Membership.objects.update_or_create(
                user=self.owner, organization=org, defaults={"role": "owner", "is_active": True}
            )
        sup, _ = Membership.objects.update_or_create(
            user=self.supervisor, organization=hotel, defaults={"role": "supervisor", "is_active": True}
        )
        sup.sites.set([self.sites["thamel"]])

        self._workers()

    def _workers(self):
        from apps.workers.models import Consent, Worker, WorkerSkill

        rng = random.Random(SEED + 1)
        employed = set(HOTEL_STAFF) | set(BUILDER_STAFF) | {"anil", "sabina", "bir"}
        verified_at = timezone.now() - dt.timedelta(days=120)
        banks = ["Nabil Bank", "Global IME Bank", "NIC Asia Bank", "Rastriya Banijya Bank", "Prabhu Bank"]
        self.workers = {}
        for idx, (key, name, name_ne, gender, skills, perm, cur, year) in enumerate(WORKERS):
            # ~70% verified (32/45): every worker except a fixed set of pending/unverified/rejected ones.
            status = {
                "kamala": "pending",
                "arjun": "pending",
                "pabitra": "pending",
                "manisha": "pending",
                "upendra": "pending",
                "kiran": "unverified",
                "chandra": "unverified",
                "sunita": "unverified",
                "manoj": "unverified",
                "anjali": "unverified",
                "kumar": "unverified",
                "dhan": "rejected",
                "santosh": "pending",
            }.get(key, "verified")
            method = rng.choice(["bank", "bank", "esewa", "khalti", "cash"])
            if key == "ram":
                method = "bank"
            trade, years, _ = skills[0]
            defaults = dict(
                full_name=name,
                full_name_ne=name_ne,
                gender=gender,
                date_of_birth=dt.date(year, rng.randint(1, 12), rng.randint(1, 28)),
                permanent_district_id=perm,
                current_district_id=cur,
                address=f"{cur.replace('-', ' ').title()}, ward {rng.randint(1, 20)}",
                citizenship_no=(
                    f"{rng.randint(10, 77)}-{rng.randint(1, 9):02d}-{year % 100:02d}-"
                    f"{rng.randint(1000, 99999):05d}"
                ),
                verification_status=status,
                verified_by=self.ops if status in ("verified", "rejected") else None,
                verified_at=verified_at + dt.timedelta(days=idx)
                if status in ("verified", "rejected")
                else None,
                verification_note="Citizenship photo unreadable; asked to re-upload."
                if status == "rejected"
                else None,
                expected_monthly_wage=Decimal(max(19550, 18000 + years * 1200 + rng.randint(0, 6) * 500)),
                is_available=key not in employed,
                available_from=None
                if key in employed
                else self.today + dt.timedelta(days=rng.choice([0, 0, 3, 7])),
                payment_method=method,
                bank_name=rng.choice(banks) if method == "bank" else None,
                bank_account_no=f"0{rng.randint(10**12, 10**13 - 1)}" if method == "bank" else None,
                bank_account_name=name if method == "bank" else None,
                wallet_id=self._worker_phone(idx) if method in ("esewa", "khalti") else None,
                user=self.worker_user if key == "ram" else None,
            )
            worker, _ = Worker.objects.update_or_create(phone=self._worker_phone(idx), defaults=defaults)
            self.workers[key] = worker
            for trade, years, nstb in skills:
                WorkerSkill.objects.update_or_create(
                    worker=worker,
                    trade_id=trade,
                    defaults=dict(
                        years_experience=years,
                        nstb_level=nstb,
                        certificate_no=f"NSTB-{trade[:3].upper()}-{20000 + idx * 7}"
                        if nstb.startswith("level")
                        else None,
                    ),
                )
            Consent.objects.get_or_create(
                worker=worker,
                organization=None,
                scope="data_processing",
                defaults={
                    "granted": True,
                    "channel": "app" if key == "ram" else rng.choice(["ops", "paper", "sms"]),
                },
            )
        # Naike (crew leader) for the Hetauda masonry crew.
        crew = ["dil", "mohan", "santosh", "arjun", "nirmala", "bir"]
        Worker.objects.filter(pk__in=[self.workers[k].pk for k in crew]).update(naike=self.workers["shyam"])
        for key in ("ram", "anil", "sabina", "pabitra", "sunil"):
            Consent.objects.get_or_create(
                worker=self.workers[key],
                organization=self.orgs["hotel"],
                scope="profile_share",
                defaults={"granted": True, "channel": "app"},
            )

    # ------------------------------------------------------------------ activity layer (once)
    def _activity(self):
        self.window_start = self.today - dt.timedelta(days=WINDOW_DAYS - 1)
        self.employments = {}
        self._direct_employments()
        self._ended_employments()
        self._hiring()
        self._attendance()
        self._leaves()
        self._advances()
        self._payroll()
        self._billing()

    def _set_ssf_id(self, worker):
        if not worker.ssf_id:
            worker.ssf_id = f"SSF{worker.phone[-6:]}{worker.date_of_birth.year % 100:02d}"
            worker.save(update_fields=["ssf_id", "updated_at"])

    def _employment_data(self, spec, prefix, n):
        site, shift, designation, wage_type, amount, other, ssf, start = spec
        data = {
            "site": self.sites[site],
            "shift": self.shifts[shift],
            "designation": designation,
            "employee_code": f"{prefix}-{n:03d}",
            "start_date": start,
            "wage_type": wage_type,
            "ssf_enrolled": ssf,
            "supervisor": self.supervisor if site == "thamel" else None,
        }
        if wage_type == "monthly":
            data.update(
                basic_salary=Decimal(amount), dearness_allowance=STANDARD_DA, other_allowance=Decimal(other)
            )
        else:
            data["daily_wage"] = Decimal(amount)
        return data

    def _direct_employments(self):
        from apps.workers.models import Trade
        from apps.workforce.services import create_employment

        trades = {t.pk: t for t in Trade.objects.all()}
        for org_key, staff, prefix in (("hotel", HOTEL_STAFF, "HAV"), ("builders", BUILDER_STAFF, "SBC")):
            for n, (key, spec) in enumerate(staff.items(), start=1):
                worker = self.workers[key]
                data = self._employment_data(spec, prefix, n)
                data["trade"] = trades[WORKERS_BY_KEY[key][4][0][0]]
                if data["ssf_enrolled"]:
                    self._set_ssf_id(worker)
                self.employments[key] = create_employment(self.orgs[org_key], worker, data)

    def _ended_employments(self):
        from apps.workers.models import Rating, Trade
        from apps.workforce.services import create_employment, end_employment

        specs = [
            (
                "nabin",
                "hotel",
                ("thamel", "evening", "Waiter", "monthly", 12170, 1500, False, dt.date(2025, 3, 1)),
                "HAV-090",
                dt.date(2026, 8, 5),
                "resigned",
                (4, 3, "Polite with guests; left for a job in Pokhara."),
                (4, 4, "Salary always on time, staff food was good."),
            ),
            (
                "rajendra",
                "builders",
                ("hetauda", "day", "Carpenter", "daily", 1150, 0, False, dt.date(2025, 11, 10)),
                "SBC-090",
                dt.date(2026, 8, 28),
                "contract_end",
                (5, 4, "Shuttering work finished on schedule."),
                (3, 3, "Pay was a few days late some months."),
            ),
        ]
        for key, org_key, spec, code, end, reason, emp_rating, worker_rating in specs:
            data = self._employment_data(spec, code.split("-")[0], 0)
            data.update(employee_code=code, trade=Trade.objects.get(pk=WORKERS_BY_KEY[key][4][0][0]))
            emp = create_employment(self.orgs[org_key], self.workers[key], data)
            self.employments[key] = end_employment(emp, end, reason)
            Rating.objects.create(
                employment=emp,
                rater="employer",
                score_a=emp_rating[0],
                score_b=emp_rating[1],
                comment=emp_rating[2],
            )
            Rating.objects.create(
                employment=emp,
                rater="worker",
                score_a=worker_rating[0],
                score_b=worker_rating[1],
                comment=worker_rating[2],
            )

    # ------------------------------------------------------------------ hiring pipeline
    def _hiring(self):
        from apps.hiring.models import Application, JobOpening, StageEvent
        from apps.hiring.services import move_application, shortlist_workers, validate_job_wage
        from apps.workers.models import Trade

        now = timezone.now()
        jobs = [
            dict(
                org="hotel",
                site="thamel",
                shift="morning",
                trade="cook",
                title="Line Cook (Nepali & Continental)",
                description="Prepare breakfast and lunch for 60-room hotel. Dal-bhat, tandoor and "
                "continental "
                "breakfast experience preferred.",
                openings=2,
                wage_type="monthly",
                wage=Decimal("24000"),
                food=True,
                room=True,
                exp=2,
                age_days=16,
                stages={
                    "joined": "anil",
                    "selected": "sunil",
                    "interview": "pabitra",
                    "shortlisted": "kiran",
                    "sourced": "manisha",
                    "rejected": "sunita",
                    "dropped": "bhim",
                },
                join=dict(
                    designation="Line Cook",
                    wage_type="monthly",
                    basic_salary=Decimal("15000"),
                    dearness_allowance=STANDARD_DA,
                    other_allowance=Decimal("1620"),
                    ssf_enrolled=True,
                    employee_code="HAV-015",
                ),
            ),
            dict(
                org="hotel",
                site="boudha",
                shift="general",
                trade="housekeeping",
                title="Housekeeping Attendant",
                description="Room cleaning, linen and laundry for guest house annex near Boudha Stupa.",
                openings=3,
                wage_type="monthly",
                wage=Decimal("20500"),
                food=True,
                room=False,
                exp=0,
                age_days=12,
                stages={
                    "joined": "sabina",
                    "selected": "anjali",
                    "interview": "manisha",
                    "shortlisted": "sunita",
                    "sourced": "nabin",
                    "rejected": "kiran",
                    "dropped": "pabitra",
                },
                join=dict(
                    designation="Housekeeping Attendant",
                    wage_type="monthly",
                    basic_salary=Decimal("13120"),
                    dearness_allowance=STANDARD_DA,
                    other_allowance=Decimal("0"),
                    ssf_enrolled=False,
                    employee_code="HAV-016",
                ),
            ),
            dict(
                org="builders",
                site="hetauda",
                shift="day",
                trade="mason",
                title="Mason (Dakarmi) — RCC building",
                description="Brick/block work and plastering for a 5-storey commercial complex. "
                "Tools provided.",
                openings=4,
                wage_type="daily",
                wage=Decimal("1200"),
                food=False,
                room=True,
                exp=3,
                age_days=20,
                stages={
                    "joined": "bir",
                    "selected": "lok",
                    "interview": "dhan",
                    "shortlisted": "upendra",
                    "sourced": "manoj",
                    "rejected": "chandra",
                    "dropped": "rajendra",
                },
                join=dict(
                    designation="Mason",
                    wage_type="daily",
                    daily_wage=Decimal("1200"),
                    ssf_enrolled=False,
                    employee_code="SBC-014",
                ),
            ),
        ]
        self.jobs = []
        for j_idx, spec in enumerate(jobs):
            org = self.orgs[spec["org"]]
            validate_job_wage(spec["wage_type"], spec["wage"])
            created = now - dt.timedelta(days=spec["age_days"], hours=5)
            job = JobOpening.objects.create(
                organization=org,
                site=self.sites[spec["site"]],
                trade=Trade.objects.get(pk=spec["trade"]),
                title=spec["title"],
                description=spec["description"],
                openings_count=spec["openings"],
                wage_type=spec["wage_type"],
                wage_amount=spec["wage"],
                shift=self.shifts[spec["shift"]],
                food_provided=spec["food"],
                accommodation_provided=spec["room"],
                start_date=self.today - dt.timedelta(days=spec["age_days"] - 8),
                min_experience_years=spec["exp"],
                status="open",
                created_by=self.owner,
            )
            JobOpening.objects.filter(pk=job.pk).update(
                created_at=created, published_at=created + dt.timedelta(minutes=20)
            )
            stages = spec["stages"]

            # Sourced: ops added the worker to the pipeline but has not shortlisted yet.
            app = Application.objects.create(
                job=job,
                worker=self.workers[stages["sourced"]],
                stage="sourced",
                sourced_by=self.ops,
                notes="Called — interested, checking references.",
            )
            StageEvent.objects.create(
                application=app,
                from_stage=None,
                to_stage="sourced",
                by=self.ops,
                note="Sourced by KaamSathi ops",
            )

            shortlisted_keys = [
                stages[s] for s in ("shortlisted", "interview", "selected", "joined", "rejected", "dropped")
            ]
            apps = {
                a.worker_id: a
                for a in shortlist_workers(job, [self.workers[k] for k in shortlisted_keys], self.ops)
            }
            app_of = {
                stage: apps[self.workers[key].pk] for stage, key in stages.items() if stage != "sourced"
            }

            interview_at = timezone.make_aware(
                dt.datetime.combine(self.today + dt.timedelta(days=2), dt.time(11, 0))
            )
            past_interview = timezone.make_aware(
                dt.datetime.combine(self.today - dt.timedelta(days=spec["age_days"] - 6), dt.time(11, 0))
            )
            move_application(
                app_of["interview"],
                "interview",
                self.owner,
                interview_at=interview_at,
                note="Trial cooking/work test on site.",
            )
            for stage in ("selected", "joined", "rejected"):
                move_application(app_of[stage], "interview", self.owner, interview_at=past_interview)
            move_application(
                app_of["selected"], "selected", self.owner, note="Offer made; joining after Dashain."
            )
            move_application(
                app_of["rejected"],
                "rejected",
                self.owner,
                rejection_reason="Not enough hands-on experience for this role.",
            )
            move_application(app_of["dropped"], "selected", self.owner, note="Offer made.")
            move_application(app_of["dropped"], "dropped", self.owner, note="Took a job abroad (Malaysia).")
            move_application(app_of["joined"], "selected", self.owner, note="Offer accepted.")
            start = self.today - dt.timedelta(days=spec["age_days"] - 9)
            emp_data = dict(
                spec["join"],
                start_date=start,
                site=self.sites[spec["site"]],
                supervisor=self.supervisor if spec["site"] == "thamel" else None,
            )
            _, emp = move_application(
                app_of["joined"], "joined", self.owner, employment_data=emp_data, note="Joined on site."
            )
            self.employments[stages["joined"]] = emp

            # Backdate pipeline timestamps so dashboards (hours_to_shortlist, hires_30d) look lived-in.
            first_shortlist = created + dt.timedelta(hours=6 + j_idx * 5)
            JobOpening.objects.filter(pk=job.pk).update(first_shortlist_at=first_shortlist)
            for a_idx, a in enumerate(job.applications.all()):
                base = created + dt.timedelta(hours=2 + a_idx)
                Application.objects.filter(pk=a.pk).update(created_at=base)
                events = list(a.events.order_by("id"))
                for e_idx, ev in enumerate(events):
                    when = first_shortlist if e_idx == 0 and ev.to_stage == "shortlisted" else base
                    when = when + dt.timedelta(days=min(e_idx * 3, spec["age_days"] - 1))
                    if ev.to_stage == "joined":
                        when = timezone.make_aware(dt.datetime.combine(start, dt.time(9, 0)))
                    StageEvent.objects.filter(pk=ev.pk).update(created_at=when)
                    if e_idx == len(events) - 1:
                        Application.objects.filter(pk=a.pk).update(stage_changed_at=when)
            job.refresh_from_db()
            self.jobs.append(job)

    # ------------------------------------------------------------------ attendance
    def _attendance(self):
        from apps.workforce.models import Holiday
        from apps.workforce.services import upsert_attendance

        holidays = set(
            Holiday.objects.filter(date__range=(self.window_start, self.today)).values_list("date", flat=True)
        )
        rng = self.rng
        for key, emp in sorted(self.employments.items()):
            org = emp.organization
            site = emp.site
            shift = emp.shift
            reliability = rng.uniform(0.86, 0.97)
            ot_prob = 0.25 if (emp.trade_id in ("cook", "mason", "heavy_driver")) else 0.08
            recorder = self.supervisor if site and site.name == "Thamel Main Building" else self.owner
            start = max(emp.start_date, self.window_start)
            end = min(emp.end_date or self.today, self.today)
            day = start
            while day <= end:
                values = self._day_values(
                    rng, org, emp, site, shift, day, holidays, reliability, ot_prob, key
                )
                if values is not None:
                    upsert_attendance(emp, day, values, user=recorder)
                day += dt.timedelta(days=1)

    def _day_values(self, rng, org, emp, site, shift, day, holidays, reliability, ot_prob, key):
        is_today = day == self.today
        weekly_off = js_weekday(day) == org.weekly_off_day
        if day in holidays:
            # The hotel keeps running on festivals: about half the staff work as normal.
            if weekly_off or org.industry != "hospitality" or rng.random() >= 0.5:
                return {"status": "holiday", "method": "supervisor"}
        elif weekly_off:
            return {"status": "weekly_off", "method": "supervisor"}
        if is_today and rng.random() < 0.12:
            return None  # not marked yet today
        r = rng.random()
        if r < reliability:
            status = "present"
        elif r < reliability + (1 - reliability) * 0.45:
            status = "half_day"
        else:
            status = "absent"
        if status == "absent":
            return {
                "status": "absent",
                "method": "supervisor",
                "note": rng.choice(["No call, no show", "Informed — unwell", "Family function", None]),
            }
        start_t = shift.start_time if shift else dt.time(9, 0)
        check_in = timezone.make_aware(dt.datetime.combine(day, start_t)) + dt.timedelta(
            minutes=rng.randint(-12, 18)
        )
        work_minutes = shift.working_minutes + shift.break_minutes if shift else 540
        overtime = 0
        if status == "half_day":
            work_minutes //= 2
        elif rng.random() < ot_prob:
            overtime = rng.choice([30, 60, 60, 90, 120, 180])
        check_out = check_in + dt.timedelta(minutes=work_minutes + overtime + rng.randint(-5, 10))
        method = "qr" if site and site.name == "Thamel Main Building" and rng.random() < 0.7 else "supervisor"
        if key == "ram":
            method = "self"
        values = {"status": status, "method": method, "check_in_at": check_in, "overtime_minutes": overtime}
        if site and site.lat is not None and method in ("qr", "self"):

            def jitter():  # ~±45 m around the site pin
                return Decimal(rng.randint(-40, 40)) / Decimal(100000)

            values.update(check_in_lat=site.lat + jitter(), check_in_lng=site.lng + jitter())
        if is_today and check_out > timezone.now():
            values["overtime_minutes"] = 0  # still on shift
        else:
            values["check_out_at"] = check_out
            if "check_in_lat" in values:
                values.update(check_out_lat=values["check_in_lat"], check_out_lng=values["check_in_lng"])
        return values

    # ------------------------------------------------------------------ leave
    def _leaves(self):
        from apps.workforce.models import LeaveRequest
        from apps.workforce.services import approve_leave

        def bs(y, m, d):
            return bs_to_ad(y, m, d)

        cur = BSMonth.of(self.today)
        prev = cur.previous()
        approved = [
            (
                "sita",
                "sick",
                bs(prev.year, prev.month, 9),
                bs(prev.year, prev.month, 10),
                "Fever (doctor's note given)",
            ),
            (
                "hari",
                "home",
                bs(prev.year, prev.month, 18),
                bs(prev.year, prev.month, 20),
                "Going home to Syangja",
            ),
            (
                "mohan",
                "unpaid",
                bs(prev.year, prev.month, 14),
                bs(prev.year, prev.month, 15),
                "Land registration work",
            ),
            ("tek", "sick", bs(prev.year, prev.month, 23), bs(prev.year, prev.month, 23), "Back pain"),
            (
                "ram",
                "home",
                self.today - dt.timedelta(days=9),
                self.today - dt.timedelta(days=8),
                "Teej at home",
            ),
            (
                "laxmi",
                "sick",
                self.today - dt.timedelta(days=4),
                self.today - dt.timedelta(days=4),
                "Stomach upset",
            ),
        ]
        self.leave_counts = {"approved": 0, "pending": 0, "rejected": 0}
        for key, ltype, start, end, reason in approved:
            emp = self.employments[key]
            lv = LeaveRequest.objects.create(
                employment=emp,
                leave_type=ltype,
                from_date=start,
                to_date=end,
                days=Decimal((end - start).days + 1),
                reason=reason,
            )
            approve_leave(lv, self.owner)
            self.leave_counts["approved"] += 1
        pending = [
            (
                "ram",
                "home",
                self.today + dt.timedelta(days=12),
                self.today + dt.timedelta(days=17),
                "Dashain tika at home in Gorkha",
            ),
            (
                "dil",
                "home",
                self.today + dt.timedelta(days=6),
                self.today + dt.timedelta(days=8),
                "Brother's wedding",
            ),
        ]
        for key, ltype, start, end, reason in pending:
            LeaveRequest.objects.create(
                employment=self.employments[key],
                leave_type=ltype,
                from_date=start,
                to_date=end,
                days=Decimal((end - start).days + 1),
                reason=reason,
            )
            self.leave_counts["pending"] += 1
        LeaveRequest.objects.create(
            employment=self.employments["dipak"],
            leave_type="home",
            from_date=bs(prev.year, prev.month, 25),
            to_date=bs(prev.year, prev.month, 30),
            days=Decimal(6),
            reason="Visit family",
            status="rejected",
            decided_by=self.owner,
            decided_at=timezone.now() - dt.timedelta(days=30),
            decision_note="Peak tourist season — please take after Tihar.",
        )
        self.leave_counts["rejected"] += 1

    # ------------------------------------------------------------------ peski
    def _advances(self):
        from apps.workforce.models import Advance

        cur = BSMonth.of(self.today)
        prev = cur.previous()
        rows = [
            ("shyam", 20000, prev.start + dt.timedelta(days=3), 5000, "Daughter's school admission"),
            ("gita", 5000, prev.start - dt.timedelta(days=20), 2500, "Medical expenses"),
            ("santosh", 8000, prev.start + dt.timedelta(days=15), 2000, "Sent home for paddy planting"),
            ("arjun", 3000, prev.start + dt.timedelta(days=10), 1500, "Room rent deposit"),
            ("ram", 10000, cur.start + dt.timedelta(days=7), 2500, "Dashain advance"),
        ]
        for key, amount, given_on, per_month, note in rows:
            Advance.objects.create(
                employment=self.employments[key],
                amount=Decimal(amount),
                given_on=given_on,
                recover_per_month=Decimal(per_month),
                note=note,
            )

    # ------------------------------------------------------------------ payroll
    def _payroll(self):
        from apps.payroll.services import approve_run, create_run, mark_paid

        cur = BSMonth.of(self.today)
        prev = cur.previous()
        self.runs = []
        for org_key, org in self.orgs.items():
            run = create_run(org, prev.year, prev.month)
            approve_run(run, self.owner)
            paid_on = min(cur.start + dt.timedelta(days=2), self.today)
            run = mark_paid(run, paid_on, method=None)
            self.runs.append(run)
            draft = create_run(org, cur.year, cur.month, include_festival_allowance=(org_key == "hotel"))
            self.runs.append(draft)

    def _billing(self):
        from apps.billing.services import create_subscription_charge

        cur = BSMonth.of(self.today)
        prev = cur.previous()
        for org in self.orgs.values():
            charge, _ = create_subscription_charge(org, prev.year, prev.month)
            charge.status = "paid"
            charge.save(update_fields=["status"])
            create_subscription_charge(org, cur.year, cur.month)

    # ------------------------------------------------------------------ summary
    def _summary(self):
        from apps.billing.models import Charge
        from apps.hiring.models import Application, JobOpening
        from apps.payroll.models import PayrollRun
        from apps.payroll.services import run_totals
        from apps.workers.models import Worker
        from apps.workforce.models import Advance, Attendance, Employment, LeaveRequest

        orgs = list(self.orgs.values())
        phones = [self._worker_phone(i) for i in range(len(WORKERS))]
        workers = Worker.objects.filter(phone__in=phones)
        emps = Employment.objects.filter(organization__in=orgs)
        att = Attendance.objects.filter(employment__organization__in=orgs)
        out = self.stdout.write
        out(self.style.SUCCESS("\nKaamSathi demo data ready"))
        out(f"  Today: {self.today} (BS {bs_str(self.today)})")
        out(
            f"  Workers: {workers.count()} "
            f"({workers.filter(verification_status='verified').count()} verified, "
            f"{workers.filter(is_available=True).count()} available)"
        )
        out(
            f"  Employments: {emps.filter(status='active').count()} active, "
            f"{emps.filter(status='ended').count()} ended"
        )
        if att.exists():
            first = att.order_by("date").first().date
            last = att.order_by("-date").first().date
            out(f"  Attendance: {att.count()} rows {first} → {last}")
        out(
            "  Leave requests: "
            + ", ".join(
                f"{LeaveRequest.objects.filter(employment__organization__in=orgs, status=s).count()} {s}"
                for s in ("approved", "pending", "rejected")
            )
        )
        out(f"  Advances (peski): {Advance.objects.filter(employment__organization__in=orgs).count()}")
        for run in PayrollRun.objects.filter(organization__in=orgs).order_by(
            "organization__name", "bs_year", "bs_month"
        ):
            t = run_totals(run)["totals"]
            out(
                f"  Payroll {run.organization.name[:24]:<24} {run.bs_year}-{run.bs_month:02d} "
                f"{run.status:<6} "
                f"{t['workers']} slips, net Rs. {t['net']}"
            )
        jobs = JobOpening.objects.filter(organization__in=orgs)
        apps = Application.objects.filter(job__in=jobs)
        out(
            f"  Jobs: {jobs.filter(status='open').count()} open; applications by stage: "
            + ", ".join(
                f"{s}={apps.filter(stage=s).count()}"
                for s in ("sourced", "shortlisted", "interview", "selected", "joined", "rejected", "dropped")
            )
        )
        charges = Charge.objects.filter(organization__in=orgs)
        out(
            f"  Charges: {charges.filter(kind='placement').count()} placement, "
            f"{charges.filter(kind='subscription').count()} subscription"
        )
        out(self.style.SUCCESS(f"\nDemo logins (OTP {OTP_HINT} in DEBUG):"))
        out(f"  {OWNER_PHONE}  owner — {HOTEL} + {BUILDERS}")
        out(f"  {SUPERVISOR_PHONE}  supervisor — {HOTEL}, site Thamel Main Building")
        out(f"  {OPS_PHONE}  ops staff (is_staff)")
        out(f"  {WORKER_USER_PHONE}  worker — Ram Bahadur Thapa (cook @ {HOTEL})")


WORKERS_BY_KEY = {row[0]: row for row in WORKERS}
