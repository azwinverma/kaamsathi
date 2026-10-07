"""Roster (CONTRACT-ECOSYSTEM §7)."""

import datetime as dt

import pytest

from apps.scheduling.models import RosterEntry
from tests import factories as f
from tests.conftest import auth_client

pytestmark = pytest.mark.django_db

WEEK = dt.date(2026, 10, 4)  # a Sunday
NEXT = WEEK + dt.timedelta(days=7)


@pytest.fixture
def setup(org):
    site_a = f.SiteFactory(organization=org, name="A")
    site_b = f.SiteFactory(organization=org, name="B")
    day = f.ShiftFactory(organization=org, name="Day")
    night = f.ShiftFactory(organization=org, name="Night", start_time=dt.time(21), end_time=dt.time(6))
    ea = f.EmploymentFactory(organization=org, site=site_a, worker=f.WorkerFactory(full_name="Aa"))
    eb = f.EmploymentFactory(organization=org, site=site_b, worker=f.WorkerFactory(full_name="Bb"))
    return {"site_a": site_a, "site_b": site_b, "day": day, "night": night, "ea": ea, "eb": eb}


def entry(emp, date, shift=None, **kw):
    return {
        "employment_id": str(emp.id),
        "date": date.isoformat(),
        "shift_id": str(shift.id) if shift else None,
        **kw,
    }


def test_roster_grid_and_upsert(owner_client, setup):
    s = setup
    res = owner_client.put(
        "/api/v1/org/roster",
        {
            "entries": [
                entry(s["ea"], WEEK, s["day"]),
                entry(s["ea"], WEEK + dt.timedelta(days=1), is_off=True),
                entry(s["eb"], WEEK, s["night"], site_id=str(s["site_b"].id)),
            ]
        },
        format="json",
    )
    assert res.status_code == 200, res.json()
    assert res.json() == {"saved": 3, "cleared": 0}

    grid = owner_client.get(f"/api/v1/org/roster?week_start={WEEK}").json()
    assert grid["week_start"] == WEEK.isoformat() and len(grid["days"]) == 7
    assert grid["days"][0]["date_bs"] and grid["days"][0]["weekday"] == 0
    assert {sh["name"] for sh in grid["shifts"]} == {"Day", "Night"}
    rows = {r["worker_name"]: r for r in grid["rows"]}
    assert rows["Aa"]["cells"][WEEK.isoformat()]["shift_id"] == str(s["day"].id)
    assert rows["Aa"]["cells"][(WEEK + dt.timedelta(days=1)).isoformat()]["is_off"] is True
    assert rows["Aa"]["cells"][(WEEK + dt.timedelta(days=2)).isoformat()] is None

    # Upsert replaces; empty cell clears.
    res = owner_client.put(
        "/api/v1/org/roster",
        {"entries": [entry(s["ea"], WEEK, s["night"]), entry(s["ea"], WEEK + dt.timedelta(days=1))]},
        format="json",
    )
    assert res.json() == {"saved": 1, "cleared": 1}
    assert RosterEntry.objects.get(employment=s["ea"], date=WEEK).shift == s["night"]
    assert not RosterEntry.objects.filter(employment=s["ea"], date=WEEK + dt.timedelta(days=1)).exists()

    site_grid = owner_client.get(f"/api/v1/org/roster?week_start={WEEK}&site={s['site_b'].id}").json()
    assert [r["worker_name"] for r in site_grid["rows"]] == ["Bb"]


def test_roster_validation(owner_client, setup, org):
    s = setup
    other_shift = f.ShiftFactory()
    res = owner_client.put(
        "/api/v1/org/roster", {"entries": [entry(s["ea"], WEEK, other_shift)]}, format="json"
    )
    assert res.status_code == 400 and "entries.0.shift_id" in res.json()["error"]["fields"]
    early = s["ea"].start_date - dt.timedelta(days=1)
    res = owner_client.put(
        "/api/v1/org/roster", {"entries": [entry(s["ea"], early, s["day"])]}, format="json"
    )
    assert res.status_code == 400
    foreign = f.EmploymentFactory()
    res = owner_client.put("/api/v1/org/roster", {"entries": [entry(foreign, WEEK, s["day"])]}, format="json")
    assert res.status_code == 400
    assert owner_client.put("/api/v1/org/roster", {"entries": "x"}, format="json").status_code == 400


def test_supervisor_limited_to_sites(setup, make_member):
    s = setup
    _, sup = make_member("supervisor", sites=[s["site_a"]])
    grid = sup.get(f"/api/v1/org/roster?week_start={WEEK}").json()
    assert [r["worker_name"] for r in grid["rows"]] == ["Aa"]
    assert (
        sup.put(
            "/api/v1/org/roster", {"entries": [entry(s["ea"], WEEK, s["day"])]}, format="json"
        ).status_code
        == 200
    )
    res = sup.put("/api/v1/org/roster", {"entries": [entry(s["eb"], WEEK, s["day"])]}, format="json")
    assert res.status_code == 403
    res = sup.put(
        "/api/v1/org/roster",
        {"entries": [entry(s["ea"], WEEK, s["day"], site_id=str(s["site_b"].id))]},
        format="json",
    )
    assert res.status_code == 403
    res = sup.post(
        "/api/v1/org/roster/copy-week",
        {"from_week_start": WEEK.isoformat(), "to_week_start": NEXT.isoformat(), "site": str(s["site_b"].id)},
        format="json",
    )
    assert res.status_code == 403


def test_copy_week(owner_client, setup, make_member):
    s = setup
    for i in range(7):
        RosterEntry.objects.create(
            employment=s["ea"], date=WEEK + dt.timedelta(days=i), shift=s["day"], is_off=i == 6
        )
        RosterEntry.objects.create(employment=s["eb"], date=WEEK + dt.timedelta(days=i), shift=s["night"])
    # eb leaves mid next week → only days while employed are copied.
    s["eb"].end_date = NEXT + dt.timedelta(days=2)
    s["eb"].save()
    # Existing target entry is overwritten.
    RosterEntry.objects.create(employment=s["ea"], date=NEXT, shift=s["night"])

    _, sup = make_member("supervisor", sites=[s["site_a"]])
    res = sup.post(
        "/api/v1/org/roster/copy-week",
        {"from_week_start": WEEK.isoformat(), "to_week_start": NEXT.isoformat()},
        format="json",
    )
    assert res.status_code == 200 and res.json() == {"copied": 7}  # supervisor: site A only
    assert RosterEntry.objects.get(employment=s["ea"], date=NEXT).shift == s["day"]
    assert RosterEntry.objects.get(employment=s["ea"], date=NEXT + dt.timedelta(days=6)).is_off
    assert not RosterEntry.objects.filter(employment=s["eb"], date__gte=NEXT).exists()

    res = owner_client.post(
        "/api/v1/org/roster/copy-week",
        {"from_week_start": WEEK.isoformat(), "to_week_start": NEXT.isoformat()},
        format="json",
    )
    assert res.json() == {"copied": 10}
    assert RosterEntry.objects.filter(employment=s["eb"], date__gte=NEXT).count() == 3
    same = owner_client.post(
        "/api/v1/org/roster/copy-week",
        {"from_week_start": WEEK.isoformat(), "to_week_start": WEEK.isoformat()},
        format="json",
    )
    assert same.status_code == 400


def test_me_roster(org, setup):
    s = setup
    user = f.UserFactory()
    worker = s["ea"].worker
    worker.user = user
    worker.save()
    RosterEntry.objects.create(employment=s["ea"], date=WEEK, shift=s["day"])
    RosterEntry.objects.create(employment=s["eb"], date=WEEK, shift=s["night"])
    res = auth_client(user).get(f"/api/v1/me/roster?week_start={WEEK}")
    assert res.status_code == 200
    body = res.json()
    assert len(body["days"]) == 7 and len(body["entries"]) == 1
    e = body["entries"][0]
    assert e["shift"]["name"] == "Day" and e["site"]["name"] == "A" and e["organization"]["id"] == str(org.id)


def test_attendance_day_includes_rostered_shift(owner_client, setup):
    s = setup
    RosterEntry.objects.create(employment=s["ea"], date=WEEK, shift=s["day"])
    body = owner_client.get(f"/api/v1/org/attendance/day?date={WEEK}").json()
    rows = {r["employment_id"]: r for r in body["rows"]}
    assert rows[str(s["ea"].id)]["rostered_shift"]["name"] == "Day"
    assert rows[str(s["ea"].id)]["rostered_shift"]["start_time"] == "09:00"
    assert rows[str(s["eb"].id)]["rostered_shift"] is None
