"""Demo staff roles (called by ``seed_demo`` as ``seed(stdout, rng)``; idempotent).

The ops demo user 9800000003 gets every staff role. MFA stays off so the dev OTP login works;
production requires TOTP enrolment (``STAFF_MFA_REQUIRED``).
"""

from __future__ import annotations

OPS_PHONE = "9800000003"


def seed(stdout=None, rng=None) -> None:
    from .models import StaffProfile, User
    from .staff_roles import STAFF_ROLES

    user = User.objects.filter(phone=OPS_PHONE).first()
    if user is None:
        if stdout is not None:
            stdout.write(f"  accounts: {OPS_PHONE} not found; staff roles skipped")
        return
    if not user.is_staff:
        user.is_staff = True
        user.save(update_fields=["is_staff"])
    profile, _ = StaffProfile.objects.get_or_create(user=user)
    profile.roles = list(STAFF_ROLES)
    profile.save(update_fields=["roles", "updated_at"])
    if stdout is not None:
        stdout.write(f"  accounts: {OPS_PHONE} staff roles = {', '.join(STAFF_ROLES)} (MFA off in dev)")
