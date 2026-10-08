"""PM2.5 categories and the bad-day "all indoors" rule.

The CPCB bands in config are defined for 24-hour averages. Applying them to
hourly forecast values is an approximation, and the UI must say so.
"""

from core.dose import activity_profile, minutes_by_hour


def pm25_category(value, config):
    """CPCB category name for a PM2.5 value in ug/m3."""
    if value < 0:
        raise ValueError(f"negative PM2.5 {value}")
    for band in config["pm25_categories"]["bands"]:
        if band["max"] is None or value <= band["max"]:
            return band["name"]
    raise ValueError("config has no open-ended top band")


def school_hours(periods):
    """Every clock hour that any period touches, sorted."""
    hours = {h for p in periods for h, _ in minutes_by_hour(p["start"], p["end"])}
    return sorted(hours)


def needs_all_indoors(pm25_by_hour, periods, config):
    """True when no school hour is at or below the all-indoors threshold."""
    limit = config["all_indoors_threshold_pm25"]
    for hour in school_hours(periods):
        pm = pm25_by_hour.get(hour)
        if pm is None:
            raise ValueError(f"no PM2.5 value for hour {hour:02d}:00")
        if pm <= limit:
            return False
    return True


def to_all_indoors(periods, config):
    """Copies of the periods with every outdoor one turned into indoor activity.

    Order and subjects are kept. Converted periods carry `converted_from`.
    """
    out = []
    for p in periods:
        _, indoors = activity_profile(p["activity"], config)
        if indoors:
            out.append(dict(p))
        else:
            out.append({**p, "activity": "indoor_activity", "place": "classroom",
                        "converted_from": p["activity"]})
    return out
