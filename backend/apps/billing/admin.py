from django.contrib import admin

from .models import Charge, CreditNote, Invoice, InvoiceLine, PaymentRecord, Plan, Subscription


@admin.register(Charge)
class ChargeAdmin(admin.ModelAdmin):
    list_display = [
        "organization",
        "payer_partner",
        "kind",
        "amount",
        "status",
        "bs_year",
        "bs_month",
        "created_at",
    ]
    list_filter = ["kind", "status"]
    search_fields = ["organization__name", "payer_partner__name", "description"]
    raw_id_fields = ["application", "replaces_employment"]
    actions = ["mark_paid", "mark_waived"]

    @admin.action(description="Mark selected charges as paid")
    def mark_paid(self, request, queryset):
        queryset.update(status="paid")

    @admin.action(description="Waive selected charges")
    def mark_waived(self, request, queryset):
        queryset.update(status="waived")


@admin.register(Plan)
class PlanAdmin(admin.ModelAdmin):
    list_display = [
        "code",
        "name",
        "monthly_base",
        "per_active_worker",
        "min_monthly",
        "placement_fee",
        "is_active",
    ]


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ["organization", "plan", "status", "started_on"]
    list_filter = ["plan", "status"]


class LineInline(admin.TabularInline):
    model = InvoiceLine
    extra = 0
    raw_id_fields = ["charge"]


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    """Read-mostly: issue / void / payments / credit notes go through /ops/billing (audited)."""

    list_display = ["number", "buyer_name", "status", "issue_date", "total"]
    list_filter = ["status", "fiscal_year"]
    search_fields = ["number", "buyer_name"]
    inlines = [LineInline]
    readonly_fields = [
        "number",
        "fiscal_year",
        "status",
        "subtotal",
        "vat_amount",
        "total",
        "issued_at",
        "paid_at",
    ]


admin.site.register(CreditNote)
admin.site.register(PaymentRecord)
