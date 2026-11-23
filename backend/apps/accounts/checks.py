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


@checks.register(checks.Tags.security, deploy=True)
def production_essentials(app_configs, **kwargs):
    """Settings that pass Django's own deploy check but break or weaken a real deployment."""
    if settings.DEBUG:
        return []
    errors = []
    if not settings.FIELD_ENCRYPTION_KEYS or not settings.FIELD_HASH_KEY:
        errors.append(
            checks.Error(
                "FIELD_ENCRYPTION_KEYS and FIELD_HASH_KEY must be set: citizenship, NID, PAN and bank "
                "numbers cannot be stored or looked up without them.",
                id="kaamsathi.E001",
            )
        )
    # A test site may run without SMS on purpose: it shows the code on screen (OTP_SHOW_CODE, W001).
    if settings.SMS_BACKEND == "console" and not getattr(settings, "OTP_SHOW_CODE", False):
        errors.append(
            checks.Error(
                "SMS_BACKEND is 'console': login codes only reach the server log, so nobody can sign in. "
                "Set it to sparrow or aakash.",
                id="kaamsathi.E002",
            )
        )
    if settings.SERVERLESS and not settings.CRON_SECRET:
        errors.append(
            checks.Error(
                "SERVERLESS is on but CRON_SECRET is empty: the scheduled jobs (reminders, expiries, "
                "billing) never run.",
                id="kaamsathi.E003",
            )
        )
    if not settings.BFF_PROXY_SECRET:
        errors.append(
            checks.Warning(
                "BFF_PROXY_SECRET is empty: every web user shares the web server's IP, so rate limits "
                "and the audit log can't tell users apart.",
                id="kaamsathi.W002",
            )
        )
    return errors
