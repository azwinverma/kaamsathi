import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.core import labels

from . import labels as plabels


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
    # Shared secret for signing outbound webhooks (X-KaamSathi-Signature). Ops can rotate it.
    webhook_secret = models.CharField(max_length=64, blank=True, default="")
    # Licence compliance (recruitment agencies: DoFE licence). Set only via
    # POST /ops/mobility/agencies/{id}/compliance (docs/CONTRACT-EXTENSIONS.md §5).
    COMPLIANCE_STATUSES = [("unverified", "Unverified"), ("verified", "Verified"), ("suspended", "Suspended")]
    license_valid_until = models.DateField(null=True, blank=True)
    compliance_status = models.CharField(max_length=12, choices=COMPLIANCE_STATUSES, default="unverified")
    compliance_verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    compliance_verified_at = models.DateTimeField(null=True, blank=True)
    compliance_note = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name

    def license_valid_on(self, on=None) -> bool:
        on = on or timezone.localdate()
        return self.license_valid_until is not None and self.license_valid_until >= on

    def is_eligible_agency(self, on=None) -> bool:
        """A recruitment agency may receive worker documents only when active, compliance-verified
        by ops and holding an unexpired licence."""
        return (
            self.is_active
            and self.kind == "recruitment_agency"
            and self.compliance_status == "verified"
            and self.license_valid_on(on)
        )


def new_webhook_secret() -> str:
    import secrets

    return "whsec_" + secrets.token_urlsafe(32)


class PartnerAPIKey(models.Model):
    """Partner API credential. Only a SHA-256 hash of the full key is stored; the key itself
    (``ks_<prefix>_<secret>``) is shown once at creation."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    partner = models.ForeignKey(Partner, on_delete=models.CASCADE, related_name="api_keys")
    name = models.CharField(max_length=100, blank=True, default="")
    prefix = models.CharField(max_length=8, unique=True)
    key_hash = models.CharField(max_length=64)
    scopes = models.JSONField(default=list)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Partner API key"

    def __str__(self):
        return f"{self.partner} · ks_{self.prefix}_…"

    @property
    def is_active(self) -> bool:
        return self.revoked_at is None


class ConsentGrantQuerySet(models.QuerySet):
    def active(self, at=None):
        at = at or timezone.now()
        return self.filter(revoked_at__isnull=True, expires_at__gt=at)


class ConsentGrant(models.Model):
    """A worker's explicit, purpose-bound, revocable permission for one partner to read data."""

    PURPOSES = labels.choices(plabels.PURPOSE)
    CHANNELS = [("app", "App"), ("sms", "SMS"), ("ops", "Ops")]
    STATUSES = labels.choices(plabels.GRANT_STATUS)

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    worker = models.ForeignKey("workers.Worker", on_delete=models.CASCADE, related_name="partner_grants")
    partner = models.ForeignKey(Partner, on_delete=models.CASCADE, related_name="grants")
    purpose = models.CharField(max_length=20, choices=PURPOSES)
    scopes = models.JSONField(default=list)
    granted_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)
    channel = models.CharField(max_length=10, choices=CHANNELS, default="app")
    # Denormalised for listing; access checks always use revoked_at/expires_at.
    status = models.CharField(max_length=10, choices=STATUSES, default="active")

    objects = ConsentGrantQuerySet.as_manager()

    class Meta:
        ordering = ["-granted_at"]
        indexes = [models.Index(fields=["worker", "partner", "expires_at"])]

    def __str__(self):
        return f"{self.worker} → {self.partner} ({self.purpose})"

    def is_active_at(self, at=None) -> bool:
        at = at or timezone.now()
        return self.revoked_at is None and self.expires_at > at

    @property
    def current_status(self) -> str:
        if self.revoked_at:
            return "revoked"
        if self.expires_at <= timezone.now():
            return "expired"
        return "active"


class PartnerAccessLog(models.Model):
    """One row per partner API request (granted or denied). Visible to the worker concerned."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    partner = models.ForeignKey(Partner, on_delete=models.CASCADE, related_name="access_logs")
    api_key = models.ForeignKey(
        PartnerAPIKey, on_delete=models.SET_NULL, null=True, blank=True, related_name="access_logs"
    )
    worker = models.ForeignKey(
        "workers.Worker", on_delete=models.CASCADE, null=True, blank=True, related_name="partner_access_logs"
    )
    endpoint = models.CharField(max_length=255)
    method = models.CharField(max_length=8, default="GET")
    scope = models.CharField(max_length=30, blank=True, default="")
    status_code = models.PositiveSmallIntegerField()
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.partner} {self.method} {self.endpoint} → {self.status_code}"
