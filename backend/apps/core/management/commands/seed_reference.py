from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.core import reference_data as ref
from apps.core.bs import parse_bs


class Command(BaseCommand):
    help = "Seed provinces, 77 districts, trades, minimum wage, tax slabs and national holidays (idempotent)."

    @transaction.atomic
    def handle(self, *args, **options):
        from apps.geo.models import District, Province
        from apps.hiring.models import MinimumWage
        from apps.payroll.models import TaxSlab
        from apps.workers.models import Trade
        from apps.workforce.models import Holiday

        for code, en, ne in ref.PROVINCES:
            Province.objects.update_or_create(code=code, defaults={"name_en": en, "name_ne": ne})
        for code, en, ne, prov in ref.DISTRICTS:
            District.objects.update_or_create(
                code=code, defaults={"name_en": en, "name_ne": ne, "province_id": prov}
            )
        for code, en, ne, cat in ref.TRADES:
            Trade.objects.update_or_create(
                code=code, defaults={"name_en": en, "name_ne": ne, "category": cat}
            )
        for eff, basic, da, total, daily, hourly, part in ref.MINIMUM_WAGES:
            MinimumWage.objects.update_or_create(
                effective_from=eff,
                defaults={
                    "monthly_basic": Decimal(basic),
                    "monthly_da": Decimal(da),
                    "monthly_total": Decimal(total),
                    "daily": Decimal(daily),
                    "hourly": Decimal(hourly),
                    "hourly_part_time": Decimal(part),
                },
            )
        for fy, slabs in ref.TAX_SLABS.items():
            if not TaxSlab.objects.filter(fiscal_year=fy).exists():
                for lower, upper, rate in slabs:
                    TaxSlab.objects.create(
                        fiscal_year=fy,
                        lower=Decimal(lower),
                        upper=Decimal(upper) if upper else None,
                        rate=Decimal(rate),
                    )
        holidays = 0
        for bs, en, ne in ref.NATIONAL_HOLIDAYS_2083:
            _, created = Holiday.objects.get_or_create(
                organization=None, date=parse_bs(bs), name_en=en, defaults={"name_ne": ne}
            )
            holidays += int(created)
        self.stdout.write(
            self.style.SUCCESS(
                f"Reference data: {Province.objects.count()} provinces, "
                f"{District.objects.count()} districts, "
                f"{Trade.objects.count()} trades, {MinimumWage.objects.count()} minimum wage rows, "
                f"{TaxSlab.objects.count()} tax slabs, {Holiday.objects.filter(organization=None).count()} "
                f"national holidays ({holidays} new)."
            )
        )
