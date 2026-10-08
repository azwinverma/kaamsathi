"""Security (SEC-07 / QA-04): IDOR sweep over every /org/* detail route.

The route list is generated from the URL resolver. Organisation B gets one of everything we can
build; for each detail route we find a row of the route's model that belongs to B and request it
as the owner of organisation A (X-Org-Id = A). Every such request must be 404 (or 403), for GET,
PATCH and DELETE. Required routes must be covered; new routes are picked up automatically and
fail the coverage assertion only if they're in REQUIRED.
"""

from __future__ import annotations

import datetime as dt
import re
import uuid
from decimal import Decimal

import pytest
from django.core.exceptions import FieldError
from django.urls import get_resolver

from tests import factories as f
from tests.conftest import auth_client

pytestmark = pytest.mark.django_db

REQUIRED = {
    "employments",
    "applications",
    "jobs",
    "payslips",
    "leaves",
    "advances",
    "disputes",
    "payroll-runs",
    "members",
    "sites",
    "shifts",
    "holidays",
}
OPTIONAL_IF_PRESENT = {"timesheets", "contractors", "support-cases", "webhooks", "ssf-filings", "payouts"}
ORG_PATHS = (
    "organization",
    "employment__organization",
    "job__organization",
    "run__organization",
    "payroll_run__organization",
    "batch__organization",
    "endpoint__organization",
)


def org_detail_routes() -> dict[str, object]:
    """``{"employments": view_callback, ...}`` for /org/<name>/<pk> routes."""
    out = {}

    def walk(resolver, prefix=""):
        for p in resolver.url_patterns:
            if hasattr(p, "url_patterns"):
                walk(p, prefix + str(p.pattern))
                continue
            m = re.fullmatch(r"api/v1/\^org/([a-z\-]+)/\(\?P<pk>[^)]*\)/\?\$", prefix + str(p.pattern))
            if m:
                out[m.group(1)] = p.callback

    walk(get_resolver())
    return out


# Views whose serializer isn't a ModelSerializer of the routed model.
MODEL_OVERRIDES = {"timesheets": "timesheets.Timesheet"}


def model_for(callback, name=""):
    if name in MODEL_OVERRIDES:
        from django.apps import apps

        return apps.get_model(MODEL_OVERRIDES[name])
    cls = getattr(callback, "cls", None)
    qs = getattr(cls, "queryset", None)
    if qs is not None:
        return qs.model
    ser = getattr(cls, "serializer_class", None)
    meta = getattr(ser, "Meta", None)
    return getattr(meta, "model", None)


def rows_of(model, org):
    for path in ORG_PATHS:
        try:
            qs = model.objects.filter(**{path: org})
            return list(qs[:1])
        except FieldError:
            continue
    return []


def build_org_b():
    """One of everything for organisation B (best effort for optional apps)."""
    org = f.OrganizationFactory()
    owner = f.MembershipFactory(organization=org, role="owner").user
    client = auth_client(owner, org)
    f.MembershipFactory(organization=org, role="hr")
    site = f.SiteFactory(organization=org)
    f.ShiftFactory(organization=org)
    f.HolidayFactory(organization=org)
    emp = f.EmploymentFactory(organization=org, site=site)
    f.LeaveFactory(employment=emp)
    f.AdvanceFactory(employment=emp)
    job = f.JobFactory(organization=org)
    f.ApplicationFactory(job=job)
    for i in range(20):
        day = dt.date(2026, 7, 17) + dt.timedelta(days=i)
        f.AttendanceFactory(employment=emp, date=day)
    client.post("/api/v1/org/payroll-runs", {"bs_year": 2083, "bs_month": 4}, format="json")
    from apps.trust.models import Dispute

    Dispute.objects.create(worker=emp.worker, organization=org, employment=emp, kind="wage", description="x")
    try:
        from apps.compliance.models import Contractor

        Contractor.objects.create(organization=org, name="Contractor B", phone="9800000001")
    except Exception:  # noqa: BLE001
        pass
    try:
        from apps.timesheets import services as ts

        ts.generate(org, dt.date(2026, 7, 19))
    except Exception:  # noqa: BLE001
        pass
    for url, body in (
        ("/api/v1/org/support-cases", {"category": "other", "subject": "B", "description": "case"}),
        ("/api/v1/org/webhooks", {"url": "https://example.com/hook", "events": ["employment.started"]}),
    ):
        try:
            client.post(url, body, format="json")
        except Exception:  # noqa: BLE001
            pass
    return org


def test_org_detail_routes_reject_other_orgs_objects():
    routes = org_detail_routes()
    assert REQUIRED <= set(routes), f"missing routes: {REQUIRED - set(routes)}"
    org_b = build_org_b()
    org_a = f.OrganizationFactory()
    attacker = auth_client(f.MembershipFactory(organization=org_a, role="owner").user, org_a)

    covered, leaks = set(), []
    for name, callback in sorted(routes.items()):
        model = model_for(callback, name)
        rows = rows_of(model, org_b) if model is not None else []
        if not rows:
            # still must not error out on a foreign/unknown id
            res = attacker.get(f"/api/v1/org/{name}/{uuid.uuid4()}")
            assert res.status_code in (403, 404), (name, res.status_code)
            continue
        covered.add(name)
        url = f"/api/v1/org/{name}/{rows[0].pk}"
        for method, kwargs in (
            ("get", {}),
            ("patch", {"data": {"note": "x"}, "format": "json"}),
            ("delete", {}),
        ):
            res = getattr(attacker, method)(url, **kwargs)
            if res.status_code not in (403, 404, 405):
                leaks.append((method.upper(), url, res.status_code))
        # the object is untouched
        assert model.objects.filter(pk=rows[0].pk).exists(), f"{name} object deleted cross-org"

    print("IDOR covered:", sorted(covered))
    assert not leaks, f"cross-org access: {leaks}"
    must = REQUIRED | (OPTIONAL_IF_PRESENT & set(routes) & {"timesheets", "contractors"})
    assert must <= covered, f"IDOR sweep could not build objects for: {sorted(must - covered)}"


def test_x_org_id_of_foreign_org_is_rejected():
    org_b = f.OrganizationFactory()
    org_a = f.OrganizationFactory()
    user = f.MembershipFactory(organization=org_a, role="owner").user
    client = auth_client(user, org_b)  # claims membership of B
    for path in (
        "/api/v1/org",
        "/api/v1/org/employments",
        "/api/v1/org/payroll-runs",
        "/api/v1/org/dashboard",
    ):
        res = client.get(path)
        assert res.status_code == 403 and res.json()["error"]["code"] == "org_forbidden", path


def test_worker_cannot_read_another_workers_payslip():
    from apps.payroll.models import Payslip

    org = f.OrganizationFactory()
    owner = f.MembershipFactory(organization=org, role="owner").user
    emp = f.EmploymentFactory(
        organization=org, basic_salary=Decimal("12170"), dearness_allowance=Decimal("7380")
    )
    for i in range(20):
        f.AttendanceFactory(employment=emp, date=dt.date(2026, 7, 17) + dt.timedelta(days=i))
    auth_client(owner, org).post("/api/v1/org/payroll-runs", {"bs_year": 2083, "bs_month": 4}, format="json")
    slip = Payslip.objects.filter(employment=emp).first()
    if slip is None:
        pytest.skip("payroll engine produced no payslip for this fixture")
    stranger = f.UserFactory()
    f.WorkerFactory(user=stranger, phone=stranger.phone)
    res = auth_client(stranger).get(f"/api/v1/me/payslips/{slip.id}")
    assert res.status_code == 404
