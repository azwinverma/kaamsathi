"""Issuer verification adapters (docs/CONTRACT-ECOSYSTEM.md §3).

Integrations that need a third-party agreement are built as adapters with a working manual
fallback. ``ManualVerifier`` (KaamSathi ops checks the document / calls the issuer) is the only
enabled one. ``NSTBRegistryVerifier`` is a stub until a data agreement with NSTB exists.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from django.conf import settings


class NotConfigured(Exception):
    """The live integration is not available (no agreement / credentials yet)."""


@dataclass
class VerificationResult:
    status: str  # verified | rejected
    method: str  # document | issuer_registry | issuer_partner | ops_call
    note: str = ""
    raw: dict = field(default_factory=dict)


class Verifier:
    code = "base"
    methods: tuple[str, ...] = ()

    def verify(self, credential) -> VerificationResult:  # pragma: no cover - interface
        raise NotImplementedError


class ManualVerifier(Verifier):
    """Ops records the outcome of a document check or a phone call to the issuer."""

    code = "manual"
    methods = ("document", "ops_call", "issuer_partner")

    def __init__(self, *, status: str, method: str = "document", note: str = ""):
        if status not in ("verified", "rejected"):
            raise ValueError("status must be verified or rejected")
        if method not in self.methods:
            raise ValueError(f"method {method!r} is not a manual method")
        self.status, self.method, self.note = status, method, note or ""

    def verify(self, credential) -> VerificationResult:
        return VerificationResult(status=self.status, method=self.method, note=self.note)


class NSTBRegistryVerifier(Verifier):
    """Look a certificate up in the NSTB registry. Disabled until a data agreement exists."""

    code = "nstb_registry"
    methods = ("issuer_registry",)

    def __init__(self, **_ignored):
        pass

    def verify(self, credential) -> VerificationResult:
        if not getattr(settings, "NSTB_REGISTRY_ENABLED", False):
            raise NotConfigured("NSTB registry lookup is not configured.")
        # Live lookup goes here once an agreement and API exist.
        raise NotConfigured("NSTB registry lookup is not implemented.")


def get_verifier(method: str, **kwargs) -> Verifier:
    if method in NSTBRegistryVerifier.methods:
        return NSTBRegistryVerifier(**kwargs)
    return ManualVerifier(method=method, **kwargs)
