"""POST /plan

Body: {"school": {"latitude", "longitude", "timezone"?, "ground_capacity"?},
       "slots": [...], "classes": [{"id", "name", "periods": [...]}],
       "date"?: "YYYY-MM-DD"}   (default: tomorrow at the school)

Fetches the PM2.5 forecast for that day and returns the before/after plan with
doses, the verdict, hourly air quality for school hours, sources and labels.
The plan comes from code only; no model is involved.
"""

from core import dose, planning
from functions.common import forecast as fc
from functions.common.http import BadRequest, coords, error, json_body, respond


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
        result = planning.plan_response(day, slots, classes, hourly, forecast, config,
                                        ground_capacity=school.get("ground_capacity"))
    except (BadRequest, ValueError, KeyError, TypeError) as e:
        msg = str(e) if not isinstance(e, KeyError) else f"missing field {e}"
        return error(400, msg)
    except fc.UpstreamError as e:
        return error(502, str(e))

    return respond(200, result)


_CONFIG = dose.load_config()
_CACHE = fc.cache_from_env()


def handler(event, context):
    return handle(event, lambda lat, lon, tz: fc.get_forecast(lat, lon, tz, cache=_CACHE), _CONFIG)
