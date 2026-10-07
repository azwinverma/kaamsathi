from django.contrib import admin

from .models import Crew, Referral


@admin.register(Crew)
class CrewAdmin(admin.ModelAdmin):
    list_display = ["name", "lead", "is_active", "created_at"]
    list_filter = ["is_active"]
    search_fields = ["name", "lead__full_name", "lead__phone"]
    raw_id_fields = ["lead"]


@admin.register(Referral)
class ReferralAdmin(admin.ModelAdmin):
    list_display = ["worker", "crew", "amount", "status", "created_at", "eligible_at", "paid_at"]
    list_filter = ["status"]
    search_fields = ["worker__full_name", "crew__name", "payout_ref"]
    raw_id_fields = ["crew", "worker", "application", "employment"]
