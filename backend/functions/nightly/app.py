"""Every evening at 19:00 IST (EventBridge Scheduler): plan tomorrow for every
saved school and store the result with a template parent notice.

One school's failure is stored as an error result and the run carries on.
"""

import time
from datetime import datetime, timezone

from core import dose, nightly
from functions.common import forecast as fc
from functions.common.store import store_from_env


def utc_offset(tz, now):
    """Seconds east of UTC for a timezone; used only when the forecast is unavailable."""
    try:
        from zoneinfo import ZoneInfo
        return int(ZoneInfo(tz).utcoffset(datetime.fromtimestamp(now, timezone.utc)).total_seconds())
    except Exception:  # no tz database in the runtime: India is the expected case
        return 19800 if tz == "Asia/Kolkata" else 0


def run(store, get_forecast, config, now=None):
    now = now if now is not None else time.time()
    summary = {"schools": 0, "planned": 0, "no_school": 0, "error": 0}
    for school_id in store.school_ids():
        saved = store.get_school(school_id)
        if saved is None:
            continue
        tt = saved["timetable"]
        school = tt["school"]
        tz = school.get("timezone") or "Asia/Kolkata"
        try:
            forecast = get_forecast(school["latitude"], school["longitude"], tz)
            day = fc.local_tomorrow(forecast["utc_offset_seconds"], now=now)
            result = nightly.run_school(tt, forecast, day, config)
        except (fc.UpstreamError, ValueError, KeyError, TypeError) as e:
            day = fc.local_tomorrow(utc_offset(tz, now), now=now)
            result = {"date": day, "status": "error", "reason": str(e) or type(e).__name__}
        store.put_result(school_id, result, now)
        summary["schools"] += 1
        summary[result["status"]] += 1
        if result["status"] == "error":
            print(f"nightly: school {school_id}: {result['reason']}")
    print(f"nightly: {summary}")
    return summary


_CONFIG = dose.load_config()


def handler(event, context):
    cache = fc.cache_from_env()
    return run(store_from_env(), lambda lat, lon, tz: fc.get_forecast(lat, lon, tz, cache=cache), _CONFIG)
