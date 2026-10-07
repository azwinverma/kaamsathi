import uuid

from django.db import models


class Partner(models.Model):
    """A licensed third party (bank, insurer, training provider, recruitment agency...).

    KaamSathi never lends or holds funds: partners carry the regulated activity and receive worker
    data only through a worker's ConsentGrant (docs/CONTRACT-ECOSYSTEM.md §8).
    """

    KINDS = [
        ("bank", "Bank"),
        ("microfinance", "Microfinance"),
        ("insurer", "Insurer"),
        ("wallet", "Wallet / payment provider"),
        ("training", "Training provider"),
        ("recruitment_agency", "Recruitment agency"),
        ("government", "Government"),
    ]
    REGULATORS = [
        ("nrb", "Nepal Rastra Bank"),
        ("beema_samiti", "Nepal Insurance Authority"),
        ("dofe", "Department of Foreign Employment"),
        ("ctevt", "CTEVT"),
        ("other", "Other"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    kind = models.CharField(max_length=30, choices=KINDS)
    license_no = models.CharField(max_length=100, blank=True)
    regulator = models.CharField(max_length=20, choices=REGULATORS, blank=True)
    contact_email = models.EmailField(blank=True)
    contact_phone = models.CharField(max_length=20, blank=True)
    webhook_url = models.URLField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name
