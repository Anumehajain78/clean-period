"""Two views on a teacher's own timetable, built from the same dose engine.

outlook: the coming school days in the forecast, one plan per day.
winter:  last winter's real hourly air replayed against the timetable.
Pure Python: the caller fetches the air data.
"""

import statistics
from datetime import date, timedelta

from core import backtest, optimiser, thresholds

WEEKDAYS = ("monday", "tuesday", "wednesday", "thursday", "friday")


def school_dates(first, count):
    """`count` Monday-to-Friday dates from `first` (inclusive)."""
    d, out = date.fromisoformat(first), []
    while len(out) < count:
        if d.weekday() < 5:
            out.append(d.isoformat())
        d += timedelta(days=1)
    return out


def _outdoor_moves(plan):
    n = 0
    for c in plan["classes"]:
        outdoor = {p["subject"] for p in c["before"] if p["place"] == "ground"}
        n += sum(1 for m in c["moves"] if m["subject"] in outdoor)
    return n


def outlook(slots, classes, forecast_days, dates, config, ground_capacity=None):
    """One row per date: the plan's verdict and cut, and the air in school hours.

    A date the forecast does not fully cover is "no_forecast", never guessed.
    The planned date with the cleanest school-hours air is marked "cleanest".
    Raises ValueError if the timetable breaks a constraint.
    """
    used = {p["slot"] for c in classes for p in c["periods"]}
    unknown = used - {s["id"] for s in slots}
    if unknown:
        raise ValueError(f"period refers to unknown slot {sorted(unknown)[0]!r}")
    hours = thresholds.school_hours([s for s in slots if s["id"] in used])
    rows = []
    for d in dates:
        row = {"date": d, "weekday": date.fromisoformat(d).strftime("%A").lower()}
        values = forecast_days.get(d)
        if values is None or any(values[h] is None for h in hours) or not hours:
            rows.append({**row, "status": "no_forecast"})
            continue
        hourly = dict(enumerate(values))
        plan = optimiser.plan_day(slots, classes, hourly, config, ground_capacity=ground_capacity)
        school = [hourly[h] for h in hours]
        mean = statistics.mean(school)
        rows.append({
            **row,
            "status": "planned",
            "verdict": plan["verdict"],
            "reduction_pct": plan["reduction_pct"],
            "moved": _outdoor_moves(plan),
            "school_mean_pm25": mean,
            "school_max_pm25": max(school),
            "category": thresholds.pm25_category(mean, config),
            "hours": [{"hour": h, "pm25": hourly[h]} for h in hours],
        })
    planned = [r for r in rows if r["status"] == "planned"]
    if planned:
        min(planned, key=lambda r: r["school_mean_pm25"])["cleanest"] = True
    return rows


def winter(slots, classes, history, config, ground_capacity=None):
    """Replay `history` ({date: [24 values]}) with the same timetable every weekday.

    Weekends are skipped; holidays are not known for every place, so they are
    not removed (the caller says so).
    """
    tt = {
        "school": {"ground_capacity": ground_capacity},
        "slots": slots,
        "classes": [{"id": c["id"], "name": c["name"], "days": {d: c["periods"] for d in WEEKDAYS}}
                    for c in classes],
    }
    result = backtest.run(tt, history, {}, config)
    return {
        "summary": {k: result["summary"][k] for k in
                    ("school_days", "all_indoors_days", "season_reduction_pct", "mean_daily_reduction_pct")},
        "days": [{"date": d["date"], "reduction_pct": d["reduction_pct"], "verdict": d["verdict"]}
                 for d in result["days"]],
        "skipped": len(result["skipped"]),
        "hourly_profile": result["hourly_profile"],
    }
