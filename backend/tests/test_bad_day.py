"""Very Poor all school day: move outdoor periods indoors, or cancel the outdoor activity."""
import json
from pathlib import Path

import pytest

from core import dose, notice, optimiser, thresholds

REPO = Path(__file__).resolve().parents[2]
CONFIG = dose.load_config()
TT = json.loads((REPO / "data" / "sample_timetable.json").read_text())
SLOTS = TT["slots"]
CLASSES = [{"id": "6B", "name": "VI-B", "periods": TT["classes"][0]["days"]["monday"]}]
RED = {h: 300.0 for h in range(24)}

PERIODS = [
    {"slot": "a", "subject": "Assembly", "activity": "assembly", "place": "ground", "start": "07:40", "end": "08:00"},
    {"slot": "1", "subject": "PE", "activity": "pe", "place": "ground", "start": "08:00", "end": "08:40"},
    {"slot": "2", "subject": "Maths", "activity": "classroom", "place": "classroom", "start": "08:40", "end": "09:20"},
]


def test_cancel_outdoor_keeps_the_period_as_a_class_period():
    out = thresholds.cancel_outdoor(PERIODS, CONFIG)
    assert [p["activity"] for p in out] == ["classroom", "classroom", "classroom"]
    assert [p["place"] for p in out] == ["classroom"] * 3
    assert out[1]["cancelled"] is True and out[1]["converted_from"] == "pe"
    assert out[1]["subject"] == "PE"                     # same slot, the activity is what is cancelled
    assert "cancelled" not in out[2]
    assert PERIODS[1]["activity"] == "pe"                # input untouched


def test_cancel_gives_the_lowest_dose():
    pm = {h: 300.0 for h in range(24)}
    as_is = dose.day_dose(PERIODS, pm, CONFIG)["total_ug"]
    indoors = dose.day_dose(thresholds.to_all_indoors(PERIODS, CONFIG), pm, CONFIG)["total_ug"]
    cancel = dose.day_dose(thresholds.cancel_outdoor(PERIODS, CONFIG), pm, CONFIG)["total_ug"]
    assert cancel < indoors < as_is


def test_all_indoors_plan_offers_cancel_alternative():
    plan = optimiser.plan_day(SLOTS, CLASSES, RED, CONFIG)
    assert plan["verdict"] == "all_indoors"
    alt = plan["alternatives"]["cancel"]
    assert alt["total_after_ug"] < plan["total_after_ug"]
    assert alt["reduction_pct"] > plan["reduction_pct"]
    c = alt["classes"][0]
    assert c["id"] == "6B"
    assert sum(p["dose_ug"] for p in c["after"]) == pytest.approx(c["after_ug"])
    assert {p["subject"] for p in c["after"] if p.get("cancelled")} == {"Assembly", "PE", "Recess"}


def test_reorder_day_has_no_alternatives():
    morning = {h: (200.0 if h < 11 else 60.0) for h in range(24)}
    assert "alternatives" not in optimiser.plan_day(SLOTS, CLASSES, morning, CONFIG)


# --- notice -----------------------------------------------------------------------

def bad_day_plan(choice):
    plan = optimiser.plan_day(SLOTS, CLASSES, RED, CONFIG)
    if choice == "cancel":
        alt = plan["alternatives"]["cancel"]
        by_id = {c["id"]: c for c in alt["classes"]}
        plan = {**plan, "classes": [{**c, **by_id[c["id"]]} for c in plan["classes"]],
                "total_after_ug": alt["total_after_ug"], "reduction_pct": alt["reduction_pct"], "choice": "cancel"}
    hours = [{"hour": h, "pm25": 300.0, "category": "Severe"} for h in range(7, 14)]
    return {"date": "2026-10-12", **plan, "air": {"hours": hours}}


def test_notice_facts_split_indoor_and_cancelled():
    f = notice.facts(bad_day_plan("cancel"), "School")
    assert f["classes"][0]["cancelled"] == ["Assembly", "PE", "Recess"]
    assert f["classes"][0]["made_indoor"] == []
    f2 = notice.facts(bad_day_plan("indoors"), "School")
    assert f2["classes"][0]["made_indoor"] == ["Assembly", "PE", "Recess"]
    assert f2["classes"][0]["cancelled"] == []


def test_notice_template_for_cancel():
    f = notice.facts(bad_day_plan("cancel"), "School")
    n = notice.template(f)
    assert "cancel" in n["en"].lower() and "stay in class" in n["en"].lower()
    assert "रद्द" in n["hi"]
    assert notice.check(n, f) == []


def test_notice_template_for_indoors_unchanged():
    f = notice.facts(bad_day_plan("indoors"), "School")
    n = notice.template(f)
    assert "indoors" in n["en"].lower() and "cancel" not in n["en"].lower()


def test_check_rejects_ai_text_that_says_indoors_when_cancelled():
    f = notice.facts(bad_day_plan("cancel"), "School")
    pct = f["classes"][0]["reduction_pct"]
    wrong = {"en": f"All outdoor periods will be held indoors. Cut about {pct}%.",
             "hi": f"बाहर के सभी पीरियड अंदर होंगे। लगभग {pct}%।"}
    problems = notice.check(wrong, f)
    assert any("cancel" in p for p in problems) and any("रद्द" in p for p in problems)
    right = {"en": f"Outdoor activities are cancelled; children stay in class. Cut about {pct}%.",
             "hi": f"बाहर की गतिविधियाँ रद्द हैं। लगभग {pct}%।"}
    assert notice.check(right, f) == []
