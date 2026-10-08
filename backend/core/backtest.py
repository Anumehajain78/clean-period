"""Season backtest: original vs optimised timetable on real past PM2.5.

Pure functions, no file or network access; scripts/backtest.py does the I/O.
history is {"YYYY-MM-DD": [24 hourly PM2.5 values, None if missing]}.
"""

import statistics
from datetime import date, timedelta

from core import dose, optimiser, thresholds


def expand_closures(closures):
    """[{"date"} or {"start", "end"}, with "reason"] -> {"YYYY-MM-DD": reason}."""
    out = {}
    for c in closures:
        if "date" in c:
            out[c["date"]] = c["reason"]
            continue
        d, end = date.fromisoformat(c["start"]), date.fromisoformat(c["end"])
        if d > end:
            raise ValueError(f"closure starts after it ends: {c['start']} to {c['end']}")
        while d <= end:
            out[d.isoformat()] = c["reason"]
            d += timedelta(days=1)
    return out


def weekday_name(day):
    return date.fromisoformat(day).strftime("%A").lower()


def run(timetable, history, closed, config):
    """Plan every school day in history and summarise the dose cut.

    closed: {"YYYY-MM-DD": reason} for holidays (see expand_closures).
    Weekends, closures and days missing a school-hour PM2.5 value are skipped
    and listed with a reason; nothing is filled in.
    """
    slots = timetable["slots"]
    capacity = timetable["school"].get("ground_capacity")
    days, skipped, profile = [], [], {}

    for day in sorted(history):
        hourly = dict(enumerate(history[day]))
        weekday = weekday_name(day)
        if day in closed:
            skipped.append({"date": day, "reason": closed[day]})
            continue
        classes = [{"id": c["id"], "name": c["name"], "periods": c["days"][weekday]}
                   for c in timetable["classes"] if weekday in c["days"]]
        if not classes:
            skipped.append({"date": day, "reason": f"No classes on {weekday}"})
            continue
        used = {p["slot"] for c in classes for p in c["periods"]}
        hours = thresholds.school_hours([s for s in slots if s["id"] in used])
        missing = [h for h in hours if hourly.get(h) is None]
        if missing:
            skipped.append({"date": day, "reason": f"no PM2.5 for hour {missing[0]:02d}:00"})
            continue

        plan = optimiser.plan_day(slots, classes, hourly, config, ground_capacity=capacity)
        days.append({
            "date": day,
            "weekday": weekday,
            "verdict": plan["verdict"],
            "before_ug": plan["total_before_ug"],
            "after_ug": plan["total_after_ug"],
            "reduction_pct": plan["reduction_pct"],
            "school_hours_pm25_mean": statistics.mean(hourly[h] for h in hours),
            "moves": [{"class": c["id"], **m} for c in plan["classes"] for m in c["moves"]],
        })
        for h in hours:
            profile.setdefault(h, []).append(hourly[h])

    return {
        "summary": _summary(days),
        "days": days,
        "skipped": skipped,
        "hourly_profile": [{"hour": h, "median_pm25": statistics.median(v), "days": len(v)}
                           for h, v in sorted(profile.items())],
    }


def _summary(days):
    before = sum(d["before_ug"] for d in days)
    after = sum(d["after_ug"] for d in days)
    by_weekday = {}
    for d in sorted(days, key=lambda d: date.fromisoformat(d["date"]).weekday()):
        by_weekday.setdefault(d["weekday"], []).append(d["reduction_pct"])
    return {
        "school_days": len(days),
        "all_indoors_days": sum(d["verdict"] == "all_indoors" for d in days),
        "total_before_ug": before,
        "total_after_ug": after,
        "season_reduction_pct": dose.reduction_pct(before, after),
        "mean_daily_reduction_pct": statistics.mean(d["reduction_pct"] for d in days) if days else 0.0,
        "by_weekday": {w: {"days": len(v), "mean_reduction_pct": statistics.mean(v)}
                       for w, v in by_weekday.items()},
    }
