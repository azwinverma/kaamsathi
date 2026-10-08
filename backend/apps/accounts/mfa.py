"""TOTP multi-factor auth for ops staff (RFC 6238 / RFC 4226, no third-party deps).

* SHA1, 30-second steps, 6 digits, ±1 step tolerance — what every authenticator app expects.
* Secrets are 160-bit random values, base32 encoded, stored encrypted (``StaffProfile.mfa_secret``).
* Recovery codes: 10 single-use codes, stored as SHA-256 hashes, shown to the user once.
* Login step-up: ``POST /auth/otp/verify`` returns a short-lived signed ``mfa_token`` instead of
  JWTs for staff with MFA enabled; ``POST /auth/mfa/verify`` exchanges it + a code for tokens.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import struct
import time
from urllib.parse import quote, urlencode

from django.core import signing

DIGITS = 6
PERIOD = 30
WINDOW = 1
ISSUER = "KaamSathi"
MFA_TOKEN_SALT = "kaamsathi.mfa.login"
MFA_TOKEN_MAX_AGE = 300
RECOVERY_CODE_COUNT = 10


# --- RFC 4226 / 6238 ------------------------------------------------------------------------


def generate_secret(nbytes: int = 20) -> str:
    return base64.b32encode(secrets.token_bytes(nbytes)).decode().rstrip("=")


def _key(secret: str) -> bytes:
    s = secret.strip().replace(" ", "").upper()
    s += "=" * (-len(s) % 8)
    return base64.b32decode(s)


def hotp(key: bytes, counter: int, digits: int = DIGITS, digest=hashlib.sha1) -> str:
    mac = hmac.new(key, struct.pack(">Q", counter), digest).digest()
    offset = mac[-1] & 0x0F
    code = struct.unpack(">I", mac[offset : offset + 4])[0] & 0x7FFFFFFF
    return str(code % 10**digits).zfill(digits)


def totp(secret: str, at: float | None = None, digits: int = DIGITS, period: int = PERIOD) -> str:
    at = time.time() if at is None else at
    return hotp(_key(secret), int(at // period), digits)


def verify_totp(secret: str, code: str, at: float | None = None, window: int = WINDOW) -> int | None:
    """Return the matched time-step counter (to block replays) or None."""
    code = (code or "").strip().replace(" ", "")
    if not (secret and code.isdigit() and len(code) == DIGITS):
        return None
    at = time.time() if at is None else at
    key = _key(secret)
    current = int(at // PERIOD)
    for step in range(current - window, current + window + 1):
        if hmac.compare_digest(hotp(key, step), code):
            return step
    return None


def otpauth_uri(secret: str, account: str, issuer: str = ISSUER) -> str:
    label = quote(f"{issuer}:{account}")
    params = urlencode(
        {"secret": secret, "issuer": issuer, "algorithm": "SHA1", "digits": DIGITS, "period": PERIOD}
    )
    return f"otpauth://totp/{label}?{params}"


def qr_svg(data: str) -> bytes:
    import qrcode
    import qrcode.image.svg

    img = qrcode.make(data, image_factory=qrcode.image.svg.SvgPathImage, box_size=10, border=2)
    return img.to_string()


# --- Recovery codes -------------------------------------------------------------------------


def _hash_recovery(code: str) -> str:
    norm = (code or "").strip().replace("-", "").replace(" ", "").lower()
    return hashlib.sha256(norm.encode()).hexdigest()


def generate_recovery_codes(n: int = RECOVERY_CODE_COUNT) -> tuple[list[str], list[str]]:
    """Return (plain codes for the user, sha256 hashes to store)."""
    alphabet = "abcdefghjkmnpqrstuvwxyz23456789"
    plain = []
    for _ in range(n):
        raw = "".join(secrets.choice(alphabet) for _ in range(10))
        plain.append(f"{raw[:5]}-{raw[5:]}")
    return plain, [_hash_recovery(c) for c in plain]


def consume_recovery_code(profile, code: str) -> bool:
    """Single use: removes the matching hash. Caller must hold a row lock on ``profile``."""
    digest = _hash_recovery(code)
    codes = list(profile.recovery_codes or [])
    for stored in codes:
        if hmac.compare_digest(stored, digest):
            codes.remove(stored)
            profile.recovery_codes = codes
            profile.save(update_fields=["recovery_codes", "updated_at"])
            return True
    return False


# --- Profile helpers ------------------------------------------------------------------------


def check_code(profile, code: str) -> bool:
    """Verify a TOTP code for an enrolled profile, rejecting replays of the same time step."""
    step = verify_totp(profile.mfa_secret or "", code)
    if step is None:
        return False
    if profile.mfa_last_step is not None and step <= profile.mfa_last_step:
        return False
    profile.mfa_last_step = step
    profile.save(update_fields=["mfa_last_step", "updated_at"])
    return True


def make_login_token(user) -> str:
    return signing.dumps({"u": str(user.pk)}, salt=MFA_TOKEN_SALT, compress=True)


def read_login_token(token: str) -> str | None:
    try:
        data = signing.loads(token or "", salt=MFA_TOKEN_SALT, max_age=MFA_TOKEN_MAX_AGE)
    except signing.BadSignature:
        return None
    return data.get("u")
