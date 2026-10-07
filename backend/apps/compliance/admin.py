from django.contrib import admin

from .models import Contractor, ContractorAssignment, EmploymentContract, SSFFiling


@admin.register(EmploymentContract)
class EmploymentContractAdmin(admin.ModelAdmin):
    """⚠ The appointment letter is a TEMPLATE — review with a labour lawyer before relying on it."""

    list_display = ["employment", "version", "language", "generated_at", "accepted_at", "accepted_channel"]
    list_filter = ["language", "accepted_channel"]
    search_fields = ["employment__worker__full_name", "employment__organization__name"]
    raw_id_fields = ["employment", "generated_by"]
    readonly_fields = ["generated_at", "terms"]


@admin.register(SSFFiling)
class SSFFilingAdmin(admin.ModelAdmin):
    list_display = ["run", "status", "due_date", "submitted_on", "receipt_no", "prepared_at"]
    list_filter = ["status"]
    search_fields = ["run__organization__name", "receipt_no"]
    raw_id_fields = ["run", "prepared_by"]
    readonly_fields = ["summary", "prepared_at", "updated_at"]


class AssignmentInline(admin.TabularInline):
    model = ContractorAssignment
    extra = 0
    raw_id_fields = ["employment"]


@admin.register(Contractor)
class ContractorAdmin(admin.ModelAdmin):
    list_display = ["name", "organization", "phone", "pan_no", "is_active", "created_at"]
    list_filter = ["is_active"]
    search_fields = ["name", "phone", "organization__name"]
    raw_id_fields = ["organization", "lead_worker"]
    filter_horizontal = ["trades"]
    inlines = [AssignmentInline]
