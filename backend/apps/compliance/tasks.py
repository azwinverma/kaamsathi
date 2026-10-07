from celery import shared_task


@shared_task
def ssf_reminders():
    """Daily: SMS org owner/hr 5 days and 1 day before an unfiled SSF due date."""
    from apps.core.bs import MONTHS_EN, format_bs_en, today_ad
    from apps.core.permissions import HR, OWNER
    from apps.notifications.services import send_sms

    from .services import runs_needing_ssf_filing, ssf_due_date

    today = today_ad()
    sent = 0
    for run in runs_needing_ssf_filing():
        due = ssf_due_date(run)
        days_left = (due - today).days
        if days_left not in (5, 1):
            continue
        phones = set(
            run.organization.memberships.filter(is_active=True, role__in=[OWNER, HR]).values_list(
                "user__phone", flat=True
            )
        )
        body = (
            f"KaamSathi: SSF contributions for {MONTHS_EN[run.bs_month]} {run.bs_year} "
            f"({run.organization.name}) are due on {format_bs_en(due)} — {days_left} day(s) left. "
            "Download the SSF file in KaamSathi > Compliance and upload it to the SSF portal."
        )
        for phone in phones:
            send_sms(phone, body, kind="ssf_reminder")
            sent += 1
    return sent
