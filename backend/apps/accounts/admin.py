from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import LegalAcceptance, LegalDocument, PhoneOTP, SessionDevice, StaffProfile, User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering = ["-date_joined"]
    list_display = [
        "phone",
        "full_name",
        "email",
        "preferred_language",
        "is_staff",
        "is_active",
        "date_joined",
    ]
    list_filter = ["is_staff", "is_active", "preferred_language"]
    search_fields = ["phone", "full_name", "email"]
    readonly_fields = ["date_joined", "last_login"]
    fieldsets = (
        (None, {"fields": ("phone", "password")}),
        ("Profile", {"fields": ("full_name", "email", "preferred_language")}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Dates", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (None, {"classes": ("wide",), "fields": ("phone", "full_name", "password1", "password2")}),
    )


@admin.register(PhoneOTP)
class PhoneOTPAdmin(admin.ModelAdmin):
    list_display = ["phone", "purpose", "created_at", "expires_at", "attempts", "consumed_at", "ip"]
    search_fields = ["phone"]
    list_filter = ["purpose"]
    readonly_fields = [
        "phone",
        "code_hash",
        "purpose",
        "expires_at",
        "attempts",
        "consumed_at",
        "ip",
        "created_at",
    ]


@admin.register(StaffProfile)
class StaffProfileAdmin(admin.ModelAdmin):
    list_display = ["user", "roles", "mfa_enabled", "mfa_enrolled_at", "updated_at"]
    search_fields = ["user__phone", "user__full_name"]
    exclude = ["mfa_secret", "recovery_codes", "mfa_last_step"]
    readonly_fields = ["mfa_enabled", "mfa_enrolled_at"]


@admin.register(SessionDevice)
class SessionDeviceAdmin(admin.ModelAdmin):
    list_display = ["user", "platform", "ip", "created_at", "last_seen_at", "revoked_at"]
    search_fields = ["user__phone"]
    readonly_fields = [
        "user",
        "jti",
        "user_agent",
        "ip",
        "platform",
        "created_at",
        "last_seen_at",
        "revoked_at",
    ]


@admin.register(LegalDocument)
class LegalDocumentAdmin(admin.ModelAdmin):
    list_display = ["kind", "version", "is_current", "published_at", "url"]
    list_filter = ["kind", "is_current"]


@admin.register(LegalAcceptance)
class LegalAcceptanceAdmin(admin.ModelAdmin):
    list_display = ["user", "document", "accepted_at", "channel", "ip"]
    search_fields = ["user__phone"]
    readonly_fields = ["user", "document", "accepted_at", "ip", "user_agent", "channel"]

    def has_change_permission(self, request, obj=None):
        return False
