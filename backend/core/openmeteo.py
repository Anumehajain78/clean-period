"""Open-Meteo Air Quality API: request URLs and response parsing.

Pure functions, no network calls; callers do the HTTP. Over India the data is
CAMS Global (~45 km grid, 3-hourly steps returned as hourly values).
Licence CC BY 4.0: credit Open-Meteo and CAMS wherever the numbers are shown.
"""

from datetime import date
from urllib.parse import urlencode

BASE_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"
ATTRIBUTION = "Open-Meteo Air Quality API (CC BY 4.0), CAMS Global data from Copernicus"
EXPECTED_UNIT = "μg/m³"
MAX_FORECAST_DAYS = 7


def _check_coords(lat, lon):
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise ValueError(f"invalid coordinates {lat}, {lon}")


def _url(lat, lon, timezone, **extra):
    _check_coords(lat, lon)
    params = {"latitude": lat, "longitude": lon, "hourly": "pm2_5", "timezone": timezone, **extra}
    return f"{BASE_URL}?{urlencode(params)}"


def history_url(lat, lon, start_date, end_date, timezone="Asia/Kolkata"):
    """URL for past hourly PM2.5, inclusive dates in YYYY-MM-DD."""
    if date.fromisoformat(start_date) > date.fromisoformat(end_date):
        raise ValueError(f"start {start_date} is after end {end_date}")
    return _url(lat, lon, timezone, start_date=start_date, end_date=end_date)


def forecast_url(lat, lon, days=2, timezone="Asia/Kolkata"):
    """URL for hourly PM2.5 forecast, today plus the following days."""
    if not 1 <= days <= MAX_FORECAST_DAYS:
        raise ValueError(f"forecast days must be 1 to {MAX_FORECAST_DAYS}, got {days}")
    return _url(lat, lon, timezone, forecast_days=days)


def hourly_by_date(response):
    """API JSON -> {"YYYY-MM-DD": {hour: pm25 or None}} in the requested timezone.

    Missing values stay None. They are never filled in.
    """
    if response.get("error"):
        raise ValueError(f"Open-Meteo error: {response.get('reason')}")
    unit = response.get("hourly_units", {}).get("pm2_5")
    if unit != EXPECTED_UNIT:
        raise ValueError(f"expected pm2_5 in {EXPECTED_UNIT}, got {unit!r}")
    times, values = response["hourly"]["time"], response["hourly"]["pm2_5"]
    if len(times) != len(values):
        raise ValueError("time and pm2_5 arrays differ in length")
    days = {}
    for t, v in zip(times, values):
        day, hhmm = t.split("T")
        days.setdefault(day, {})[int(hhmm[:2])] = v
    return days


def count_missing(days):
    return sum(v is None for hours in days.values() for v in hours.values())
