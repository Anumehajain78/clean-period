import json
from pathlib import Path

import pytest

from core import backtest, dose

REPO = Path(__file__).resolve().parents[2]
CONFIG = dose.load_config()

SLOTS = [{"id": "1", "start": "08:00", "end": "08:40"},
         {"id": "2", "start": "08:40", "end": "09:20"},
         {"id": "3", "start": "12:00", "end": "12:40"}]


def p(slot, subject, activity="classroom", place="classroom", teacher=None):
    return {"slot": slot, "subject": subject, "activity": activity, "teacher": teacher,
            "place": place, "movable": True}


TIMETABLE = {
    "school": {"name": "Test", "latitude": 0, "longitude": 0, "timezone": "Asia/Kolkata",
               "ground_capacity": None},
    "slots": SLOTS,
    "classes": [{"id": "A", "name": "A", "days": {
        "monday": [p("1", "PE", "pe", "ground", "T1"), p("2", "Maths", teacher="T2"), p("3", "Art", teacher="T3")],
        "tuesday": [p("1", "Maths", teacher="T2"), p("2", "Art", teacher="T3"), p("3", "Hindi", teacher="T4")],
    }}],
}

MORNING_DIRTY = [200.0] * 10 + [50.0] * 14   # hours 0-9 dirty, 10-23 clean
FLAT = [100.0] * 24


def history(**days):
    return {d: v for d, v in days.items()}


# 2025-12-01 is a Monday, 2025-12-02 Tuesday, 2025-12-06 Saturday.

def test_expand_closures():
    closures = [{"date": "2025-12-25", "reason": "Christmas"},
                {"start": "2026-01-01", "end": "2026-01-03", "reason": "Winter"}]
    assert backtest.expand_closures(closures) == {
        "2025-12-25": "Christmas", "2026-01-01": "Winter", "2026-01-02": "Winter", "2026-01-03": "Winter"}


def test_expand_closures_rejects_reversed_range():
    with pytest.raises(ValueError):
        backtest.expand_closures([{"start": "2026-01-03", "end": "2026-01-01", "reason": "x"}])


def test_weekday_name():
    assert backtest.weekday_name("2025-12-01") == "monday"
    assert backtest.weekday_name("2025-12-06") == "saturday"


def test_run_skips_weekends_and_closures_with_reasons():
    hist = {"2025-12-01": MORNING_DIRTY, "2025-12-02": FLAT, "2025-12-06": FLAT, "2025-12-08": FLAT}
    out = backtest.run(TIMETABLE, hist, {"2025-12-08": "Holiday"}, CONFIG)
    assert [d["date"] for d in out["days"]] == ["2025-12-01", "2025-12-02"]
    assert out["skipped"] == [{"date": "2025-12-06", "reason": "No classes on saturday"},
                              {"date": "2025-12-08", "reason": "Holiday"}]


def test_run_day_rows():
    out = backtest.run(TIMETABLE, {"2025-12-01": MORNING_DIRTY}, {}, CONFIG)
    day = out["days"][0]
    assert day["weekday"] == "monday" and day["verdict"] == "reorder"
    assert day["after_ug"] < day["before_ug"]
    assert day["reduction_pct"] == pytest.approx(dose.reduction_pct(day["before_ug"], day["after_ug"]))
    assert {"class": "A", "subject": "PE", "from_slot": "1", "to_slot": "3"} in day["moves"]
    assert day["school_hours_pm25_mean"] == pytest.approx((200 + 200 + 50) / 3)


def test_run_summary():
    hist = {"2025-12-01": MORNING_DIRTY, "2025-12-02": FLAT}
    out = backtest.run(TIMETABLE, hist, {}, CONFIG)
    s = out["summary"]
    days = out["days"]
    assert s["school_days"] == 2
    assert s["total_before_ug"] == pytest.approx(sum(d["before_ug"] for d in days))
    assert s["total_after_ug"] == pytest.approx(sum(d["after_ug"] for d in days))
    assert s["season_reduction_pct"] == pytest.approx(
        dose.reduction_pct(s["total_before_ug"], s["total_after_ug"]))
    assert s["mean_daily_reduction_pct"] == pytest.approx(sum(d["reduction_pct"] for d in days) / 2)
    assert s["by_weekday"]["tuesday"] == {"days": 1, "mean_reduction_pct": 0.0}
    assert s["all_indoors_days"] == 0


def test_summary_weekdays_in_week_order():
    # Tuesday 2 Dec comes before Monday 8 Dec in date order.
    hist = {"2025-12-02": FLAT, "2025-12-08": MORNING_DIRTY}
    out = backtest.run(TIMETABLE, hist, {}, CONFIG)
    assert list(out["summary"]["by_weekday"]) == ["monday", "tuesday"]


def test_run_counts_all_indoors_days():
    out = backtest.run(TIMETABLE, {"2025-12-01": [300.0] * 24}, {}, CONFIG)
    assert out["days"][0]["verdict"] == "all_indoors"
    assert out["summary"]["all_indoors_days"] == 1


def test_run_skips_day_with_missing_school_hours():
    gap = list(MORNING_DIRTY)
    gap[8] = None
    out = backtest.run(TIMETABLE, {"2025-12-01": gap, "2025-12-02": FLAT}, {}, CONFIG)
    assert [d["date"] for d in out["days"]] == ["2025-12-02"]
    assert out["skipped"][0]["date"] == "2025-12-01"
    assert "no PM2.5" in out["skipped"][0]["reason"]


def test_run_hourly_profile_over_school_days_only():
    hist = {"2025-12-01": MORNING_DIRTY, "2025-12-02": FLAT, "2025-12-06": [999.0] * 24}
    out = backtest.run(TIMETABLE, hist, {}, CONFIG)
    prof = {r["hour"]: r for r in out["hourly_profile"]}
    assert sorted(prof) == [8, 9, 12]
    assert prof[8]["median_pm25"] == pytest.approx(150.0)
    assert prof[12]["median_pm25"] == pytest.approx(75.0)


def test_run_empty_history():
    out = backtest.run(TIMETABLE, {}, {}, CONFIG)
    assert out["days"] == [] and out["summary"]["school_days"] == 0
    assert out["summary"]["season_reduction_pct"] == 0.0


def test_run_on_sample_timetable_shape():
    tt = json.loads((REPO / "data" / "sample_timetable.json").read_text())
    out = backtest.run(tt, {"2025-12-01": MORNING_DIRTY}, {}, CONFIG)
    assert out["days"][0]["verdict"] == "reorder"
    assert any(m["subject"] == "PE" for m in out["days"][0]["moves"])
