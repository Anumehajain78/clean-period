import copy
import json
from pathlib import Path

import pytest

from core import dose, nightly, planning

REPO = Path(__file__).resolve().parents[2]
CONFIG = dose.load_config()
TT = json.loads((REPO / "data" / "sample_timetable.json").read_text())

MORNING = [200.0] * 11 + [60.0] * 13
FORECAST = {
    "days": {"2026-10-09": MORNING, "2026-10-10": MORNING, "2026-10-12": MORNING},
    "source": "Open-Meteo test", "grid_point": {"latitude": 28.6, "longitude": 77.2},
    "fetched_at": "2026-10-08T13:30:00+00:00", "cached": False,
}


# --- planning.plan_response ---------------------------------------------------

def test_plan_response_shape():
    cls = TT["classes"][0]
    classes = [{"id": cls["id"], "name": cls["name"], "periods": cls["days"]["friday"]}]
    r = planning.plan_response("2026-10-09", TT["slots"], classes, dict(enumerate(MORNING)), FORECAST, CONFIG)
    assert r["date"] == "2026-10-09" and r["verdict"] == "reorder"
    assert [h["hour"] for h in r["air"]["hours"]] == list(range(7, 14))
    assert r["air"]["source"] == "Open-Meteo test"
    assert r["assumptions"] and r["assumptions_hi"] and r["label"] and r["label_hi"]


# --- validate_timetable ---------------------------------------------------------

def test_sample_timetable_is_valid():
    assert nightly.validate_timetable(TT) == []


@pytest.mark.parametrize("breaker,expect", [
    (lambda t: t.pop("school"), "school"),
    (lambda t: t["school"].update(latitude="x"), "latitude"),
    (lambda t: t["school"].update(longitude=200), "longitude"),
    (lambda t: t.update(slots="nope"), "slots"),
    (lambda t: t["slots"].append({"id": "z", "start": "9", "end": "10:00"}), "slot"),
    (lambda t: t.update(classes=[]), "class"),
    (lambda t: t["classes"][0].update(days="nope"), "days"),
    (lambda t: t["classes"][0]["days"]["monday"][0].update(slot="missing"), "slot"),
])
def test_validate_timetable_rejects(breaker, expect):
    tt = copy.deepcopy(TT)
    breaker(tt)
    problems = nightly.validate_timetable(tt)
    assert problems and any(expect in p for p in problems)


def test_validate_rejects_huge_timetable():
    tt = copy.deepcopy(TT)
    tt["classes"] = [dict(tt["classes"][0], id=f"c{i}") for i in range(nightly.MAX_CLASSES + 1)]
    assert any("classes" in p for p in nightly.validate_timetable(tt))


# --- classes_for_day ------------------------------------------------------------

def test_classes_for_day():
    out = nightly.classes_for_day(TT, "friday")
    assert out == [{"id": "6B", "name": "Class VI-B", "periods": TT["classes"][0]["days"]["friday"]}]


def test_classes_for_day_skips_classes_without_lessons():
    tt = copy.deepcopy(TT)
    tt["classes"].append({"id": "7A", "name": "VII-A", "days": {"monday": []}})
    assert [c["id"] for c in nightly.classes_for_day(tt, "monday")] == ["6B"]
    assert nightly.classes_for_day(tt, "saturday") == []


# --- run_school -----------------------------------------------------------------

def test_run_school_plans_tomorrow_with_notice():
    r = nightly.run_school(TT, FORECAST, "2026-10-09", CONFIG)   # a Friday
    assert r["status"] == "planned" and r["date"] == "2026-10-09"
    assert r["plan"]["classes"][0]["id"] == "6B"
    assert any(m["subject"] == "Games" for m in r["plan"]["classes"][0]["moves"])
    assert "Games" in r["notice"]["en"] and r["notice"]["hi"]
    assert r["notice"]["source"] == "template"


def test_run_school_weekend_is_no_school():
    r = nightly.run_school(TT, FORECAST, "2026-10-10", CONFIG)   # a Saturday
    assert r == {"date": "2026-10-10", "status": "no_school", "reason": "No lessons on saturday"}


def test_run_school_missing_forecast_day_is_error():
    r = nightly.run_school(TT, FORECAST, "2026-10-13", CONFIG)   # a Tuesday, not in the forecast
    assert r["status"] == "error" and "2026-10-13" in r["reason"]


def test_run_school_bad_timetable_is_error_not_crash():
    tt = copy.deepcopy(TT)
    tt["classes"][0]["days"]["friday"][3]["slot"] = "p1"   # two periods in p1
    r = nightly.run_school(tt, FORECAST, "2026-10-09", CONFIG)
    assert r["status"] == "error" and "slot" in r["reason"]


def test_run_school_works_for_another_school():
    other = {
        "school": {"name": "Test School B", "latitude": 26.85, "longitude": 80.95,
                   "timezone": "Asia/Kolkata", "ground_capacity": 2},
        "slots": [{"id": "a", "start": "08:30", "end": "09:15"}, {"id": "b", "start": "12:00", "end": "12:45"}],
        "classes": [{"id": "3A", "name": "III-A", "days": {"monday": [
            {"slot": "a", "subject": "Sports", "activity": "pe", "teacher": "B", "place": "ground", "movable": True},
            {"slot": "b", "subject": "EVS", "activity": "classroom", "teacher": "C", "place": "classroom", "movable": True},
        ]}}],
    }
    r = nightly.run_school(other, FORECAST, "2026-10-12", CONFIG)   # a Monday
    assert r["status"] == "planned"
    assert r["plan"]["classes"][0]["moves"][0] == {"subject": "Sports", "from_slot": "a", "to_slot": "b"}
