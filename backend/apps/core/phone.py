import re

PHONE_RE = re.compile(r"^9[78]\d{8}$")


def normalize_phone(value) -> str:
    digits = re.sub(r"\D", "", str(value or ""))
    if digits.startswith("977") and len(digits) == 13:
        digits = digits[3:]
    return digits


def is_valid_phone(value) -> bool:
    return bool(PHONE_RE.match(value or ""))


def mask_phone(value) -> str:
    """'9841234123' → '98XXXXX123'."""
    if not value or len(value) < 5:
        return value or ""
    return f"{value[:2]}{'X' * (len(value) - 5)}{value[-3:]}"
