import uuid

from django.db import models

from apps.core import labels


class Charge(models.Model):
    KINDS = labels.choices(labels.CHARGE_KIND)
    STATUSES = labels.choices(labels.CHARGE_STATUS)

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey("orgs.Organization", on_delete=models.CASCADE, related_name="charges")
    kind = models.CharField(max_length=15, choices=KINDS)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    description = models.CharField(max_length=255)
    bs_year = models.PositiveSmallIntegerField(null=True, blank=True)
    bs_month = models.PositiveSmallIntegerField(null=True, blank=True)
    application = models.ForeignKey(
        "hiring.Application", on_delete=models.SET_NULL, null=True, blank=True, related_name="charges"
    )
    replaces_employment = models.ForeignKey(
        "workforce.Employment",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="replacement_charges",
        help_text="Ended employment this placement replaced (fee waived).",
    )
    status = models.CharField(max_length=10, choices=STATUSES, default="unpaid")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.organization} {self.kind} Rs. {self.amount} [{self.status}]"
