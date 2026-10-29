"""System checks for account security settings (shown by `manage.py check --deploy`)."""

from django.conf import settings
from django.core import checks


@checks.register(checks.Tags.security, deploy=True)
def otp_show_code(app_configs, **kwargs):
    if getattr(settings, "OTP_SHOW_CODE", False) and not settings.DEBUG:
        return [
            checks.Warning(
                "OTP_SHOW_CODE is on: login codes are returned to the browser, so anyone can sign in "
                "as any phone number. Test sites only; turn it off before real users sign up.",
                id="kaamsathi.W001",
            )
        ]
    return []
