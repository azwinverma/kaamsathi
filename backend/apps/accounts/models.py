import uuid

from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.core.validators import RegexValidator
from django.db import models
from django.utils import timezone

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
