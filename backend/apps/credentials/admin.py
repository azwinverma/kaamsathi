from django.contrib import admin

from .models import Credential, Passport, PassportShare, SkillAssessment


@admin.register(Credential)
class CredentialAdmin(admin.ModelAdmin):
    list_display = [
        "title",
        "worker",
        "kind",
        "issuer",
        "status",
        "verification_method",
        "expires_on",
        "created_at",
    ]
    list_filter = ["status", "kind", "verification_method"]
    search_fields = ["title", "issuer", "certificate_no", "worker__full_name", "worker__phone"]
    autocomplete_fields = ["worker"]
    readonly_fields = ["verified_by", "verified_at", "created_at"]
    date_hierarchy = "created_at"


@admin.register(SkillAssessment)
class SkillAssessmentAdmin(admin.ModelAdmin):
    list_display = ["worker", "trade", "result", "score", "level", "assessed_on", "assessor_partner"]
    list_filter = ["result", "trade"]
    search_fields = ["worker__full_name", "worker__phone"]
    autocomplete_fields = ["worker"]


@admin.register(Passport)
class PassportAdmin(admin.ModelAdmin):
    list_display = ["worker", "public_code", "is_public", "show_contact", "updated_at"]
    list_filter = ["is_public", "show_contact"]
    search_fields = ["public_code", "worker__full_name", "worker__phone"]
    autocomplete_fields = ["worker"]


@admin.register(PassportShare)
class PassportShareAdmin(admin.ModelAdmin):
    list_display = ["worker", "audience_label", "purpose", "expires_at", "views", "revoked_at", "created_at"]
    list_filter = ["purpose"]
    search_fields = ["audience_label", "worker__full_name", "worker__phone"]
    autocomplete_fields = ["worker"]
    readonly_fields = ["token", "views", "created_at"]
