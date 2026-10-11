import json
from pathlib import Path

import pytest

from core import dose, insights

REPO = Path(__file__).resolve().parents[2]
CONFIG = dose.load_config()
TT = json.loads((REPO / "data" / "sample_timetable.json").read_text())
SLOTS = TT["slots"]
CLASSES = [{"id": "6B", "name": "VI-B", "periods": TT["classes"][0]["days"]["monday"]}]

MORNING = [200.0] * 11 + [60.0] * 13          # PE should move to the afternoon
SEVERE = [300.0] * 24                          # all indoors
FLAT = [80.0] * 24                             # nothing to gain
CLEAN = [20.0] * 24


# --- outlook ----------------------------------------------------------------------

def test_outlook_one_row_per_date_with_verdicts():
    days = {"2026-10-12": MORNING, "2026-10-13": SEVERE, "2026-10-14": FLAT}
    rows = insights.outlook(SLOTS, CLASSES, days, ["2026-10-12", "2026-10-13", "2026-10-14"], CONFIG)
    assert [r["date"] for r in rows] == ["2026-10-12", "2026-10-13", "2026-10-14"]
    mon, tue, wed = rows
    assert mon["status"] == "planned" and mon["verdict"] == "reorder" and mon["moved"] >= 1 and mon["reduction_pct"] > 0
    assert mon["weekday"] == "monday"
    assert tue["verdict"] == "all_indoors"
    assert wed["moved"] == 0 and wed["reduction_pct"] == pytest.approx(0.0)


def test_outlook_counts_only_outdoor_moves():
    rows = insights.outlook(SLOTS, CLASSES, {"2026-10-12": MORNING}, ["2026-10-12"], CONFIG)
    assert rows[0]["moved"] == 1                 # PE moved; the classroom period it swapped with is not counted


def test_outlook_school_hours_air():
    rows = insights.outlook(SLOTS, CLASSES, {"2026-10-12": MORNING}, ["2026-10-12"], CONFIG)
    r = rows[0]
    assert [h["hour"] for h in r["hours"]] == list(range(7, 14))
    assert r["school_max_pm25"] == 200.0
    assert r["school_mean_pm25"] == pytest.approx((200 * 4 + 60 * 3) / 7)
    assert r["category"] == insights.thresholds.pm25_category(r["school_mean_pm25"], CONFIG)


def test_outlook_missing_forecast_is_marked_not_guessed():
    gap = list(MORNING)
    gap[9] = None
    rows = insights.outlook(SLOTS, CLASSES, {"2026-10-12": gap}, ["2026-10-12", "2026-10-13"], CONFIG)
    assert [r["status"] for r in rows] == ["no_forecast", "no_forecast"]
    assert "reduction_pct" not in rows[0]


def test_outlook_marks_cleanest_day():
    days = {"2026-10-12": MORNING, "2026-10-13": CLEAN, "2026-10-14": FLAT}
    rows = insights.outlook(SLOTS, CLASSES, days, list(days), CONFIG)
    assert [r.get("cleanest", False) for r in rows] == [False, True, False]


def test_outlook_no_cleanest_when_nothing_planned():
    rows = insights.outlook(SLOTS, CLASSES, {}, ["2026-10-12"], CONFIG)
    assert not any(r.get("cleanest") for r in rows)


def test_outlook_bad_timetable_raises():
    bad = [{"id": "x", "name": "x", "periods": [dict(CLASSES[0]["periods"][1], slot="nope")]}]
    with pytest.raises(ValueError):
        insights.outlook(SLOTS, bad, {"2026-10-12": MORNING}, ["2026-10-12"], CONFIG)


def test_school_dates_skips_weekends():
    assert insights.school_dates("2026-10-09", 5) == ["2026-10-09", "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15"]


# --- your school, last winter ------------------------------------------------------

def history(n_days, values):
    from datetime import date, timedelta
    d0 = date(2025, 12, 1)  # a Monday
    return {(d0 + timedelta(days=i)).isoformat(): values for i in range(n_days)}


def test_winter_uses_same_timetable_every_weekday():
    out = insights.winter(SLOTS, CLASSES, history(14, MORNING), CONFIG)
    s = out["summary"]
    assert s["school_days"] == 10                     # two weeks, weekends skipped
    assert s["season_reduction_pct"] > 0
    assert len(out["days"]) == 10
    assert set(out["days"][0]) == {"date", "reduction_pct", "verdict"}
    assert out["skipped"] == 4


def test_winter_reports_all_indoors_days():
    out = insights.winter(SLOTS, CLASSES, history(7, SEVERE), CONFIG)
    assert out["summary"]["all_indoors_days"] == 5


def test_winter_hourly_profile():
    out = insights.winter(SLOTS, CLASSES, history(7, MORNING), CONFIG)
    prof = {p["hour"]: p["median_pm25"] for p in out["hourly_profile"]}
    assert prof[7] == 200.0 and prof[13] == 60.0


def test_winter_empty_history():
    out = insights.winter(SLOTS, CLASSES, {}, CONFIG)
    assert out["summary"]["school_days"] == 0 and out["days"] == []
