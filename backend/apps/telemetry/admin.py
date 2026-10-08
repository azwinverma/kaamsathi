from django.contrib import admin

from .models import Event


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ["name", "platform", "subject", "organization", "occurred_at"]
    list_filter = ["name", "platform"]
    date_hierarchy = "occurred_at"
    readonly_fields = [f.name for f in Event._meta.fields]

    def has_add_permission(self, request):
        return False
