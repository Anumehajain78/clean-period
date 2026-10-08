import copy
import itertools
import json
from pathlib import Path

import pytest

from core import dose, optimiser

REPO = Path(__file__).resolve().parents[2]
CONFIG = dose.load_config()

# Test fixture: morning dirty, afternoon cleaner, all above zero.
DIRTY_MORNING = {7: 240.0, 8: 236.0, 9: 219.0, 10: 183.0, 11: 133.0, 12: 99.0, 13: 82.0, 14: 75.0}

SLOTS = [
    {"id": "a", "start": "08:00", "end": "08:20"},   # 20 min, fixed assembly
    {"id": "1", "start": "08:20", "end": "09:00"},
    {"id": "2", "start": "09:00", "end": "09:40"},
    {"id": "3", "start": "09:40", "end": "10:20"},
    {"id": "r", "start": "10:20", "end": "10:40"},   # 20 min, fixed recess
    {"id": "4", "start": "10:40", "end": "11:20"},
    {"id": "5", "start": "11:20", "end": "12:00"},
    {"id": "6", "start": "12:00", "end": "12:40"},
]


def per(slot, subject, teacher=None, activity="classroom", place="classroom", movable=True):
    return {"slot": slot, "subject": subject, "activity": activity, "teacher": teacher,
            "place": place, "movable": movable}


def pe(slot, teacher="T-PE", subject="PE"):
    return per(slot, subject, teacher, activity="pe", place="ground")


def fixed_slots():
    return [per("a", "Assembly", activity="assembly", place="ground", movable=False),
            per("r", "Recess", activity="recess", place="ground", movable=False)]


def one_class(cid, lessons):
    return {"id": cid, "name": cid, "periods": fixed_slots() + lessons}


def class_a():
    return one_class("A", [pe("1"), per("2", "Maths", "T-M"), per("3", "English", "T-E"),
                           per("4", "Hindi", "T-H"), per("5", "Science", "T-S"), per("6", "Art", "T-A")])


def slot_of(plan, cid, subject):
    cls = next(c for c in plan["classes"] if c["id"] == cid)
    return [p["slot"] for p in cls["after"] if p["subject"] == subject]


def teacher_clashes(plan):
    seen = {}
    for c in plan["classes"]:
        for p in c["after"]:
            if p["teacher"]:
                seen.setdefault((p["slot"], p["teacher"]), []).append(c["id"])
    return {k: v for k, v in seen.items() if len(v) > 1}


# --- single class -----------------------------------------------------------

def test_pe_moves_to_cleanest_slot():
    plan = optimiser.plan_day(SLOTS, [class_a()], DIRTY_MORNING, CONFIG)
    assert plan["verdict"] == "reorder"
    assert slot_of(plan, "A", "PE") == ["6"]
    c = plan["classes"][0]
    assert c["after_ug"] < c["before_ug"]
    assert c["reduction_pct"] == pytest.approx(dose.reduction_pct(c["before_ug"], c["after_ug"]))
    assert {"subject": "PE", "from_slot": "1", "to_slot": "6"} in c["moves"]


def test_same_set_of_periods_only_order_changes():
    before = class_a()
    plan = optimiser.plan_day(SLOTS, [before], DIRTY_MORNING, CONFIG)
    after = plan["classes"][0]["after"]
    key = lambda p: (p["subject"], p["teacher"], p["activity"])
    assert sorted(map(key, after)) == sorted(map(key, before["periods"]))
    assert sorted(p["slot"] for p in after) == sorted(s["id"] for s in SLOTS)


def test_after_is_in_slot_order_with_times_and_doses():
    plan = optimiser.plan_day(SLOTS, [class_a()], DIRTY_MORNING, CONFIG)
    after = plan["classes"][0]["after"]
    assert [p["slot"] for p in after] == [s["id"] for s in SLOTS]
    assert after[0]["start"] == "08:00" and "dose_ug" in after[0]
    assert sum(p["dose_ug"] for p in after) == pytest.approx(plan["classes"][0]["after_ug"])


def test_fixed_periods_never_move():
    plan = optimiser.plan_day(SLOTS, [class_a()], DIRTY_MORNING, CONFIG)
    assert slot_of(plan, "A", "Assembly") == ["a"]
    assert slot_of(plan, "A", "Recess") == ["r"]


def test_fixed_outdoor_period_is_not_swapped_even_if_it_would_help():
    cls = one_class("A", [per("1", "Maths", "T-M"), per("2", "English", "T-E"), per("3", "Hindi", "T-H"),
                          per("4", "Science", "T-S"), per("5", "Art", "T-A"),
                          per("6", "Match", "T-PE", activity="pe", place="ground", movable=False)])
    plan = optimiser.plan_day(SLOTS, [cls], DIRTY_MORNING, CONFIG)
    assert slot_of(plan, "A", "Match") == ["6"]


def test_no_swap_between_slots_of_different_length():
    # Only a 20-minute slot is cleaner, PE (40 min) must not go there.
    slots = [{"id": "x", "start": "08:00", "end": "08:40"},
             {"id": "y", "start": "08:40", "end": "09:20"},
             {"id": "z", "start": "13:00", "end": "13:20"}]
    cls = {"id": "A", "name": "A", "periods": [pe("x"), per("y", "Maths", "T-M"),
                                               per("z", "Reading", "T-R")]}
    pm = {8: 300.0, 9: 300.0, 13: 10.0}
    plan = optimiser.plan_day(slots, [cls], pm, CONFIG)
    assert slot_of(plan, "A", "PE") == ["x"]


def test_flat_pollution_means_no_moves():
    plan = optimiser.plan_day(SLOTS, [class_a()], {h: 100.0 for h in range(24)}, CONFIG)
    c = plan["classes"][0]
    assert c["moves"] == []
    assert c["reduction_pct"] == 0.0


def test_matches_brute_force_for_one_class():
    cls = one_class("A", [pe("1"), per("2", "Maths", "T-M"), pe("3", subject="Games"),
                          per("4", "Hindi", "T-H"), per("5", "Yoga", "T-PE", activity="indoor_activity"),
                          per("6", "Art", "T-A")])
    pm = {7: 50.0, 8: 300.0, 9: 120.0, 10: 260.0, 11: 40.0, 12: 180.0, 13: 90.0}
    plan = optimiser.plan_day(SLOTS, [cls], pm, CONFIG)

    movable = [p for p in cls["periods"] if p["movable"]]
    fixed = [p for p in cls["periods"] if not p["movable"]]
    slot_ids = [p["slot"] for p in movable]
    best = None
    for perm in itertools.permutations(slot_ids):
        periods = fixed + [{**p, "slot": s} for p, s in zip(movable, perm)]
        total = dose.day_dose(dose.periods_with_times(SLOTS, periods), pm, CONFIG)["total_ug"]
        best = total if best is None else min(best, total)
    assert plan["classes"][0]["after_ug"] == pytest.approx(best)


# --- several classes --------------------------------------------------------

def test_shared_teacher_is_never_double_booked():
    a = class_a()
    b = one_class("B", [per("1", "Maths", "T-M2"), per("2", "English", "T-E2"), per("3", "Hindi", "T-H2"),
                        pe("4"), per("5", "Science", "T-S2"), per("6", "Art", "T-A2")])
    plan = optimiser.plan_day(SLOTS, [a, b], DIRTY_MORNING, CONFIG, ground_capacity=2)
    assert teacher_clashes(plan) == {}
    # One of them gets the cleanest slot, the other the next cleanest.
    assert sorted(slot_of(plan, "A", "PE") + slot_of(plan, "B", "PE")) == ["5", "6"]


def test_ground_capacity_is_respected():
    a = class_a()
    b = one_class("B", [pe("1", teacher="T-PE2"), per("2", "Maths", "T-M2"), per("3", "English", "T-E2"),
                        per("4", "Hindi", "T-H2"), per("5", "Science", "T-S2"), per("6", "Art", "T-A2")])
    a["periods"][2] = pe("2")          # move A's PE off slot 1 so the input is valid
    a["periods"][3] = per("1", "Maths", "T-M")
    one = optimiser.plan_day(SLOTS, [a, b], DIRTY_MORNING, CONFIG, ground_capacity=1)
    pe_slots = slot_of(one, "A", "PE") + slot_of(one, "B", "PE")
    assert len(set(pe_slots)) == 2
    two = optimiser.plan_day(SLOTS, [a, b], DIRTY_MORNING, CONFIG, ground_capacity=2)
    assert slot_of(two, "A", "PE") == slot_of(two, "B", "PE") == ["6"]
    assert two["total_after_ug"] < one["total_after_ug"]


def test_ground_capacity_does_not_count_fixed_whole_school_slots():
    a, b = class_a(), one_class("B", [per(s, f"S{s}", f"T{s}B") for s in "123456"])
    plan = optimiser.plan_day(SLOTS, [a, b], DIRTY_MORNING, CONFIG, ground_capacity=1)
    assert plan["verdict"] == "reorder"


def test_ground_capacity_defaults_to_config():
    cfg = {**CONFIG, "ground_capacity_default": 1}
    a = class_a()
    b = one_class("B", [pe("1", teacher="T-PE2")] + [per(s, f"S{s}", f"T{s}B") for s in "23456"])
    with pytest.raises(ValueError, match="ground"):
        optimiser.plan_day(SLOTS, [a, b], DIRTY_MORNING, cfg)


def test_school_totals():
    a = class_a()
    b = one_class("B", [per("1", "Maths", "T-M2"), pe("2", teacher="T-PE2")] +
                  [per(s, f"S{s}", f"T{s}B") for s in "3456"])
    plan = optimiser.plan_day(SLOTS, [a, b], DIRTY_MORNING, CONFIG, ground_capacity=2)
    assert plan["total_before_ug"] == pytest.approx(sum(c["before_ug"] for c in plan["classes"]))
    assert plan["total_after_ug"] == pytest.approx(sum(c["after_ug"] for c in plan["classes"]))
    assert plan["reduction_pct"] == pytest.approx(
        dose.reduction_pct(plan["total_before_ug"], plan["total_after_ug"]))


# --- input checks -----------------------------------------------------------

def test_rejects_teacher_clash_in_input():
    a = class_a()
    b = one_class("B", [pe("1")] + [per(s, f"S{s}", f"T{s}B") for s in "23456"])
    with pytest.raises(ValueError, match="T-PE"):
        optimiser.plan_day(SLOTS, [a, b], DIRTY_MORNING, CONFIG, ground_capacity=5)


def test_rejects_two_periods_in_one_slot():
    cls = class_a()
    cls["periods"][4]["slot"] = "2"   # English joins Maths in slot 2
    with pytest.raises(ValueError, match="slot"):
        optimiser.plan_day(SLOTS, [cls], DIRTY_MORNING, CONFIG)


def test_rejects_unknown_slot():
    cls = class_a()
    cls["periods"][3]["slot"] = "nope"
    with pytest.raises(ValueError):
        optimiser.plan_day(SLOTS, [cls], DIRTY_MORNING, CONFIG)


def test_does_not_mutate_input():
    cls = class_a()
    snapshot = copy.deepcopy(cls)
    optimiser.plan_day(SLOTS, [cls], DIRTY_MORNING, CONFIG)
    assert cls == snapshot


def test_deterministic():
    p1 = optimiser.plan_day(SLOTS, [class_a()], DIRTY_MORNING, CONFIG)
    p2 = optimiser.plan_day(SLOTS, [class_a()], DIRTY_MORNING, CONFIG)
    assert p1 == p2


# --- bad day ----------------------------------------------------------------

def test_all_indoors_day():
    pm = {h: 300.0 for h in range(24)}
    plan = optimiser.plan_day(SLOTS, [class_a()], pm, CONFIG)
    assert plan["verdict"] == "all_indoors"
    after = plan["classes"][0]["after"]
    assert all(p["place"] == "classroom" for p in after)
    assert [p["subject"] for p in after] == [p["subject"] for p in plan["classes"][0]["before"]]
    pe_row = next(p for p in after if p["subject"] == "PE")
    assert pe_row["activity"] == "indoor_activity" and pe_row["converted_from"] == "pe"
    assert plan["classes"][0]["moves"] == []
    assert plan["reduction_pct"] > 0


# --- real timetable shapes --------------------------------------------------

def test_sample_timetable_monday():
    tt = json.loads((REPO / "data" / "sample_timetable.json").read_text())
    cls = tt["classes"][0]
    classes = [{"id": cls["id"], "name": cls["name"], "periods": cls["days"]["monday"]}]
    plan = optimiser.plan_day(tt["slots"], classes, DIRTY_MORNING, CONFIG)
    assert slot_of(plan, "6B", "PE") == ["p8"]
    assert slot_of(plan, "6B", "Assembly") == ["assembly"]
    assert slot_of(plan, "6B", "Recess") == ["recess"]
    assert plan["reduction_pct"] > 20
