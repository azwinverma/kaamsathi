from django.contrib import admin

from .models import FinancialProfile, Offer, Referral


@admin.register(FinancialProfile)
class FinancialProfileAdmin(admin.ModelAdmin):
    list_display = (
        "worker",
        "verified_months",
        "avg_monthly_net",
        "income_stability",
        "employers_count",
        "computed_at",
    )
    search_fields = ("worker__full_name", "worker__phone")
    raw_id_fields = ("worker",)
    readonly_fields = [f.name for f in FinancialProfile._meta.fields]


@admin.register(Offer)
class OfferAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "partner",
        "kind",
        "min_verified_months",
        "min_avg_net",
        "max_amount",
        "is_active",
    )
    list_filter = ("kind", "partner", "is_active")
    search_fields = ("title", "partner__name")


@admin.register(Referral)
class ReferralAdmin(admin.ModelAdmin):
    list_display = (
        "worker",
        "offer",
        "partner",
        "status",
        "amount_requested",
        "amount_approved",
        "created_at",
    )
    list_filter = ("status", "partner")
    search_fields = ("worker__full_name", "partner_ref")
    raw_id_fields = ("worker", "grant")
    # Status is the partner's decision (partner API); keep it read-only here.
    readonly_fields = (
        "status",
        "amount_approved",
        "partner_ref",
        "partner_note",
        "history",
        "created_at",
        "updated_at",
    )
