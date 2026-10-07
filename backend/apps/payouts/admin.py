from django.contrib import admin

from .models import PayoutBatch, PayoutItem


class PayoutItemInline(admin.TabularInline):
    model = PayoutItem
    extra = 0
    fields = [
        "payslip",
        "amount",
        "method",
        "account_no",
        "wallet_id",
        "status",
        "provider_ref",
        "failure_reason",
    ]
    readonly_fields = ["payslip", "amount", "method", "account_no", "wallet_id"]
    can_delete = False


@admin.register(PayoutBatch)
class PayoutBatchAdmin(admin.ModelAdmin):
    list_display = ["run", "provider", "status", "created_at", "submitted_at", "completed_at"]
    list_filter = ["provider", "status"]
    search_fields = ["run__organization__name"]
    raw_id_fields = ["run", "created_by"]
    readonly_fields = ["totals"]
    inlines = [PayoutItemInline]
