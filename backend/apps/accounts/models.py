import uuid

from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.core.validators import RegexValidator
from django.db import models
from django.utils import timezone

from apps.core.crypto import EncryptedCharField

phone_validator = RegexValidator(r"^9[78]\d{8}$", "Enter a valid 10-digit Nepali mobile number.")


class UserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, phone, password=None, **extra):
        if not phone:
            raise ValueError("phone is required")
        user = self.model(phone=phone, **extra)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, phone, password=None, **extra):
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        return self.create_user(phone, password, **extra)


class User(AbstractBaseUser, PermissionsMixin):
    LANGUAGES = [("en", "English"), ("ne", "नेपाली")]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    phone = models.CharField(max_length=10, unique=True, validators=[phone_validator])
    full_name = models.CharField(max_length=150, blank=True)
    email = models.EmailField(blank=True, null=True)
    preferred_language = models.CharField(max_length=2, choices=LANGUAGES, default="en")
    is_staff = models.BooleanField(default=False, help_text="Ops staff: can use /ops and admin.")
    is_active = models.BooleanField(default=True)
    date_joined = models.DateTimeField(default=timezone.now)

    objects = UserManager()

    USERNAME_FIELD = "phone"
    REQUIRED_FIELDS = ["full_name"]

    class Meta:
        ordering = ["-date_joined"]

    def __str__(self):
        return f"{self.full_name or '—'} ({self.phone})"


class PhoneOTP(models.Model):
    PURPOSES = [("login", "Login")]

    phone = models.CharField(max_length=10, db_index=True)
    code_hash = models.CharField(max_length=128)
    purpose = models.CharField(max_length=20, choices=PURPOSES, default="login")
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    consumed_at = models.DateTimeField(null=True, blank=True)
    ip = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Phone OTP"

    def __str__(self):
        return f"OTP {self.phone} @ {self.created_at:%Y-%m-%d %H:%M}"

    @property
    def is_expired(self):
        return timezone.now() >= self.expires_at


def _empty_list():
    return []


class StaffProfile(models.Model):
    """Ops staff roles + TOTP MFA (docs/CONTRACT-EXTENSIONS.md §1)."""

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="staff_profile")
    roles = models.JSONField(default=_empty_list, blank=True)
    mfa_secret = EncryptedCharField(max_length=64, blank=True, null=True)
    mfa_enabled = models.BooleanField(default=False)
    mfa_enrolled_at = models.DateTimeField(null=True, blank=True)
    # Last accepted TOTP time step — a code can't be replayed within its validity window.
    mfa_last_step = models.BigIntegerField(null=True, blank=True)
    recovery_codes = models.JSONField(default=_empty_list, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Staff {self.user.phone}: {', '.join(self.roles or []) or '—'}"


class SessionDevice(models.Model):
    """A login session (one refresh-token family) — listed and revocable by the user."""

    PLATFORMS = [("web", "Web"), ("android", "Android"), ("ios", "iOS"), ("other", "Other")]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="session_devices")
    jti = models.CharField(max_length=64, db_index=True)
    user_agent = models.CharField(max_length=300, blank=True, default="")
    ip = models.GenericIPAddressField(null=True, blank=True)
    platform = models.CharField(max_length=10, choices=PLATFORMS, default="other")
    created_at = models.DateTimeField(auto_now_add=True)
    last_seen_at = models.DateTimeField(default=timezone.now)
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-last_seen_at"]

    def __str__(self):
        return f"{self.user.phone} {self.platform} {self.created_at:%Y-%m-%d}"


class LegalDocument(models.Model):
    """A published version of a policy/agreement (docs/MASTER_PRODUCT_SPEC.md PRIV-02)."""

    KINDS = [
        ("terms", "Terms of use"),
        ("privacy", "Privacy policy"),
        ("worker_agreement", "Worker agreement"),
        ("employer_agreement", "Employer agreement"),
        ("marketing", "Marketing consent"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    kind = models.CharField(max_length=20, choices=KINDS)
    version = models.CharField(max_length=20)
    published_at = models.DateTimeField(default=timezone.now)
    url = models.CharField(max_length=300)
    summary_en = models.TextField(blank=True, default="")
    summary_ne = models.TextField(blank=True, default="")
    is_current = models.BooleanField(default=False)

    class Meta:
        ordering = ["kind", "-published_at"]
        constraints = [
            models.UniqueConstraint(fields=["kind", "version"], name="accounts_legal_kind_version"),
            models.UniqueConstraint(
                fields=["kind"], condition=models.Q(is_current=True), name="accounts_legal_one_current"
            ),
        ]

    def __str__(self):
        return f"{self.kind} v{self.version}{' (current)' if self.is_current else ''}"


class LegalAcceptance(models.Model):
    CHANNELS = [("web", "Web"), ("app", "Mobile app"), ("ops", "Ops-assisted"), ("other", "Other")]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="legal_acceptances")
    document = models.ForeignKey(LegalDocument, on_delete=models.PROTECT, related_name="acceptances")
    accepted_at = models.DateTimeField(default=timezone.now)
    ip = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=300, blank=True, default="")
    channel = models.CharField(max_length=10, choices=CHANNELS, default="other")

    class Meta:
        ordering = ["-accepted_at"]
        constraints = [
            models.UniqueConstraint(fields=["user", "document"], name="accounts_legal_accept_once")
        ]

    def __str__(self):
        return f"{self.user_id} accepted {self.document}"
