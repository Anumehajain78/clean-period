import pytest

from core import dose, thresholds

CONFIG = dose.load_config()

PERIODS = [
    {"slot": "a", "subject": "Assembly", "activity": "assembly", "place": "ground", "start": "07:40", "end": "08:00"},
    {"slot": "1", "subject": "PE", "activity": "pe", "place": "ground", "start": "08:00", "end": "08:40"},
    {"slot": "2", "subject": "Maths", "activity": "classroom", "place": "classroom", "start": "08:40", "end": "09:20"},
    {"slot": "3", "subject": "Yoga", "activity": "indoor_activity", "place": "classroom", "start": "09:20", "end": "10:00"},
]


@pytest.mark.parametrize("value,name", [
    (0, "Good"), (30, "Good"), (30.5, "Satisfactory"), (60, "Satisfactory"),
    (61, "Moderate"), (90, "Moderate"), (120, "Poor"), (121, "Very Poor"),
    (250, "Very Poor"), (251, "Severe"), (900, "Severe"),
])
def test_pm25_category(value, name):
    assert thresholds.pm25_category(value, CONFIG) == name


def test_pm25_category_rejects_negative():
    with pytest.raises(ValueError):
        thresholds.pm25_category(-5, CONFIG)


def test_school_hours_covers_every_touched_hour():
    assert thresholds.school_hours(PERIODS) == [7, 8, 9]


def test_school_hours_empty():
    assert thresholds.school_hours([]) == []


def test_all_indoors_when_every_hour_above_threshold():
    pm = {7: 300.0, 8: 180.0, 9: 121.0}
    assert thresholds.needs_all_indoors(pm, PERIODS, CONFIG) is True


def test_not_all_indoors_when_one_hour_at_or_below_threshold():
    pm = {7: 300.0, 8: 120.0, 9: 400.0}
    assert thresholds.needs_all_indoors(pm, PERIODS, CONFIG) is False


def test_all_indoors_ignores_hours_outside_school():
    pm = {h: 500.0 for h in range(24)}
    pm[15] = 10.0  # clean, but school is over
    assert thresholds.needs_all_indoors(pm, PERIODS, CONFIG) is True


def test_all_indoors_threshold_comes_from_config():
    cfg = {**CONFIG, "all_indoors_threshold_pm25": 250}
    pm = {7: 200.0, 8: 200.0, 9: 200.0}
    assert thresholds.needs_all_indoors(pm, PERIODS, cfg) is False


def test_all_indoors_missing_hour_is_an_error():
    with pytest.raises(ValueError):
        thresholds.needs_all_indoors({7: 300.0, 8: 300.0}, PERIODS, CONFIG)


def test_to_all_indoors_converts_only_outdoor_periods():
    out = thresholds.to_all_indoors(PERIODS, CONFIG)
    assert [p["activity"] for p in out] == ["indoor_activity"] * 2 + ["classroom", "indoor_activity"]
    assert [p["place"] for p in out] == ["classroom"] * 4
    assert out[0]["converted_from"] == "assembly"
    assert out[1]["converted_from"] == "pe"
    assert "converted_from" not in out[2]
    assert "converted_from" not in out[3]  # yoga was already indoors
    # same periods, same order, same subjects
    assert [p["subject"] for p in out] == [p["subject"] for p in PERIODS]


def test_to_all_indoors_does_not_mutate_input():
    thresholds.to_all_indoors(PERIODS, CONFIG)
    assert PERIODS[1]["activity"] == "pe"


def test_to_all_indoors_lowers_dose():
    pm = {h: 200.0 for h in range(24)}
    before = dose.day_dose(PERIODS, pm, CONFIG)["total_ug"]
    after = dose.day_dose(thresholds.to_all_indoors(PERIODS, CONFIG), pm, CONFIG)["total_ug"]
    assert after < before
