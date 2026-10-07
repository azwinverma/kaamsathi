from django.contrib import admin

from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ["created_at", "action", "object_type", "object_id", "actor", "organization", "ip"]
    list_filter = ["action", "object_type"]
    search_fields = ["object_id", "actor__phone", "organization__name"]
    readonly_fields = [f.name for f in AuditLog._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
