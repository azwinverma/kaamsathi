from django.contrib import admin

from .models import PayGroup, PayPolicy, PayrollRun, Payslip, TaxSlab


class PayslipInline(admin.TabularInline):
    model = Payslip
    extra = 0
    fields = [
        "worker",
        "payable_days",
        "gross_pay",
        "ssf_employee",
        "tds",
        "advance_recovery",
        "net_pay",
        "payment_status",
    ]
    readonly_fields = fields
    can_delete = False


@admin.register(PayrollRun)
class PayrollRunAdmin(admin.ModelAdmin):
    list_display = [
        "organization",
        "bs_year",
        "bs_month",
        "status",
        "period_start",
        "period_end",
        "approved_at",
        "paid_at",
    ]
    list_filter = ["status", "bs_year"]
    search_fields = ["organization__name"]
    inlines = [PayslipInline]


@admin.register(Payslip)
class PayslipAdmin(admin.ModelAdmin):
    list_display = ["worker", "run", "gross_pay", "tds", "net_pay", "payment_status"]
    list_filter = ["payment_status", "run__status"]
    search_fields = ["worker__full_name"]
    raw_id_fields = ["run", "employment", "worker"]


@admin.register(TaxSlab)
class TaxSlabAdmin(admin.ModelAdmin):
    list_display = ["fiscal_year", "lower", "upper", "rate", "applies_to"]
    list_filter = ["fiscal_year", "applies_to"]
    fieldsets = (
        (
            "⚠ Verify each fiscal year",
            {
                "description": "Income-tax slabs change with each annual budget (Finance Act). "
                "Verify these figures against the Inland Revenue Department at the start of every "
                "fiscal year (Shrawan 1) and add a new set of rows for the new fiscal year.",
                "fields": ("fiscal_year", "lower", "upper", "rate", "applies_to"),
            },
        ),
    )


@admin.register(PayPolicy)
class PayPolicyAdmin(admin.ModelAdmin):
    list_display = ["organization", "ot_multiplier", "festival_allowance_rule", "rounding", "weekly_off_paid"]
    raw_id_fields = ["organization", "updated_by"]


@admin.register(PayGroup)
class PayGroupAdmin(admin.ModelAdmin):
    list_display = ["name", "organization", "pay_day", "is_active", "created_at"]
    list_filter = ["is_active"]
    raw_id_fields = ["organization"]
