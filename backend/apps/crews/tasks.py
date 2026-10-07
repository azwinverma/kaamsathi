from celery import shared_task


@shared_task
def update_referral_eligibility():
    """Daily (beat 01:30): pending referrals → eligible after NAIKE_REFERRAL_HOLD_DAYS, or void."""
    from .services import update_eligibility

    return update_eligibility()
