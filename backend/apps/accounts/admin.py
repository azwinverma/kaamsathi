from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import PhoneOTP, User


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
