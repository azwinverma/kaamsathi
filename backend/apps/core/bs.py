"""Bikram Sambat (BS) calendar helpers built on the ``nepali_datetime`` package.

All dates are *stored* in AD. These helpers convert to/from BS, describe BS
months and compute Nepal's fiscal year (Shrawan 1 → Asar end).
"""

from __future__ import annotations

import datetime as dt
import re
from dataclasses import dataclass

import nepali_datetime as nd
from django.utils import timezone

MONTHS_EN = (
    None,
    "Baishakh",
    "Jestha",
    "Asar",
    "Shrawan",
    "Bhadra",
    "Ashwin",
    "Kartik",
    "Mangsir",
    "Poush",
    "Magh",
    "Falgun",
    "Chaitra",
)
MONTHS_NE = (
    None,
    "बैशाख",
    "जेठ",
    "असार",
    "साउन",
    "भदौ",
    "असोज",
    "कात्तिक",
    "मंसिर",
    "पुस",
    "माघ",
    "फागुन",
    "चैत",
)
_DEVANAGARI = str.maketrans("0123456789", "०१२३४५६७८९")
_BS_RE = re.compile(r"^(\d{4})-(\d{1,2})-(\d{1,2})$")


class BSDateError(ValueError):
    pass


def to_devanagari(value) -> str:
    return str(value).translate(_DEVANAGARI)


def today_ad() -> dt.date:
    return timezone.localdate()


def ad_to_bs(value: dt.date) -> nd.date:
    if isinstance(value, dt.datetime):
        value = timezone.localtime(value).date() if timezone.is_aware(value) else value.date()
    try:
        return nd.date.from_datetime_date(value)
    except Exception as exc:  # out of supported range
        raise BSDateError(str(exc)) from exc


def bs_to_ad(year: int, month: int, day: int) -> dt.date:
    try:
        return nd.date(year, month, day).to_datetime_date()
    except Exception as exc:
        raise BSDateError(str(exc)) from exc


def parse_bs(value: str) -> dt.date:
    """Parse ``"2083-06-21"`` (BS) and return the AD date."""
    m = _BS_RE.match((value or "").strip())
    if not m:
        raise BSDateError("Invalid BS date, expected YYYY-MM-DD")
    return bs_to_ad(int(m.group(1)), int(m.group(2)), int(m.group(3)))


def bs_str(value: dt.date | None) -> str | None:
    """AD date → zero-padded BS string ``"2083-06-21"`` (None-safe)."""
    if value is None:
        return None
    if isinstance(value, str):
        value = dt.date.fromisoformat(value[:10])
    b = ad_to_bs(value)
    return f"{b.year:04d}-{b.month:02d}-{b.day:02d}"


def days_in_bs_month(year: int, month: int) -> int:
    if not 1 <= month <= 12:
        raise BSDateError("BS month must be 1–12")
    try:
        return nd._days_in_month(year, month)
    except Exception as exc:
        raise BSDateError(str(exc)) from exc


@dataclass(frozen=True)
class BSMonth:
    year: int
    month: int

    def __post_init__(self):
        if not 1 <= self.month <= 12:
            raise BSDateError("BS month must be 1–12")

    @property
    def days(self) -> int:
        return days_in_bs_month(self.year, self.month)

    @property
    def start(self) -> dt.date:
        return bs_to_ad(self.year, self.month, 1)

    @property
    def end(self) -> dt.date:
        return bs_to_ad(self.year, self.month, self.days)

    @property
    def name_en(self) -> str:
        return MONTHS_EN[self.month]

    @property
    def name_ne(self) -> str:
        return MONTHS_NE[self.month]

    def dates(self):
        start = self.start
        return [start + dt.timedelta(days=i) for i in range(self.days)]

    def previous(self) -> BSMonth:
        return BSMonth(self.year - 1, 12) if self.month == 1 else BSMonth(self.year, self.month - 1)

    def next(self) -> BSMonth:
        return BSMonth(self.year + 1, 1) if self.month == 12 else BSMonth(self.year, self.month + 1)

    @classmethod
    def of(cls, value: dt.date) -> BSMonth:
        b = ad_to_bs(value)
        return cls(b.year, b.month)


def bs_year_range(year: int) -> tuple[dt.date, dt.date]:
    return BSMonth(year, 1).start, BSMonth(year, 12).end


def fiscal_year(value: dt.date) -> str:
    b = ad_to_bs(value)
    start = b.year if b.month >= 4 else b.year - 1
    return f"{start}/{(start + 1) % 100:02d}"


def js_weekday(value: dt.date) -> int:
    """0=Sunday … 6=Saturday (contract convention)."""
    return (value.weekday() + 1) % 7


def format_bs_en(value: dt.date) -> str:
    b = ad_to_bs(value)
    return f"{b.day} {MONTHS_EN[b.month]} {b.year}"


def format_bs_ne(value: dt.date) -> str:
    b = ad_to_bs(value)
    return f"{to_devanagari(b.day)} {MONTHS_NE[b.month]} {to_devanagari(b.year)}"


def calendar_info(value: dt.date) -> dict:
    b = ad_to_bs(value)
    return {
        "ad": value.isoformat(),
        "bs": f"{b.year:04d}-{b.month:02d}-{b.day:02d}",
        "bs_year": b.year,
        "bs_month": b.month,
        "bs_day": b.day,
        "bs_month_name_en": MONTHS_EN[b.month],
        "bs_month_name_ne": MONTHS_NE[b.month],
        "formatted_en": format_bs_en(value),
        "formatted_ne": format_bs_ne(value),
        "fiscal_year": fiscal_year(value),
    }


def month_info(year: int, month: int) -> dict:
    m = BSMonth(year, month)
    return {
        "bs_year": year,
        "bs_month": month,
        "name_en": m.name_en,
        "name_ne": m.name_ne,
        "start_ad": m.start.isoformat(),
        "end_ad": m.end.isoformat(),
        "days": m.days,
        "days_list": [
            {"ad": d.isoformat(), "bs_day": i + 1, "weekday": js_weekday(d)} for i, d in enumerate(m.dates())
        ],
    }


def parse_date_flexible(value, system: str = "AD") -> dt.date:
    """Parse an AD (ISO) or BS date string / date object."""
    if isinstance(value, dt.datetime):
        return value.date()
    if isinstance(value, dt.date):
        return value
    text = str(value or "").strip()
    if (system or "AD").strip().upper() == "BS":
        return parse_bs(text)
    try:
        return dt.date.fromisoformat(text[:10])
    except ValueError as exc:
        raise BSDateError("Invalid date, expected YYYY-MM-DD") from exc
