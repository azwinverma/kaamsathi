from celery import shared_task


@shared_task
def refresh_all_profiles() -> int:
    """Nightly: rebuild every worker's FinancialProfile from paid payslips."""
    from .services import refresh_all

    return refresh_all()
