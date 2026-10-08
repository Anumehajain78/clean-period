"""Nightly plan for one saved school, and checks for a saved timetable.

Pure Python: the caller fetches the forecast and stores the result.
"""

from datetime import date

from core import dose, notice, planning

MAX_SLOTS = 20
MAX_CLASSES = 50


def _number(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def validate_timetable(tt):
    """Problems that stop a timetable from being saved, or []."""
    if not isinstance(tt, dict):
        return ["timetable must be an object"]
    problems = []
    school = tt.get("school")
    if not isinstance(school, dict):
        problems.append("school must be an object")
    else:
        if not isinstance(school.get("name", ""), str):
            problems.append("school name must be text")
        lat, lon = school.get("latitude"), school.get("longitude")
        if not _number(lat) or not -90 <= lat <= 90:
            problems.append("school latitude must be a number from -90 to 90")
        if not _number(lon) or not -180 <= lon <= 180:
            problems.append("school longitude must be a number from -180 to 180")

    slots = tt.get("slots")
    slot_ids = set()
    if not isinstance(slots, list) or not 0 < len(slots) <= MAX_SLOTS:
        problems.append(f"slots must be a list of 1 to {MAX_SLOTS} periods")
    else:
        for s in slots:
            try:
                if dose.parse_hhmm(s["end"]) <= dose.parse_hhmm(s["start"]):
                    raise ValueError
                if not isinstance(s["id"], str) or s["id"] in slot_ids:
                    raise ValueError
                slot_ids.add(s["id"])
            except (ValueError, KeyError, TypeError):
                problems.append(f"slot {s!r} needs a unique id and a start before its end (HH:MM)")

    classes = tt.get("classes")
    if not isinstance(classes, list) or not 0 < len(classes) <= MAX_CLASSES:
        problems.append(f"classes must be a list of 1 to {MAX_CLASSES} classes")
        return problems
    for c in classes:
        if not isinstance(c, dict) or not isinstance(c.get("id"), str) or not isinstance(c.get("name"), str):
            problems.append("every class needs an id and a name")
            continue
        days = c.get("days")
        if not isinstance(days, dict):
            problems.append(f"class {c['name']}: days must be an object of weekday to periods")
            continue
        for day, periods in days.items():
            if not isinstance(periods, list) or len(periods) > MAX_SLOTS:
                problems.append(f"class {c['name']}, {day}: periods must be a list")
                continue
            for p in periods:
                if not isinstance(p, dict) or p.get("slot") not in slot_ids:
                    problems.append(f"class {c['name']}, {day}: period refers to an unknown slot")
                elif not isinstance(p.get("subject"), str) or not isinstance(p.get("activity"), str):
                    problems.append(f"class {c['name']}, {day}: period needs a subject and an activity")
    return problems


def classes_for_day(tt, weekday):
    """Classes with at least one period on that weekday, in /plan's shape."""
    return [{"id": c["id"], "name": c["name"], "periods": c["days"][weekday]}
            for c in tt["classes"] if c["days"].get(weekday)]


def run_school(tt, forecast, day, config):
    """Plan `day` for one school.

    forecast: {"days": {date: [24 values]}, "source", "grid_point", "fetched_at", "cached"}.
    Returns {"date", "status": "planned" | "no_school" | "error", ...}. Never raises
    for a bad timetable or a missing forecast day, so one school can't stop the run.
    """
    weekday = date.fromisoformat(day).strftime("%A").lower()
    classes = classes_for_day(tt, weekday)
    if not classes:
        return {"date": day, "status": "no_school", "reason": f"No lessons on {weekday}"}
    if day not in forecast["days"]:
        return {"date": day, "status": "error", "reason": f"no forecast for {day}"}
    try:
        plan = planning.plan_response(day, tt["slots"], classes, dict(enumerate(forecast["days"][day])),
                                      forecast, config, ground_capacity=tt["school"].get("ground_capacity"))
    except ValueError as e:
        return {"date": day, "status": "error", "reason": str(e)}
    text = notice.template(notice.facts(plan, tt["school"].get("name", "")))
    return {"date": day, "status": "planned", "plan": plan, "notice": {**text, "source": "template"}}
