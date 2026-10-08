from django.contrib import admin

from .models import FraudFlag, VerificationReview


@admin.register(FraudFlag)
class FraudFlagAdmin(admin.ModelAdmin):
    list_display = ["kind", "subject_type", "subject_id", "severity", "status", "created_at"]
    list_filter = ["kind", "severity", "status", "subject_type"]
    search_fields = ["subject_id"]
    readonly_fields = ["created_at", "updated_at", "resolved_at"]


@admin.register(VerificationReview)
class VerificationReviewAdmin(admin.ModelAdmin):
    list_display = ["worker", "reviewer", "stage", "decision", "created_at"]
    list_filter = ["stage", "decision"]
    raw_id_fields = ["worker", "reviewer"]
