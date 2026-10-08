"""Inhaled PM2.5 dose for school periods.

dose (ug) = PM2.5 (ug/m3) x exposure_factor x inhalation_rate (m3/min) x minutes

Pure Python, no AWS. Every number comes from config/dose_config.json.

PM2.5 is passed as {hour: ug/m3} for one day, local time. The value for hour h
stands for the whole of h:00 to h:59. A period that crosses an hour boundary
is weighted by the minutes it spends in each hour.
"""

import json
import re
from pathlib import Path

DEFAULT_CONFIG_PATH = Path(__file__).resolve().parents[1] / "config" / "dose_config.json"

_HHMM = re.compile(r"^([01]\d|2[0-3]):([0-5]\d)$")


def load_config(path=None):
    """Read the dose config JSON. Defaults to backend/config/dose_config.json."""
    return json.loads(Path(path or DEFAULT_CONFIG_PATH).read_text())


def parse_hhmm(text):
    """'07:40' -> minutes since midnight (460)."""
    m = _HHMM.match(text or "")
    if not m:
        raise ValueError(f"time must be HH:MM, got {text!r}")
    return int(m.group(1)) * 60 + int(m.group(2))


def minutes_by_hour(start, end):
    """Split a period into (hour, minutes) pieces, e.g. 08:40-09:20 -> [(8, 20), (9, 20)]."""
    t, stop = parse_hhmm(start), parse_hhmm(end)
    if stop <= t:
        raise ValueError(f"period must end after it starts: {start}-{end}")
    pieces = []
    while t < stop:
        hour = t // 60
        nxt = min(stop, (hour + 1) * 60)
        pieces.append((hour, nxt - t))
        t = nxt
    return pieces


def activity_profile(activity, config):
    """Activity name -> (intensity, indoors)."""
    try:
        a = config["activities"][activity]
    except KeyError:
        raise ValueError(f"unknown activity {activity!r}") from None
    return a["intensity"], a["indoors"]


def exposure_factor(indoors, config):
    return config["exposure_factor"]["indoor" if indoors else "outdoor"]


def inhalation_rate(intensity, config):
    return config["inhalation_rate_m3_min"][intensity]


def period_dose(pm25_by_hour, start, end, activity, config):
    """Inhaled PM2.5 in micrograms for one period.

    Raises ValueError if any hour the period touches has no PM2.5 value: a
    missing forecast hour is never filled with a guess.
    """
    intensity, indoors = activity_profile(activity, config)
    per_minute = exposure_factor(indoors, config) * inhalation_rate(intensity, config)
    total = 0.0
    for hour, minutes in minutes_by_hour(start, end):
        pm = pm25_by_hour.get(hour)
        if pm is None:
            raise ValueError(f"no PM2.5 value for hour {hour:02d}:00")
        if pm < 0:
            raise ValueError(f"negative PM2.5 {pm} at hour {hour:02d}:00")
        total += pm * per_minute * minutes
    return total


def periods_with_times(slots, periods):
    """Return copies of a class day's periods with each slot's start and end added."""
    by_id = {s["id"]: s for s in slots}
    out = []
    for p in periods:
        slot = by_id.get(p["slot"])
        if slot is None:
            raise ValueError(f"period refers to unknown slot {p['slot']!r}")
        out.append({**p, "start": slot["start"], "end": slot["end"]})
    return out


def day_dose(periods, pm25_by_hour, config):
    """Dose for every period of one class day, plus the day total.

    `periods` need start, end and activity (see periods_with_times).
    """
    rows = [
        {**p, "dose_ug": period_dose(pm25_by_hour, p["start"], p["end"], p["activity"], config)}
        for p in periods
    ]
    return {"periods": rows, "total_ug": sum(r["dose_ug"] for r in rows)}


def reduction_pct(before_ug, after_ug):
    """Percentage dose cut from before to after. 0 when there was no dose."""
    if before_ug <= 0:
        return 0.0
    return (before_ug - after_ug) / before_ug * 100.0
