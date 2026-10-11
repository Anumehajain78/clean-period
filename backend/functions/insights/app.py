"""Views on a teacher's own timetable.

POST /outlook   the coming school days: one plan per day from the 7-day forecast
POST /backtest  last winter's real hourly air replayed against the timetable

Body for both: same as POST /plan (school, slots, classes).
"""

from core import dose, insights, labels
from functions.common import forecast as fc
from functions.common.http import BadRequest, coords, error, json_body, respond

WINTER = ("2025-11-01", "2026-01-31")
OUTLOOK_SCHOOL_DAYS = 5

NOTE_SAME_DAY = "The same timetable is used for every weekday of last winter."
NOTE_HOLIDAYS = "Weekends are skipped; holidays are not removed, because they differ by school and state."
NOTE_SAME_DAY_HI = "पिछली सर्दी के हर कार्यदिवस के लिए यही समय-सारणी ली गई है।"
NOTE_HOLIDAYS_HI = "शनिवार-रविवार छोड़े गए हैं; छुट्टियाँ नहीं हटाई गईं, क्योंकि वे हर स्कूल और राज्य में अलग होती हैं।"


def _request(event):
    body = json_body(event)
    school, slots, classes = body.get("school"), body.get("slots"), body.get("classes")
    if not isinstance(school, dict) or not isinstance(slots, list) or not isinstance(classes, list) or not classes:
        raise BadRequest("body needs school (object), slots (list) and classes (list)")
    lat, lon = coords(school.get("latitude"), school.get("longitude"))
    return school, slots, classes, lat, lon, school.get("timezone") or "Asia/Kolkata"


def _labels(config):
    return {"label": labels.ESTIMATE_LABEL, "label_hi": labels.ESTIMATE_LABEL_HI}


def handle(event, get_forecast, get_history, config, now=None):
    route = event.get("routeKey", "")
    if route not in ("POST /outlook", "POST /backtest"):
        return error(404, "not found")
    try:
        school, slots, classes, lat, lon, tz = _request(event)
        cap = school.get("ground_capacity")
        if route == "POST /outlook":
            forecast = get_forecast(lat, lon, tz, days=7)
            first = fc.local_tomorrow(forecast["utc_offset_seconds"], now=now)
            dates = insights.school_dates(first, OUTLOOK_SCHOOL_DAYS)
            rows = insights.outlook(slots, classes, forecast["days"], dates, config, ground_capacity=cap)
            return respond(200, {
                "days": rows,
                "source": forecast["source"],
                "grid_point": forecast["grid_point"],
                "fetched_at": forecast["fetched_at"],
                "category_note": config["pm25_categories"]["note"],
                **_labels(config),
            })

        hist = get_history(lat, lon, tz, *WINTER)
        result = insights.winter(slots, classes, hist["days"], config, ground_capacity=cap)
    except (BadRequest, ValueError, KeyError, TypeError) as e:
        return error(400, f"missing field {e}" if isinstance(e, KeyError) else str(e))
    except fc.UpstreamError as e:
        return error(502, str(e))

    return respond(200, {
        **result,
        "period": {"start": WINTER[0], "end": WINTER[1]},
        "source": hist["source"],
        "grid_point": hist["grid_point"],
        "assumptions": labels.assumptions(config) + [NOTE_SAME_DAY, NOTE_HOLIDAYS],
        "assumptions_hi": labels.assumptions_hi(config) + [NOTE_SAME_DAY_HI, NOTE_HOLIDAYS_HI],
        **_labels(config),
    })


_CONFIG = dose.load_config()
_CACHE = fc.cache_from_env()


def handler(event, context):
    return handle(
        event,
        lambda lat, lon, tz, days=fc.FORECAST_DAYS: fc.get_forecast(lat, lon, tz, cache=_CACHE, days=days),
        lambda lat, lon, tz, start, end: fc.get_history(lat, lon, tz, start, end, cache=_CACHE),
        _CONFIG,
    )
