from django.contrib import admin

from .models import PrivacyRequest


@admin.register(PrivacyRequest)
class PrivacyRequestAdmin(admin.ModelAdmin):
    """Read-mostly: process requests from the ops console (/ops/privacy) so the workflow runs."""

    list_display = ("created_at", "kind", "status", "worker", "user", "handled_by", "completed_at")
    list_filter = ("kind", "status")
    search_fields = ("worker__full_name", "worker__phone", "user__phone", "details")
    readonly_fields = (
        "id",
        "worker",
        "user",
        "kind",
        "details",
        "file",
        "file_expires_at",
        "created_at",
        "updated_at",
        "completed_at",
        "handled_by",
    )
    fields = (*readonly_fields[:5], "status", "response_note", *readonly_fields[5:])
    date_hierarchy = "created_at"

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
