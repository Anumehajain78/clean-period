from urllib.parse import parse_qs, urlparse

import pytest

from core import openmeteo


def query(url):
    return {k: v[0] for k, v in parse_qs(urlparse(url).query).items()}


def test_history_url():
    url = openmeteo.history_url(28.5629, 77.1678, "2025-11-01", "2026-01-31")
    assert url.startswith("https://air-quality-api.open-meteo.com/v1/air-quality?")
    q = query(url)
    assert q == {"latitude": "28.5629", "longitude": "77.1678", "hourly": "pm2_5",
                 "timezone": "Asia/Kolkata", "start_date": "2025-11-01", "end_date": "2026-01-31"}


def test_history_url_other_timezone():
    q = query(openmeteo.history_url(26.85, 80.95, "2025-12-01", "2025-12-02", timezone="UTC"))
    assert q["timezone"] == "UTC"


def test_history_url_rejects_bad_dates():
    with pytest.raises(ValueError):
        openmeteo.history_url(28.5, 77.1, "2026-01-31", "2025-11-01")
    with pytest.raises(ValueError):
        openmeteo.history_url(28.5, 77.1, "2025-13-01", "2025-12-01")


@pytest.mark.parametrize("lat,lon", [(91, 0), (-91, 0), (0, 181), (0, -181)])
def test_rejects_bad_coordinates(lat, lon):
    with pytest.raises(ValueError):
        openmeteo.history_url(lat, lon, "2025-11-01", "2025-11-02")
    with pytest.raises(ValueError):
        openmeteo.forecast_url(lat, lon)


def test_forecast_url():
    q = query(openmeteo.forecast_url(28.5629, 77.1678, days=2))
    assert q["forecast_days"] == "2"
    assert q["hourly"] == "pm2_5"
    assert "start_date" not in q


@pytest.mark.parametrize("days", [0, 8])
def test_forecast_url_days_range(days):
    with pytest.raises(ValueError):
        openmeteo.forecast_url(28.5, 77.1, days=days)


def response(times, values, unit="μg/m³"):
    return {"latitude": 28.6, "longitude": 77.2, "timezone": "Asia/Kolkata",
            "hourly_units": {"time": "iso8601", "pm2_5": unit},
            "hourly": {"time": times, "pm2_5": values}}


def test_hourly_by_date_groups_days_and_hours():
    r = response(["2025-12-15T07:00", "2025-12-15T08:00", "2025-12-16T00:00"], [240.1, 236.0, 99.0])
    assert openmeteo.hourly_by_date(r) == {
        "2025-12-15": {7: 240.1, 8: 236.0},
        "2025-12-16": {0: 99.0},
    }


def test_hourly_by_date_keeps_nulls_as_none():
    r = response(["2025-12-15T07:00"], [None])
    assert openmeteo.hourly_by_date(r) == {"2025-12-15": {7: None}}


def test_hourly_by_date_rejects_unexpected_unit():
    with pytest.raises(ValueError):
        openmeteo.hourly_by_date(response(["2025-12-15T07:00"], [1.0], unit="ppm"))


def test_hourly_by_date_rejects_api_error():
    with pytest.raises(ValueError, match="bad date"):
        openmeteo.hourly_by_date({"error": True, "reason": "bad date"})


def test_hourly_by_date_rejects_length_mismatch():
    with pytest.raises(ValueError):
        openmeteo.hourly_by_date(response(["2025-12-15T07:00", "2025-12-15T08:00"], [1.0]))


def test_count_missing():
    days = {"2025-12-15": {7: 1.0, 8: None}, "2025-12-16": {0: None}}
    assert openmeteo.count_missing(days) == 2
