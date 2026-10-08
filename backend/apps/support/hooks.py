"""Lazy bridges to services other agents own (they may not exist yet — every call degrades safely).

* ``notify_user`` → ``apps.notifications.services.notify`` (inbox + push + optional SMS); falls back
  to a plain SMS through the existing SMS service when that function does not exist.
* ``emit`` → ``apps.integrations.services.emit`` (employer webhooks); no-op when missing.
* ``validate_upload`` → ``apps.core.uploads.validate_upload``; when missing only the size cap is
  enforced here.
"""

from __future__ import annotations

import logging

from django.utils import translation

logger = logging.getLogger("kaamsathi.support")


def _render(text, lang: str, **fmt) -> str:
    with translation.override(lang):
        values = {k: str(v) for k, v in fmt.items()}
        return str(text).format(**values) if values else str(text)


def notify_user(user, kind: str, title, body, *, link=None, data=None, sms: bool = False, fmt=None) -> None:
    """``title``/``body`` may be lazy translations; both en and ne variants are sent."""
    if user is None:
        return
    fmt = fmt or {}
    title_en, body_en = _render(title, "en", **fmt), _render(body, "en", **fmt)
    title_ne, body_ne = _render(title, "ne", **fmt), _render(body, "ne", **fmt)
    try:
        from apps.notifications.services import notify
    except ImportError:
        notify = None
    if notify is not None:
        try:
            notify(
                user,
                kind,
                title_en,
                body_en,
                title_ne=title_ne,
                body_ne=body_ne,
                data=data,
                link=link,
                sms=sms,
            )
        except Exception:  # noqa: BLE001 - a notification failure must not fail the request
            logger.exception("notify(%s) failed for user %s", kind, getattr(user, "pk", None))
        return
    phone = getattr(user, "phone", None)
    if not phone:
        return
    from apps.notifications.services import send_sms

    prefers_ne = getattr(user, "preferred_language", "en") == "ne"
    send_sms(phone, f"KaamSathi: {body_ne if prefers_ne else body_en}", kind=kind)


def emit(organization, event: str, payload: dict) -> None:
    if organization is None:
        return
    try:
        from apps.integrations.services import emit as _emit
    except ImportError:
        return
    try:
        _emit(organization, event, payload)
    except Exception:  # noqa: BLE001
        logger.exception("Webhook emit %s failed for org %s", event, organization.pk)


def validate_upload(file, *, kinds: set[str], max_mb: int = 8):
    try:
        from apps.core.uploads import validate_upload as _validate
    except ImportError:
        _validate = None
    if _validate is not None:
        return _validate(file, kinds=kinds, max_mb=max_mb)
    from apps.core.exceptions import APIError

    if getattr(file, "size", 0) > max_mb * 1024 * 1024:
        raise APIError("upload_rejected", message=f"File is larger than {max_mb} MB.")
    return file


def staff_with_role(role: str):
    """Active staff users holding ``role`` (or superadmin), via ``apps.accounts.staff_roles`` when
    present; without staff roles every active staff member qualifies."""
    from django.contrib.auth import get_user_model

    staff = list(get_user_model().objects.filter(is_staff=True, is_active=True))
    try:
        from apps.accounts.staff_roles import user_roles
    except ImportError:
        return staff
    out = []
    for user in staff:
        roles = user_roles(user)
        if role in roles or "superadmin" in roles:
            out.append(user)
    return out
