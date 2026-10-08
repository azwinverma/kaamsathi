from django.contrib import admin

from .models import WorkHistoryEntry


@admin.register(WorkHistoryEntry)
class WorkHistoryEntryAdmin(admin.ModelAdmin):
    list_display = ("worker", "employer_name", "role_title", "start_date", "end_date", "status")
    list_filter = ("status", "verification_method")
    search_fields = ("worker__full_name", "worker__phone", "employer_name", "role_title")
    raw_id_fields = ("worker", "employer_org", "verified_by")
    exclude = ("reference_phone",)
