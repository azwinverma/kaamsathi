"""Seed the price list. Pilot = the phase-1 terms (Rs. 150/active worker, min Rs. 3,000, placement
Rs. 5,000) and is the default for orgs without a Subscription row. Other prices are starting
points for the commercial team — ops edits them at /ops/billing (PATCH /ops/billing/plans/{code})."""

from decimal import Decimal

from django.db import migrations

PLANS = [
    # code, name, base, per worker, min, placement, included, features
    ("pilot", "Pilot", "0", "150", "3000", "5000", 0, {"support": "whatsapp", "payroll": True}),
    ("starter", "Starter", "2500", "120", "2500", "5000", 10, {"support": "email", "payroll": True}),
    ("growth", "Growth", "7500", "100", "7500", "4500", 50, {"support": "phone", "payroll": True, "api": False}),
    ("business", "Business", "20000", "80", "20000", "4000", 200, {"support": "phone", "payroll": True, "api": True}),
    ("enterprise", "Enterprise", "50000", "60", "50000", "3500", 500, {"support": "dedicated", "payroll": True, "api": True, "sso": True}),
]


def seed(apps, schema_editor):
    Plan = apps.get_model("billing", "Plan")
    for code, name, base, per, minimum, placement, included, features in PLANS:
        Plan.objects.get_or_create(
            code=code,
            defaults={
                "name": name,
                "monthly_base": Decimal(base),
                "per_active_worker": Decimal(per),
                "min_monthly": Decimal(minimum),
                "placement_fee": Decimal(placement),
                "included_workers": included,
                "features": features,
            },
        )


class Migration(migrations.Migration):
    dependencies = [("billing", "0004_plans_invoices")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
