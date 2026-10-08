"""Notifications: Celery enqueue helper, SMS, in-app inbox and push (docs/CONTRACT-EXTENSIONS.md §4)."""

import logging

from django.conf import settings
from django.db import transaction
from django.utils import timezone

logger = logging.getLogger("kaamsathi.notifications")


def enqueue(task, *args, eta=None, **kwargs):
    # Eager mode (dev/tests) can't defer, so a future reminder would go out immediately.
    if eta is not None and settings.CELERY_TASK_ALWAYS_EAGER and eta > timezone.now():
        logger.info("Eager Celery: skipping %s scheduled for %s", task.name, eta)
        return

    def _send():
        try:
            if eta is not None:
                task.apply_async(args=args, kwargs=kwargs, eta=eta)
            else:
                task.apply_async(args=args, kwargs=kwargs)
        except Exception as exc:  # broker unavailable → run inline (dev convenience)
            logger.warning("Celery unavailable (%s); running %s inline", exc, task.name)
            if eta is None:
                try:
                    task.apply(args=args, kwargs=kwargs)
                except Exception:  # noqa: BLE001
                    logger.exception("Inline task %s failed", task.name)

    transaction.on_commit(_send)


# --------------------------------------------------------------------------- SMS → inbox mirror
# Existing SMS events also land in the recipient's inbox (when the phone belongs to a user).
# kind -> (title_en, title_ne, link)
INBOX_KINDS = {
    "payslip_ready": ("Salary paid", "तलब भुक्तानी भयो", None),
    "shortlist": ("New candidates shortlisted", "नयाँ उम्मेदवार छनोट भए", "/app/candidates"),
    "interview_reminder": ("Interview reminder", "अन्तर्वार्ताको सम्झना", None),
    "dispute_raised": ("A worker raised a dispute", "कामदारले उजुरी दर्ता गर्नुभयो", "/app/disputes"),
    "dispute_resolved": ("Your dispute was updated", "तपाईंको उजुरी अद्यावधिक भयो", None),
    "dispute_update": ("Dispute updated", "उजुरी अद्यावधिक भयो", None),
    "credential_expiry": ("Certificate expiring soon", "प्रमाणपत्रको म्याद सकिँदै", None),
}


def mirror_to_inbox(phone: str, body: str, kind: str):
    """Create an inbox row for an SMS event if the phone belongs to a user. Never raises."""
    spec = INBOX_KINDS.get(kind)
    if spec is None:
        return None
    try:
        from apps.accounts.models import User

        from .models import Notification

        user = User.objects.filter(phone=phone, is_active=True).first()
        if user is None:
            return None
        title, title_ne, link = spec
        for lang in ("en", "ne"):
            tpl = active_template(kind, "inapp", lang)
            if tpl and tpl.subject and not render_text(tpl.subject, {})[1]:
                if lang == "en":
                    title = tpl.subject
                else:
                    title_ne = tpl.subject
        n = Notification.objects.create(
            user=user, kind=kind, title=title, title_ne=title_ne, body=body, data={"via": "sms"}, link=link
        )
        _queue_push(n)
        return n
    except Exception:  # noqa: BLE001 - inbox mirroring must never break an SMS flow
        logger.exception("Inbox mirror failed for %s", kind)
        return None


def send_sms(phone: str, body: str, kind: str = "generic", log_body=None):
    from .tasks import send_sms as task

    enqueue(task, phone, body, kind=kind, log_body=log_body)
    mirror_to_inbox(phone, log_body if log_body is not None else body, kind)


# --------------------------------------------------------------------------- templates
CRITICAL_PREFIXES = ("otp", "payslip", "security", "safety")


def is_critical(kind: str) -> bool:
    """Transactional/critical kinds ignore channel opt-outs and quiet hours."""
    return str(kind).startswith(CRITICAL_PREFIXES)


def is_marketing(kind: str) -> bool:
    return str(kind).startswith("marketing")


class _Vars(dict):
    def __missing__(self, key):
        self.missing.add(key)
        return "{" + key + "}"


def render_text(text: str, context: dict | None) -> tuple[str, list]:
    """Fill ``{variables}``; unknown ones stay as-is and are reported."""
    vars_ = _Vars({k: v for k, v in (context or {}).items()})
    vars_.missing = set()
    try:
        out = str(text or "").format_map(vars_)
    except (ValueError, IndexError, AttributeError, KeyError):
        return str(text or ""), []
    return out, sorted(vars_.missing)


def active_template(key: str, channel: str, language: str):
    from .models import NotificationTemplate

    return (
        NotificationTemplate.objects.filter(key=key, channel=channel, language=language, is_active=True)
        .order_by("-version")
        .first()
    )


def render(key: str, channel: str, language: str, context=None, *, fallback_en=True):
    """``(subject, body)`` from the newest active template, falling back to English; else None."""
    tpl = active_template(key, channel, language)
    if tpl is None and fallback_en and language != "en":
        tpl = active_template(key, channel, "en")
    if tpl is None:
        return None
    return render_text(tpl.subject, context)[0], render_text(tpl.body, context)[0]


def ensure_default_templates() -> int:
    """Create missing default templates (idempotent). Returns how many were added."""
    from .defaults import iter_defaults
    from .models import NotificationTemplate

    made = 0
    for key, channel, language, subject, body in iter_defaults():
        if not NotificationTemplate.objects.filter(key=key, channel=channel, language=language).exists():
            NotificationTemplate.objects.create(
                key=key, channel=channel, language=language, version=1, subject=subject, body=body
            )
            made += 1
    return made


# --------------------------------------------------------------------------- preferences
def preferences_for(user):
    """Stored preferences or unsaved defaults (no write on read paths)."""
    from .models import NotificationPreference

    pref = NotificationPreference.objects.filter(user=user).first()
    return pref or NotificationPreference(user=user)


def quiet_until(pref, now=None):
    """If ``now`` falls in the user's quiet hours, the aware datetime they end; else None."""
    import datetime as dt

    start, end = pref.quiet_hours_start, pref.quiet_hours_end
    if not start or not end or start == end:
        return None
    now = timezone.localtime(now or timezone.now())
    t = now.time().replace(tzinfo=None)
    inside = start <= t < end if start < end else (t >= start or t < end)
    if not inside:
        return None
    end_dt = timezone.make_aware(dt.datetime.combine(now.date(), end), now.tzinfo)
    if end_dt <= now:
        end_dt += dt.timedelta(days=1)
    return end_dt


# --------------------------------------------------------------------------- deliveries
def _lang(user) -> str:
    return "ne" if getattr(user, "preferred_language", "en") == "ne" else "en"


def _schedule(delivery, critical: bool, pref) -> None:
    from .tasks import send_delivery

    now = timezone.now()
    when = None if critical else quiet_until(pref, now)
    delivery.next_attempt_at = when or now
    delivery.save(update_fields=["next_attempt_at"])
    if when is None:
        enqueue(send_delivery, str(delivery.pk))


def _push_delivery(n, pref, critical, template=None, context=None):
    from . import push
    from .models import DeviceToken, NotificationDelivery

    if not push.enabled() or not (critical or pref.push_enabled):
        return None
    if not DeviceToken.objects.filter(user_id=n.user_id).exists():
        return None
    rendered = render(template, "push", _lang(n.user), context) if template else None
    title, body = rendered if rendered else localized(n)
    d = NotificationDelivery.objects.create(notification=n, channel="push", subject=title[:200], body=body)
    _schedule(d, critical, pref)
    return d


def _queue_push(notification) -> None:
    """Push an inbox row created outside ``notify`` (SMS mirror)."""
    _push_delivery(notification, preferences_for(notification.user), is_critical(notification.kind))


def notify(
    user,
    kind: str,
    title: str,
    body: str,
    *,
    title_ne=None,
    body_ne=None,
    data=None,
    link=None,
    sms: bool = False,
    email: bool = False,
    template: str | None = None,
    context: dict | None = None,
):
    """Create an inbox row and fan out to push / SMS / email per the user's preferences.

    ``template`` + ``context`` render the newest active template version per channel in the user's
    language (fallback English, then the literal title/body). Critical kinds (otp, payslip*,
    security*, safety*) ignore opt-outs and quiet hours; marketing* kinds need ``marketing_opt_in``.
    Email is transactional only and goes out when ``email=True`` or the template has an email version.
    Returns the Notification (or None when suppressed).
    """
    if user is None:
        return None
    from .models import Notification, NotificationDelivery

    pref = preferences_for(user)
    if is_marketing(kind) and not pref.marketing_opt_in:
        return None
    critical = is_critical(kind)
    ctx = context or {}
    if template:
        en = render(template, "inapp", "en", ctx)
        if en:
            title, body = en
        ne = render(template, "inapp", "ne", ctx, fallback_en=False)
        if ne:
            title_ne, body_ne = ne

    n = Notification.objects.create(
        user=user,
        kind=kind,
        title=str(title)[:200],
        title_ne=str(title_ne)[:200] if title_ne else None,
        body=str(body or ""),
        body_ne=str(body_ne) if body_ne else None,
        data=data or {},
        link=link,
    )
    NotificationDelivery.objects.create(
        notification=n, channel="inapp", status="sent", attempts=1, subject=n.title, body=n.body
    )
    _push_delivery(n, pref, critical, template, ctx)

    lang = _lang(user)
    if sms and getattr(user, "phone", None) and (critical or pref.sms_enabled):
        rendered = render(template, "sms", lang, ctx) if template else None
        if rendered:
            text = rendered[1]
        else:
            loc_title, loc_body = localized(n, user)
            text = loc_body or loc_title
            if not str(text).startswith("KaamSathi"):
                text = f"KaamSathi: {text}"
        d = NotificationDelivery.objects.create(notification=n, channel="sms", body=text)
        _schedule(d, critical, pref)

    email_tpl = render(template, "email", lang, ctx) if template else None
    if (
        getattr(user, "email", None)
        and (email or email_tpl)
        and not is_marketing(kind)
        and (critical or pref.email_enabled)
    ):
        subject, text = email_tpl if email_tpl else localized(n, user)
        d = NotificationDelivery.objects.create(
            notification=n, channel="email", subject=subject[:200], body=text
        )
        _schedule(d, True, pref)  # email is never held for quiet hours
    return n


def localized(notification, user=None) -> tuple[str, str]:
    """(title, body) in the user's preferred language."""
    user = user or notification.user
    if getattr(user, "preferred_language", "en") == "ne":
        return notification.title_ne or notification.title, notification.body_ne or notification.body
    return notification.title, notification.body
