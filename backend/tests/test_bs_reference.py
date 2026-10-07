"""BS calendar helpers (apps/core/bs.py), /ref endpoints, money helpers."""

import datetime as dt
from decimal import Decimal as D

import pytest

from apps.core import bs
from apps.core.money import format_npr, lakh_group, money_str

# --- helpers (no DB) -----------------------------------------------------------------------


def test_ad_bs_round_trip():
    assert bs.bs_str(dt.date(2026, 10, 7)) == "2083-06-21"
    assert bs.bs_to_ad(2083, 6, 21) == dt.date(2026, 10, 7)
    assert bs.parse_bs("2083-6-21") == dt.date(2026, 10, 7)
    assert bs.bs_str(None) is None
    assert bs.bs_str("2026-10-07") == "2083-06-21"


def test_parse_bs_invalid():
    with pytest.raises(bs.BSDateError):
        bs.parse_bs("21/06/2083")
    with pytest.raises(bs.BSDateError):
        bs.parse_bs("2083-13-01")


def test_bs_month():
    m = bs.BSMonth(2083, 4)
    assert (m.start, m.end, m.days) == (dt.date(2026, 7, 17), dt.date(2026, 8, 16), 31)
    assert m.name_en == "Shrawan" and m.name_ne == "साउन"
    assert len(m.dates()) == 31
    assert bs.BSMonth(2083, 1).previous() == bs.BSMonth(2082, 12)
    assert bs.BSMonth(2083, 12).next() == bs.BSMonth(2084, 1)
    assert bs.BSMonth.of(dt.date(2026, 10, 7)) == bs.BSMonth(2083, 6)
    assert bs.days_in_bs_month(2083, 3) == 32
    with pytest.raises(bs.BSDateError):
        bs.days_in_bs_month(2083, 0)


def test_consecutive_months_are_contiguous():
    for month in range(1, 12):
        cur, nxt = bs.BSMonth(2083, month), bs.BSMonth(2083, month + 1)
        assert nxt.start == cur.end + dt.timedelta(days=1)
        assert (cur.end - cur.start).days + 1 == cur.days


@pytest.mark.parametrize(
    "ad,fy",
    [
        (dt.date(2026, 7, 16), "2082/83"),  # Asar end
        (dt.date(2026, 7, 17), "2083/84"),  # Shrawan 1
        (dt.date(2027, 4, 13), "2083/84"),
        (dt.date(2027, 4, 14), "2083/84"),
    ],  # Baishakh 1 2084 is still FY 2083/84
)
def test_fiscal_year(ad, fy):
    assert bs.fiscal_year(ad) == fy


def test_js_weekday_and_formatting():
    assert bs.js_weekday(dt.date(2026, 10, 4)) == 0  # Sunday
    assert bs.js_weekday(dt.date(2026, 10, 10)) == 6  # Saturday
    assert bs.format_bs_en(dt.date(2026, 10, 7)) == "21 Ashwin 2083"
    assert bs.format_bs_ne(dt.date(2026, 10, 7)) == "२१ असोज २०८३"
    assert bs.to_devanagari(2083) == "२०८३"


def test_parse_date_flexible():
    assert bs.parse_date_flexible("2081-04-01", "BS") == dt.date(2024, 7, 16)
    assert bs.parse_date_flexible("2024-07-16") == dt.date(2024, 7, 16)
    assert bs.parse_date_flexible(dt.datetime(2024, 7, 16, 10, 0)) == dt.date(2024, 7, 16)
    with pytest.raises(bs.BSDateError):
        bs.parse_date_flexible("16/07/2024")


def test_money_helpers():
    assert lakh_group(D("1234567.5")) == "12,34,567.50"
    assert lakh_group(D("-999")) == "-999.00"
    assert format_npr(D("123456")) == "Rs. 1,23,456"
    assert format_npr(D("19550.5")) == "Rs. 19,550.50"
    assert money_str("19550") == "19550.00"


# --- endpoints -----------------------------------------------------------------------------


@pytest.mark.django_db
def test_health(api):
    assert api.get("/api/v1/health").json() == {"status": "ok"}


@pytest.mark.django_db
def test_ref_provinces_districts_trades(api):
    provinces = api.get("/api/v1/ref/provinces").json()
    assert [p["name_en"] for p in provinces] == [
        "Koshi",
        "Madhesh",
        "Bagmati",
        "Gandaki",
        "Lumbini",
        "Karnali",
        "Sudurpashchim",
    ]
    assert len(api.get("/api/v1/ref/districts").json()) == 77
    bagmati = api.get("/api/v1/ref/districts", {"province": 3}).json()
    assert len(bagmati) == 13 and all(d["province"] == 3 for d in bagmati)
    assert {"code": "kathmandu", "name_en": "Kathmandu", "name_ne": "काठमाडौं", "province": 3} in bagmati
    assert api.get("/api/v1/ref/districts", {"province": "x"}).json()["error"]["code"] == "validation_error"
    trades = api.get("/api/v1/ref/trades").json()
    assert set(trades[0]) == {"code", "name_en", "name_ne", "category"}


@pytest.mark.django_db
def test_ref_minimum_wage(api):
    assert api.get("/api/v1/ref/minimum-wage").json() == {
        "effective_from": "2025-07-17",
        "effective_from_bs": "2082-04-01",
        "monthly_basic": "12170.00",
        "monthly_da": "7380.00",
        "monthly_total": "19550.00",
        "daily": "754.00",
        "hourly": "101.00",
        "hourly_part_time": "107.00",
    }


@pytest.mark.django_db
def test_calendar_today(api, monkeypatch):
    monkeypatch.setattr("apps.geo.views.today_ad", lambda: dt.date(2026, 10, 7))
    assert api.get("/api/v1/ref/calendar/today").json() == {
        "ad": "2026-10-07",
        "bs": "2083-06-21",
        "bs_year": 2083,
        "bs_month": 6,
        "bs_day": 21,
        "bs_month_name_en": "Ashwin",
        "bs_month_name_ne": "असोज",
        "formatted_en": "21 Ashwin 2083",
        "formatted_ne": "२१ असोज २०८३",
        "fiscal_year": "2083/84",
    }


@pytest.mark.django_db
def test_calendar_convert(api):
    assert api.get("/api/v1/ref/calendar/convert", {"ad": "2026-07-17"}).json()["bs"] == "2083-04-01"
    res = api.get("/api/v1/ref/calendar/convert", {"bs": "2083-04-01"}).json()
    assert res["ad"] == "2026-07-17" and res["fiscal_year"] == "2083/84"
    for params in ({}, {"ad": "2026-13-01"}, {"bs": "2083-15-01"}):
        res = api.get("/api/v1/ref/calendar/convert", params)
        assert res.status_code == 400 and res.json()["error"]["code"] == "validation_error"


@pytest.mark.django_db
def test_calendar_month(api):
    body = api.get("/api/v1/ref/calendar/month", {"bs_year": 2083, "bs_month": 4}).json()
    assert body["name_en"] == "Shrawan"
    assert (body["start_ad"], body["end_ad"]) == ("2026-07-17", "2026-08-16")
    assert body["days"] == 31 and len(body["days_list"]) == 31
    assert body["days_list"][0] == {"ad": "2026-07-17", "bs_day": 1, "weekday": 5}
    res = api.get("/api/v1/ref/calendar/month", {"bs_year": 2083, "bs_month": 13})
    assert res.status_code == 400
    err = res.json()["error"]
    assert err["code"] == "validation_error" and "bs_month" in err["fields"]
