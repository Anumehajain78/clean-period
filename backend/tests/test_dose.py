import json
from pathlib import Path

import pytest

from core import dose

REPO = Path(__file__).resolve().parents[2]
CONFIG = dose.load_config()

# Second school, deliberately different from the sample: another city, six
# 45-minute periods, a 15-minute break, no assembly. Test fixture only.
OTHER_SCHOOL = {
    "school": {"name": "Test School B", "latitude": 26.85, "longitude": 80.95,
               "timezone": "Asia/Kolkata", "ground_capacity": 2},
    "slots": [
        {"id": "s1", "start": "08:30", "end": "09:15"},
        {"id": "s2", "start": "09:15", "end": "10:00"},
        {"id": "brk", "start": "10:00", "end": "10:15"},
        {"id": "s3", "start": "10:15", "end": "11:00"},
        {"id": "s4", "start": "11:00", "end": "11:45"},
        {"id": "s5", "start": "11:45", "end": "12:30"},
        {"id": "s6", "start": "12:30", "end": "13:15"},
    ],
    "classes": [{"id": "3A", "name": "Class III-A", "days": {"monday": [
        {"slot": "s1", "subject": "Maths", "activity": "classroom", "teacher": "A", "place": "classroom", "movable": True},
        {"slot": "s2", "subject": "Sports", "activity": "pe", "teacher": "B", "place": "ground", "movable": True},
        {"slot": "brk", "subject": "Break", "activity": "recess", "teacher": None, "place": "ground", "movable": False},
        {"slot": "s3", "subject": "EVS", "activity": "classroom", "teacher": "C", "place": "classroom", "movable": True},
        {"slot": "s4", "subject": "Yoga", "activity": "indoor_activity", "teacher": "B", "place": "classroom", "movable": True},
        {"slot": "s5", "subject": "English", "activity": "classroom", "teacher": "D", "place": "classroom", "movable": True},
        {"slot": "s6", "subject": "Hindi", "activity": "classroom", "teacher": "E", "place": "classroom", "movable": True},
    ]}}],
}


def flat(value):
    return {h: value for h in range(24)}


# --- time helpers -----------------------------------------------------------

def test_parse_hhmm():
    assert dose.parse_hhmm("07:40") == 460
    assert dose.parse_hhmm("00:00") == 0
    assert dose.parse_hhmm("13:05") == 785


@pytest.mark.parametrize("bad", ["7:4", "24:00", "12:60", "noon", ""])
def test_parse_hhmm_rejects_bad_input(bad):
    with pytest.raises(ValueError):
        dose.parse_hhmm(bad)


def test_minutes_by_hour_within_one_hour():
    assert dose.minutes_by_hour("08:00", "08:40") == [(8, 40)]


def test_minutes_by_hour_split_across_hours():
    assert dose.minutes_by_hour("08:40", "09:20") == [(8, 20), (9, 20)]
    assert dose.minutes_by_hour("07:50", "10:10") == [(7, 10), (8, 60), (9, 60), (10, 10)]


def test_minutes_by_hour_rejects_empty_or_reversed():
    with pytest.raises(ValueError):
        dose.minutes_by_hour("09:00", "09:00")
    with pytest.raises(ValueError):
        dose.minutes_by_hour("10:00", "09:00")


# --- config lookups ---------------------------------------------------------

def test_activity_profile_from_config():
    assert dose.activity_profile("pe", CONFIG) == ("high", False)
    assert dose.activity_profile("classroom", CONFIG) == ("sedentary", True)
    assert dose.activity_profile("indoor_activity", CONFIG) == ("light", True)


def test_activity_profile_unknown_activity():
    with pytest.raises(ValueError):
        dose.activity_profile("swimming", CONFIG)


def test_exposure_factor_and_rate_come_from_config():
    cfg = json.loads(json.dumps(CONFIG))
    cfg["exposure_factor"]["indoor"] = 0.5
    cfg["inhalation_rate_m3_min"]["high"] = 0.05
    assert dose.exposure_factor(True, cfg) == 0.5
    assert dose.exposure_factor(False, cfg) == 1.0
    assert dose.inhalation_rate("high", cfg) == 0.05


# --- period dose ------------------------------------------------------------

def test_period_dose_outdoor_pe():
    # 100 ug/m3 x 1.0 x 0.042 m3/min x 40 min
    assert dose.period_dose(flat(100), "08:00", "08:40", "pe", CONFIG) == pytest.approx(168.0)


def test_period_dose_indoor_classroom():
    # 100 x 0.7 x 0.0048 x 40
    assert dose.period_dose(flat(100), "08:00", "08:40", "classroom", CONFIG) == pytest.approx(13.44)


def test_period_dose_weights_each_hour_by_minutes():
    pm = {8: 100.0, 9: 200.0}
    # (20 x 100 + 20 x 200) x 0.7 x 0.0048
    assert dose.period_dose(pm, "08:40", "09:20", "classroom", CONFIG) == pytest.approx(20.16)


def test_period_dose_missing_hour_is_an_error_not_a_guess():
    with pytest.raises(ValueError):
        dose.period_dose({8: 100.0}, "08:40", "09:20", "classroom", CONFIG)
    with pytest.raises(ValueError):
        dose.period_dose({8: 100.0, 9: None}, "08:40", "09:20", "classroom", CONFIG)


def test_period_dose_rejects_negative_pm25():
    with pytest.raises(ValueError):
        dose.period_dose({8: -1.0}, "08:00", "08:40", "classroom", CONFIG)


def test_running_outside_is_much_worse_than_sitting_inside():
    pe = dose.period_dose(flat(150), "08:00", "08:40", "pe", CONFIG)
    sit = dose.period_dose(flat(150), "08:00", "08:40", "classroom", CONFIG)
    assert pe / sit == pytest.approx(0.042 / (0.7 * 0.0048))


# --- timetable resolution ---------------------------------------------------

def test_periods_with_times_attaches_slot_times():
    tt = OTHER_SCHOOL
    periods = dose.periods_with_times(tt["slots"], tt["classes"][0]["days"]["monday"])
    assert periods[0]["start"] == "08:30" and periods[0]["end"] == "09:15"
    assert periods[2]["subject"] == "Break" and periods[2]["end"] == "10:15"
    assert len(periods) == 7


def test_periods_with_times_unknown_slot():
    with pytest.raises(ValueError):
        dose.periods_with_times(OTHER_SCHOOL["slots"], [{"slot": "zz", "activity": "classroom"}])


def test_periods_with_times_does_not_mutate_input():
    day = OTHER_SCHOOL["classes"][0]["days"]["monday"]
    dose.periods_with_times(OTHER_SCHOOL["slots"], day)
    assert "start" not in day[0]


# --- day dose ---------------------------------------------------------------

def test_day_dose_other_school():
    tt = OTHER_SCHOOL
    periods = dose.periods_with_times(tt["slots"], tt["classes"][0]["days"]["monday"])
    result = dose.day_dose(periods, flat(100), CONFIG)
    sit45 = 100 * 0.7 * 0.0048 * 45   # 15.12
    expected = (
        4 * sit45                     # Maths, EVS, English, Hindi
        + 100 * 1.0 * 0.042 * 45      # Sports, 189
        + 100 * 1.0 * 0.022 * 15      # Break, 33
        + 100 * 0.7 * 0.011 * 45      # Yoga, 34.65
    )
    assert result["total_ug"] == pytest.approx(expected)
    assert [p["dose_ug"] for p in result["periods"]][1] == pytest.approx(189.0)
    assert len(result["periods"]) == 7


def test_day_dose_sample_timetable_monday():
    tt = json.loads((REPO / "data" / "sample_timetable.json").read_text())
    periods = dose.periods_with_times(tt["slots"], tt["classes"][0]["days"]["monday"])
    result = dose.day_dose(periods, flat(100), CONFIG)
    # Assembly 22 + PE 168 + Recess 44 + 7 classroom periods x 13.44
    assert result["total_ug"] == pytest.approx(22 + 168 + 44 + 7 * 13.44)


def test_day_dose_empty_day():
    assert dose.day_dose([], flat(100), CONFIG) == {"periods": [], "total_ug": 0.0}


# --- reduction --------------------------------------------------------------

def test_reduction_pct():
    assert dose.reduction_pct(200.0, 150.0) == pytest.approx(25.0)
    assert dose.reduction_pct(200.0, 200.0) == 0.0


def test_reduction_pct_zero_baseline():
    assert dose.reduction_pct(0.0, 0.0) == 0.0
