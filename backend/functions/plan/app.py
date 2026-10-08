"""POST /plan

Body: {"school": {"latitude", "longitude", "timezone"?, "ground_capacity"?},
       "slots": [...], "classes": [{"id", "name", "periods": [...]}],
       "date"?: "YYYY-MM-DD"}   (default: tomorrow at the school)

Fetches the PM2.5 forecast for that day and returns the before/after plan with
doses, the verdict, hourly air quality for school hours, sources and labels.
The plan comes from code only; no model is involved.
"""

from core import dose, labels, optimiser, thresholds
from functions.common import forecast as fc
from functions.common.http import BadRequest, coords, error, json_body, respond


def _air(slots, hourly, forecast, config):
    hours = thresholds.school_hours(slots)
    return {
        "hours": [{"hour": h, "pm25": hourly[h],
                   "category": thresholds.pm25_category(hourly[h], config) if hourly[h] is not None else None}
                  for h in hours],
        "unit": "μg/m³",
        "source": forecast["source"],
        "grid_point": forecast["grid_point"],
        "fetched_at": forecast["fetched_at"],
        "cached": forecast["cached"],
        "category_source": config["pm25_categories"]["source"],
        "category_note": config["pm25_categories"]["note"],
    }


def handle(event, get_forecast, config, now=None):
    try:
        body = json_body(event)
        school, slots, classes = body.get("school"), body.get("slots"), body.get("classes")
        if not isinstance(school, dict) or not isinstance(slots, list) or not isinstance(classes, list):
            raise BadRequest("body needs school (object), slots (list) and classes (list)")
        lat, lon = coords(school.get("latitude"), school.get("longitude"))
        tz = school.get("timezone") or "Asia/Kolkata"

        forecast = get_forecast(lat, lon, tz)
        day = body.get("date") or fc.local_tomorrow(forecast["utc_offset_seconds"], now=now)
        if day not in forecast["days"]:
            raise BadRequest(f"no forecast for {day}; available: {', '.join(forecast['days'])}")
        hourly = dict(enumerate(forecast["days"][day]))

        plan = optimiser.plan_day(slots, classes, hourly, config,
                                  ground_capacity=school.get("ground_capacity"))
        air = _air(slots, hourly, forecast, config)
    except (BadRequest, ValueError, KeyError, TypeError) as e:
        msg = str(e) if not isinstance(e, KeyError) else f"missing field {e}"
        return error(400, msg)
    except fc.UpstreamError as e:
        return error(502, str(e))

    return respond(200, {
        "date": day,
        **plan,
        "air": air,
        "assumptions": labels.assumptions(config),
        "label": labels.ESTIMATE_LABEL,
    })


_CONFIG = dose.load_config()
_CACHE = fc.cache_from_env()


def handler(event, context):
    return handle(event, lambda lat, lon, tz: fc.get_forecast(lat, lon, tz, cache=_CACHE), _CONFIG)
