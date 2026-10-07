import uuid

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from apps.core import labels


class Organization(models.Model):
    INDUSTRIES = labels.choices(labels.INDUSTRY)
    PLANS = [("pilot", "Pilot"), ("standard", "Standard")]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    name_ne = models.CharField(max_length=200, blank=True, null=True)
    pan_no = models.CharField(max_length=20, blank=True, null=True)
    vat_registered = models.BooleanField(default=False)
    ssf_employer_no = models.CharField(max_length=40, blank=True, null=True)
    industry = models.CharField(max_length=20, choices=INDUSTRIES, default="other")
    district = models.ForeignKey("geo.District", on_delete=models.PROTECT, related_name="+")
    municipality = models.CharField(max_length=120, blank=True, default="")
    ward = models.PositiveSmallIntegerField(null=True, blank=True)
    address = models.CharField(max_length=255, blank=True, default="")
    phone = models.CharField(max_length=20, blank=True, default="")
    email = models.EmailField(blank=True, null=True)
    logo = models.ImageField(upload_to="org-logos/", blank=True, null=True)
    plan = models.CharField(max_length=10, choices=PLANS, default="pilot")
    weekly_off_day = models.PositiveSmallIntegerField(
        default=6,
        validators=[MinValueValidator(0), MaxValueValidator(6)],
        help_text="0=Sunday … 6=Saturday",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Site(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="sites")
    name = models.CharField(max_length=150)
    address = models.CharField(max_length=255, blank=True, default="")
    district = models.ForeignKey(
        "geo.District", on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    geofence_radius_m = models.PositiveIntegerField(default=200)
    qr_token = models.UUIDField(default=uuid.uuid4, unique=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} — {self.organization}"


class Membership(models.Model):
    ROLES = labels.choices(labels.ROLE)

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="memberships")
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="memberships")
    role = models.CharField(max_length=12, choices=ROLES)
    sites = models.ManyToManyField(Site, blank=True, related_name="memberships")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
        constraints = [models.UniqueConstraint(fields=["user", "organization"], name="uniq_membership")]

    def __str__(self):
        return f"{self.user} · {self.role} @ {self.organization}"


class Shift(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="shifts")
    name = models.CharField(max_length=80)
    start_time = models.TimeField()
    end_time = models.TimeField()
    break_minutes = models.PositiveSmallIntegerField(default=60)

    class Meta:
        ordering = ["start_time", "name"]

    def __str__(self):
        return f"{self.name} ({self.start_time:%H:%M}–{self.end_time:%H:%M})"

    @property
    def working_minutes(self) -> int:
        start = self.start_time.hour * 60 + self.start_time.minute
        end = self.end_time.hour * 60 + self.end_time.minute
        if end <= start:
            end += 24 * 60
        return max(end - start - self.break_minutes, 0)
