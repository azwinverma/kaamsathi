from django.contrib import admin

from .models import CaseMessage, SupportCase


class CaseMessageInline(admin.TabularInline):
    model = CaseMessage
    extra = 0
    readonly_fields = ["author", "created_at"]


@admin.register(SupportCase)
class SupportCaseAdmin(admin.ModelAdmin):
    list_display = ["number", "subject", "category", "priority", "status", "sla_due_at", "escalated"]
    list_filter = ["status", "priority", "category", "channel", "escalated"]
    search_fields = ["number", "subject"]
    readonly_fields = ["seq", "number", "created_at", "updated_at"]
    inlines = [CaseMessageInline]
