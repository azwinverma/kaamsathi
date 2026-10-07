from django.contrib import admin
from django.utils import timezone

from .models import Consent, Rating, Trade, Worker, WorkerSkill


@admin.register(Trade)
class TradeAdmin(admin.ModelAdmin):
    list_display = ["code", "name_en", "name_ne", "category"]
    list_filter = ["category"]
    search_fields = ["code", "name_en", "name_ne"]


class SkillInline(admin.TabularInline):
    model = WorkerSkill
    extra = 0


@admin.register(Worker)
class WorkerAdmin(admin.ModelAdmin):
    list_display = [
        "full_name",
        "phone",
        "verification_status",
        "current_district",
        "is_available",
        "created_at",
    ]
    list_filter = [
        "verification_status",
        "is_available",
        "gender",
        "payment_method",
        "current_district__province",
    ]
    search_fields = ["full_name", "full_name_ne", "phone", "citizenship_no", "nid_no"]
    autocomplete_fields = ["user", "naike"]
    readonly_fields = ["created_at", "updated_at", "verified_at", "verified_by"]
    inlines = [SkillInline]
    actions = ["mark_verified"]

    @admin.action(description="Mark selected workers as verified")
    def mark_verified(self, request, queryset):
        queryset.update(verification_status="verified", verified_by=request.user, verified_at=timezone.now())


@admin.register(Consent)
class ConsentAdmin(admin.ModelAdmin):
    list_display = ["worker", "organization", "scope", "granted", "channel", "created_at"]
    list_filter = ["scope", "granted", "channel"]
    search_fields = ["worker__full_name", "worker__phone"]


@admin.register(Rating)
class RatingAdmin(admin.ModelAdmin):
    list_display = ["employment", "rater", "score_a", "score_b", "created_at"]
    list_filter = ["rater"]
