"""Compliance: employment contracts, SSF filings, contractors (docs/CONTRACT-ECOSYSTEM.md §5)."""

import uuid

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _

CONTRACT_LANGUAGES = [("en", "English"), ("ne", "Nepali"), ("both", "English + Nepali")]
ACCEPT_CHANNELS = [("app", "App"), ("sms", "SMS"), ("paper", "Paper")]

SSF_FILING_STATUS = {
    "prepared": _("Prepared"),
    "submitted": _("Submitted"),
    "acknowledged": _("Acknowledged"),
}


class EmploymentContract(models.Model):
    """One version of the appointment letter (नियुक्ति पत्र) for an employment.

    ⚠ The letter is a TEMPLATE based on Labour Act 2074 essentials — review with a labour lawyer.
    A new version is generated when wage, designation or site changes.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employment = models.ForeignKey("workforce.Employment", on_delete=models.CASCADE, related_name="contracts")
    version = models.PositiveIntegerField()
    generated_at = models.DateTimeField(auto_now_add=True)
    generated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    language = models.CharField(max_length=4, choices=CONTRACT_LANGUAGES, default="both")
    terms = models.JSONField(default=dict, help_text="Snapshot of the terms the letter was generated from.")
    accepted_at = models.DateTimeField(null=True, blank=True)
    accepted_channel = models.CharField(max_length=10, choices=ACCEPT_CHANNELS, null=True, blank=True)
    file = models.FileField(upload_to="contracts/", null=True, blank=True)

    class Meta:
        ordering = ["employment", "-version"]
        verbose_name = "Employment contract (template — review with a labour lawyer)"
        verbose_name_plural = "Employment contracts (template — review with a labour lawyer)"
        constraints = [
            models.UniqueConstraint(fields=["employment", "version"], name="uniq_contract_version")
        ]

    def __str__(self):
        return f"Contract v{self.version} — {self.employment}"


class SSFFiling(models.Model):
    STATUSES = [(k, v) for k, v in SSF_FILING_STATUS.items()]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    run = models.OneToOneField("payroll.PayrollRun", on_delete=models.CASCADE, related_name="ssf_filing")
    status = models.CharField(max_length=14, choices=STATUSES, default="prepared")
    due_date = models.DateField()
    prepared_at = models.DateTimeField()
    prepared_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    submitted_on = models.DateField(null=True, blank=True)
    receipt_no = models.CharField(max_length=60, blank=True, null=True)
    file = models.FileField(upload_to="ssf-filings/", null=True, blank=True)
    summary = models.JSONField(default=dict, help_text="rows, missing, employee_11, employer_20, total_31")
    note = models.TextField(blank=True, null=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-due_date"]
        verbose_name = "SSF filing"

    def __str__(self):
        return f"SSF {self.run} [{self.status}]"


class Contractor(models.Model):
    """Labour contractor (thekedar) supplying workers to an organization."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        "orgs.Organization", on_delete=models.CASCADE, related_name="contractors"
    )
    name = models.CharField(max_length=150)
    pan_no = models.CharField(max_length=20, blank=True, null=True)
    phone = models.CharField(max_length=20)
    lead_worker = models.ForeignKey(
        "workers.Worker", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    trades = models.ManyToManyField("workers.Trade", blank=True, related_name="+")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "Contractor (thekedar)"

    def __str__(self):
        return f"{self.name} — {self.organization}"


class ContractorAssignment(models.Model):
    employment = models.OneToOneField(
        "workforce.Employment", on_delete=models.CASCADE, related_name="contractor_assignment"
    )
    contractor = models.ForeignKey(Contractor, on_delete=models.CASCADE, related_name="assignments")
    assigned_on = models.DateField()

    class Meta:
        ordering = ["-assigned_on"]

    def __str__(self):
        return f"{self.employment} via {self.contractor.name}"
