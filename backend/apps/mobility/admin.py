from django.contrib import admin

from .models import ClearanceDocument, TravelDocument


@admin.register(TravelDocument)
class TravelDocumentAdmin(admin.ModelAdmin):
    list_display = ("worker", "kind", "status", "expires_on", "created_at")
    list_filter = ("kind", "status")
    search_fields = ("worker__full_name", "worker__phone")
    raw_id_fields = ("worker", "verified_by")
    exclude = ("number",)  # encrypted; never shown in admin lists/forms
    readonly_fields = ("number_hash",)


@admin.register(ClearanceDocument)
class ClearanceDocumentAdmin(admin.ModelAdmin):
    list_display = ("worker", "kind", "title", "status", "expires_on", "created_at")
    list_filter = ("kind", "status")
    search_fields = ("worker__full_name", "worker__phone", "title", "issuer")
    raw_id_fields = ("worker", "verified_by")
    exclude = ("reference_no",)
    readonly_fields = ("reference_no_hash",)
