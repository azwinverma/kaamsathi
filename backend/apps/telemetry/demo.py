"""Demo telemetry: the seed itself emits server events through the model signals; nothing extra.

Funnels/retention stay mostly suppressed (k-anonymity 5) on demo-sized data — that is expected.
"""


def seed(stdout, rng):
    from .models import Event

    stdout.write(f"  Telemetry: {Event.objects.count()} product events recorded")
