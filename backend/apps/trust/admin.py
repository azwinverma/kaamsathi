from django.contrib import admin

from .models import Dispute, ProfileView, WorkerTrust


@admin.register(WorkerTrust)
class WorkerTrustAdmin(admin.ModelAdmin):
    list_display = ["worker", "verification_level", "reliability_score", "computed_at"]
    list_filter = ["verification_level"]
    search_fields = ["worker__full_name", "worker__phone"]
    readonly_fields = ["worker", "verification_level", "reliability_score", "breakdown", "computed_at"]
    actions = ["recompute"]

    @admin.action(description="Recompute reliability score / level")
    def recompute(self, request, queryset):
        from .services import recompute_trust

        for trust in queryset.select_related("worker"):
            recompute_trust(trust.worker)


@admin.register(ProfileView)
class ProfileViewAdmin(admin.ModelAdmin):
    list_display = ["worker", "context", "organization", "partner", "viewer", "created_at"]
    list_filter = ["context"]
    search_fields = ["worker__full_name", "worker__phone", "organization__name"]
    raw_id_fields = ["worker", "organization", "partner", "viewer"]

    def has_change_permission(self, request, obj=None):
        return False  # an access log is append-only


@admin.register(Dispute)
class DisputeAdmin(admin.ModelAdmin):
    list_display = ["worker", "organization", "kind", "status", "raised_at", "resolved_at"]
    list_filter = ["status", "kind"]
    search_fields = ["worker__full_name", "worker__phone", "organization__name", "description"]
    raw_id_fields = ["worker", "organization", "employment", "payslip", "resolved_by"]
