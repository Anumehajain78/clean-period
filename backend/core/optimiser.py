"""Rearrange one school day's periods to cut total inhaled PM2.5 dose.

Version 1: greedy local search over swaps. Within each class, any two movable
periods in slots of the same length may swap. Each round applies the single
feasible swap that lowers the school's total dose the most, until no swap helps.
Deterministic: ties go to the first candidate in input order.

Among slots of equal length, a period's dose is (activity rate) x (slot
pollution). Swapping any out-of-order pair helps, so for one class without
clashes this ends at the best possible order.

Constraints:
- a teacher is in at most one class per slot
- at most `ground_capacity` classes have a movable ground period in one slot.
  Fixed whole-school slots (assembly, recess) are not counted.
- fixed periods never move; each class keeps the same set of periods.

Bad day: if the all-indoors rule triggers, every outdoor period becomes indoor
activity and nothing is reordered.
"""

from core import dose, thresholds

EPS = 1e-9


def _check(slot_ids, classes, assign, ground_capacity):
    """Raise ValueError on the first broken constraint."""
    teachers, ground = {}, {}
    for c, cls in enumerate(classes):
        used = set()
        for i, p in enumerate(cls["periods"]):
            s = assign[c][i]
            if s not in slot_ids:
                raise ValueError(f"class {cls['id']}: unknown slot {s!r}")
            if s in used:
                raise ValueError(f"class {cls['id']}: two periods in slot {s!r}")
            used.add(s)
            t = p.get("teacher")
            if t:
                other = teachers.setdefault((s, t), cls["id"])
                if other != cls["id"]:
                    raise ValueError(f"teacher {t} is in classes {other} and {cls['id']} in slot {s!r}")
            if p["movable"] and p["place"] == "ground":
                ground[s] = ground.get(s, 0) + 1
                if ground[s] > ground_capacity:
                    raise ValueError(f"more than {ground_capacity} classes on the ground in slot {s!r}")


def _rows(slots, periods, assign_c, pm25_by_hour, config):
    """Periods placed in their slots, with times and doses, in slot order."""
    order = {s["id"]: k for k, s in enumerate(slots)}
    placed = [{**p, "slot": s} for p, s in zip(periods, assign_c)]
    placed.sort(key=lambda p: order[p["slot"]])
    return dose.day_dose(dose.periods_with_times(slots, placed), pm25_by_hour, config)


def _class_result(cls, before, after, moves):
    return {
        "id": cls["id"], "name": cls.get("name", cls["id"]),
        "before": before["periods"], "after": after["periods"],
        "before_ug": before["total_ug"], "after_ug": after["total_ug"],
        "reduction_pct": dose.reduction_pct(before["total_ug"], after["total_ug"]),
        "moves": moves,
    }


def _plan(verdict, results):
    before = sum(r["before_ug"] for r in results)
    after = sum(r["after_ug"] for r in results)
    return {"verdict": verdict, "classes": results, "total_before_ug": before,
            "total_after_ug": after, "reduction_pct": dose.reduction_pct(before, after)}


def plan_day(slots, classes, pm25_by_hour, config, ground_capacity=None):
    """Plan one school day.

    slots:   [{"id", "start", "end"}], shared by all classes
    classes: [{"id", "name", "periods": [{"slot", "subject", "activity",
              "teacher", "place", "movable"}]}]
    Returns before/after timetables with doses, moves and percentage cuts.
    """
    if ground_capacity is None:
        ground_capacity = config["ground_capacity_default"]
    slot_ids = {s["id"] for s in slots}
    assign = [[p["slot"] for p in cls["periods"]] for cls in classes]
    _check(slot_ids, classes, assign, ground_capacity)

    befores = [_rows(slots, cls["periods"], assign[c], pm25_by_hour, config)
               for c, cls in enumerate(classes)]

    all_periods = [p for b in befores for p in b["periods"]]
    if thresholds.needs_all_indoors(pm25_by_hour, all_periods, config):
        results = []
        for cls, before in zip(classes, befores):
            indoor = thresholds.to_all_indoors(before["periods"], config)
            after = dose.day_dose(indoor, pm25_by_hour, config)
            results.append(_class_result(cls, before, after, []))
        return _plan("all_indoors", results)

    length = {s["id"]: dose.parse_hhmm(s["end"]) - dose.parse_hhmm(s["start"]) for s in slots}
    times = {s["id"]: (s["start"], s["end"]) for s in slots}
    cache = {}

    def cost(p, s):
        key = (p["activity"], s)
        if key not in cache:
            cache[key] = dose.period_dose(pm25_by_hour, *times[s], p["activity"], config)
        return cache[key]

    while True:
        best = None
        for c, cls in enumerate(classes):
            ps = cls["periods"]
            movable = [i for i, p in enumerate(ps) if p["movable"]]
            for x, i in enumerate(movable):
                for j in movable[x + 1:]:
                    si, sj = assign[c][i], assign[c][j]
                    if length[si] != length[sj] or ps[i]["activity"] == ps[j]["activity"]:
                        continue
                    delta = (cost(ps[i], sj) + cost(ps[j], si)) - (cost(ps[i], si) + cost(ps[j], sj))
                    if delta >= -EPS or (best and delta >= best[0] - EPS):
                        continue
                    assign[c][i], assign[c][j] = sj, si
                    try:
                        _check(slot_ids, classes, assign, ground_capacity)
                        best = (delta, c, i, j)
                    except ValueError:
                        pass
                    assign[c][i], assign[c][j] = si, sj
        if best is None:
            break
        _, c, i, j = best
        assign[c][i], assign[c][j] = assign[c][j], assign[c][i]

    results = []
    for c, cls in enumerate(classes):
        after = _rows(slots, cls["periods"], assign[c], pm25_by_hour, config)
        moves = [{"subject": p["subject"], "from_slot": p["slot"], "to_slot": s}
                 for p, s in zip(cls["periods"], assign[c]) if p["slot"] != s]
        results.append(_class_result(cls, befores[c], after, moves))
    return _plan("reorder", results)
