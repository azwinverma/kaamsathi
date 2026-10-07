"""Money helpers. All money is ``Decimal`` rounded to 2 dp with ROUND_HALF_UP."""

from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal

TWO = Decimal("0.01")
ZERO = Decimal("0.00")


def D(value) -> Decimal:
    if value is None or value == "":
        return Decimal("0")
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def q2(value) -> Decimal:
    return D(value).quantize(TWO, rounding=ROUND_HALF_UP)


def q0(value) -> Decimal:
    return D(value).quantize(Decimal("1"), rounding=ROUND_HALF_UP)


def money_str(value) -> str:
    return f"{q2(value):.2f}"


def lakh_group(value) -> str:
    """Indian/Nepali digit grouping: 1234567.5 → '12,34,567.50'."""
    v = q2(value)
    sign = "-" if v < 0 else ""
    whole, frac = f"{abs(v):.2f}".split(".")
    if len(whole) > 3:
        head, tail = whole[:-3], whole[-3:]
        groups = []
        while len(head) > 2:
            groups.insert(0, head[-2:])
            head = head[:-2]
        if head:
            groups.insert(0, head)
        whole = ",".join(groups + [tail])
    return f"{sign}{whole}.{frac}"


def format_npr(value) -> str:
    """DESIGN.md: 'Rs. 1,23,456' — decimals only when paisa is non-zero."""
    text = lakh_group(value)
    if text.endswith(".00"):
        text = text[:-3]
    return f"Rs. {text}"


# Excel number format producing lakh grouping (12,34,567.00).
EXCEL_LAKH_FORMAT = "[>=10000000]##\\,##\\,##\\,##0.00;[>=100000]##\\,##\\,##0.00;##,##0.00"
