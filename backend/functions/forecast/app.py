"""GET /forecast?lat=..&lon=..[&date=YYYY-MM-DD][&timezone=Asia/Kolkata]

Hourly PM2.5 forecast for one day at a location. Defaults to tomorrow there.
"""

from core import openmeteo
from functions.common import forecast as fc
from functions.common.http import BadRequest, coords, error, respond

NOTE = "Area-level model forecast (CAMS Global, ~45 km grid), not a street-level measurement."


def handle(event, get_forecast, now=None):
    q = event.get("queryStringParameters") or {}
    try:
        lat, lon = coords(q.get("lat"), q.get("lon"))
        tz = q.get("timezone", "Asia/Kolkata")
        forecast = get_forecast(lat, lon, tz)
        day = q.get("date") or fc.local_tomorrow(forecast["utc_offset_seconds"], now=now)
        if day not in forecast["days"]:
            raise BadRequest(f"no forecast for {day}; available: {', '.join(forecast['days'])}")
    except BadRequest as e:
        return error(400, str(e))
    except fc.UpstreamError as e:
        return error(502, str(e))

    return respond(200, {
        "date": day,
        "timezone": tz,
        "pm25_hourly": forecast["days"][day],
        "unit": openmeteo.EXPECTED_UNIT,
        "grid_point": forecast["grid_point"],
        "fetched_at": forecast["fetched_at"],
        "cached": forecast["cached"],
        "source": forecast["source"],
        "note": NOTE,
    })


_CACHE = fc.cache_from_env()


def handler(event, context):
    return handle(event, lambda lat, lon, tz: fc.get_forecast(lat, lon, tz, cache=_CACHE))
