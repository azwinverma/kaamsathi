"""Demo data for privacy (called by ``seed_demo``): one completed export for the demo worker."""

WORKER_USER_PHONE = "9800000010"


def seed(stdout, rng):
    from apps.accounts.models import User

    from .models import PrivacyRequest
    from .services import generate_export

    user = User.objects.filter(phone=WORKER_USER_PHONE).first()
    if user is None:
        return
    if PrivacyRequest.objects.filter(user=user, kind="export", status="completed").exists():
        stdout.write("  privacy: demo export already present")
        return
    req = PrivacyRequest.objects.create(
        user=user,
        worker=getattr(user, "worker", None),
        kind="export",
        status="in_progress",
        details="Demo: copy of my data",
    )
    generate_export(req)
    stdout.write("  privacy: 1 completed data export request (worker 9800000010)")
