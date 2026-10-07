from django.contrib import admin

from .models import Charge


@admin.register(Charge)
class ChargeAdmin(admin.ModelAdmin):
    list_display = ["organization", "kind", "amount", "status", "bs_year", "bs_month", "created_at"]
    list_filter = ["kind", "status"]
    search_fields = ["organization__name", "description"]
    raw_id_fields = ["application", "replaces_employment"]
    actions = ["mark_paid", "mark_waived"]

    @admin.action(description="Mark selected charges as paid")
    def mark_paid(self, request, queryset):
        queryset.update(status="paid")

    @admin.action(description="Waive selected charges")
    def mark_waived(self, request, queryset):
        queryset.update(status="waived")
