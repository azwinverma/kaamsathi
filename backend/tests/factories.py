"""factory_boy factories.

Reference data (districts, trades, minimum wage, tax slabs) is seeded once per session.
"""

import datetime as dt
from decimal import Decimal

import factory

from apps.accounts.models import User
from apps.geo.models import District
from apps.hiring.models import Application, JobOpening
from apps.orgs.models import Membership, Organization, Shift, Site
from apps.workers.models import Trade, Worker, WorkerSkill
from apps.workforce.models import Advance, Attendance, Employment, Holiday, LeaveRequest

_phone = factory.Sequence(lambda n: f"98{n:08d}")


def district(code="kathmandu"):
    return District.objects.get(code=code)


def trade(code="cook"):
    return Trade.objects.get(code=code)


class UserFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = User
        django_get_or_create = ("phone",)

    phone = factory.Sequence(lambda n: f"97{n:08d}")
    full_name = factory.Faker("name")


class OrganizationFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Organization

    name = factory.Sequence(lambda n: f"Org {n}")
    industry = "hospitality"
    district = factory.LazyFunction(district)
    address = "Thamel"
    phone = "014000000"
    weekly_off_day = 6
    # KYB_REQUIRED_FOR_SHORTLIST gates ops shortlisting; test orgs are verified unless a test says otherwise.
    verification_status = "verified"


class SiteFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Site

    organization = factory.SubFactory(OrganizationFactory)
    name = factory.Sequence(lambda n: f"Site {n}")
    district = factory.LazyFunction(district)
    lat = Decimal("27.715000")
    lng = Decimal("85.312000")
    geofence_radius_m = 200


class ShiftFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Shift

    organization = factory.SubFactory(OrganizationFactory)
    name = "Day"
    start_time = dt.time(9, 0)
    end_time = dt.time(18, 0)
    break_minutes = 60


class MembershipFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Membership

    user = factory.SubFactory(UserFactory)
    organization = factory.SubFactory(OrganizationFactory)
    role = "owner"

    @factory.post_generation
    def sites(self, create, extracted, **kwargs):
        if create and extracted:
            self.sites.set(extracted)


class WorkerFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Worker

    full_name = factory.Sequence(lambda n: f"Worker {n:04d}")
    phone = _phone
    gender = "male"
    current_district = factory.LazyFunction(district)
    verification_status = "verified"
    is_available = True


class WorkerSkillFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = WorkerSkill

    worker = factory.SubFactory(WorkerFactory)
    trade = factory.LazyFunction(trade)
    years_experience = 3
    nstb_level = "none"


class EmploymentFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Employment

    organization = factory.SubFactory(OrganizationFactory)
    worker = factory.SubFactory(WorkerFactory)
    site = None
    trade = factory.LazyFunction(trade)
    designation = "Cook"
    start_date = dt.date(2025, 1, 1)
    wage_type = "monthly"
    basic_salary = Decimal("12170.00")
    dearness_allowance = Decimal("7380.00")
    other_allowance = Decimal("0")
    daily_wage = None
    ssf_enrolled = False


class AttendanceFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Attendance

    employment = factory.SubFactory(EmploymentFactory)
    date = dt.date(2026, 7, 20)
    status = "present"
    method = "supervisor"


class LeaveFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = LeaveRequest

    employment = factory.SubFactory(EmploymentFactory)
    leave_type = "sick"
    from_date = dt.date(2026, 7, 20)
    to_date = dt.date(2026, 7, 20)
    days = Decimal("1")


class AdvanceFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Advance

    employment = factory.SubFactory(EmploymentFactory)
    amount = Decimal("5000.00")
    given_on = dt.date(2026, 7, 1)
    recover_per_month = Decimal("2000.00")


class HolidayFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Holiday

    organization = None
    date = dt.date(2026, 7, 22)
    name_en = "Test holiday"


class JobFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = JobOpening

    organization = factory.SubFactory(OrganizationFactory)
    trade = factory.LazyFunction(trade)
    title = "Cook"
    openings_count = 1
    wage_type = "monthly"
    wage_amount = Decimal("20000.00")
    status = "open"


class ApplicationFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Application

    job = factory.SubFactory(JobFactory)
    worker = factory.SubFactory(WorkerFactory)
    stage = "sourced"
