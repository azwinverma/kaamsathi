"""Shift roster (docs/CONTRACT-ECOSYSTEM.md §7)."""

import uuid

from django.conf import settings
from django.db import models


class RosterEntry(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employment = models.ForeignKey(
        "workforce.Employment", on_delete=models.CASCADE, related_name="roster_entries"
    )
    date = models.DateField(db_index=True)
    shift = models.ForeignKey(
        "orgs.Shift", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    site = models.ForeignKey("orgs.Site", on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    is_off = models.BooleanField(default=False)
    note = models.CharField(max_length=255, blank=True, null=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["date"]
        verbose_name_plural = "roster entries"
        constraints = [models.UniqueConstraint(fields=["employment", "date"], name="uniq_roster_day")]

    def __str__(self):
        what = "OFF" if self.is_off else (self.shift.name if self.shift_id else "—")
        return f"{self.employment.worker.full_name} {self.date} {what}"
