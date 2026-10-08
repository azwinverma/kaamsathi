"""First-party product analytics. Server code calls ``apps.telemetry.track(name, user=..., **props)``."""


def track(name, user=None, organization=None, **props):
    """Record a server-side event; never raises (see ``services.track``)."""
    from .services import track as _track

    return _track(name, user=user, organization=organization, **props)
