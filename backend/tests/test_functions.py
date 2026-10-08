import json
from datetime import datetime, timezone
from pathlib import Path

import pytest

from core import dose
from functions.common import forecast as fc
from functions.forecast import app as forecast_app
from functions.plan import app as plan_app

REPO = Path(__file__).resolve().parents[2]
CONFIG = dose.load_config()

# 2026-10-08 20:00 IST = 14:30 UTC, so "tomorrow" in India is 2026-10-09.
NOW = datetime(2026, 10, 8, 14, 30, tzinfo=timezone.utc).timestamp()

MORNING = [200.0] * 11 + [60.0] * 13   # hours 0-10 dirty, 11-23 cleaner


def fake_response(days=("2026-10-08", "2026-10-09", "2026-10-10"), values=MORNING):
    times = [f"{d}T{h:02d}:00" for d in days for h in range(24)]
    return {"latitude": 28.6, "longitude": 77.2, "utc_offset_seconds": 19800,
            "timezone": "Asia/Kolkata",
            "hourly_units": {"time": "iso8601", "pm2_5": "μg/m³"},
            "hourly": {"time": times, "pm2_5": list(values) * len(days)}}


class FakeCache:
    def __init__(self):
        self.items = {}

    def get(self, key):
        return self.items.get(key)

    def put(self, key, data, expires_at):
        self.items[key] = {"data": data, "expires_at": expires_at}


class Fetcher:
    def __init__(self, response):
        self.response, self.urls = response, []

    def __call__(self, url):
        self.urls.append(url)
        return self.response


# --- common/forecast --------------------------------------------------------

def test_local_tomorrow_uses_school_offset():
    assert fc.local_tomorrow(19800, now=NOW) == "2026-10-09"
    # 23:00 UTC on the 8th is already the 9th in India.
    late = datetime(2026, 10, 8, 23, 0, tzinfo=timezone.utc).timestamp()
    assert fc.local_tomorrow(19800, now=late) == "2026-10-10"
    assert fc.local_tomorrow(0, now=late) == "2026-10-09"


def test_get_forecast_fetches_and_shapes_days():
    fetch = Fetcher(fake_response())
    out = fc.get_forecast(28.5629, 77.1678, "Asia/Kolkata", cache=None, fetch=fetch, now=NOW)
    assert "forecast_days=3" in fetch.urls[0]
    assert sorted(out["days"]) == ["2026-10-08", "2026-10-09", "2026-10-10"]
    assert out["days"]["2026-10-09"][7] == 200.0
    assert out["utc_offset_seconds"] == 19800
    assert out["grid_point"] == {"latitude": 28.6, "longitude": 77.2}
    assert out["cached"] is False
    assert "Open-Meteo" in out["source"]


def test_get_forecast_uses_cache_until_expiry():
    cache, fetch = FakeCache(), Fetcher(fake_response())
    fc.get_forecast(28.5629, 77.1678, "Asia/Kolkata", cache=cache, fetch=fetch, now=NOW)
    hit = fc.get_forecast(28.5629, 77.1678, "Asia/Kolkata", cache=cache, fetch=fetch, now=NOW + 60)
    assert hit["cached"] is True and len(fetch.urls) == 1
    fc.get_forecast(28.5629, 77.1678, "Asia/Kolkata", cache=cache, fetch=fetch,
                    now=NOW + fc.CACHE_SECONDS + 1)
    assert len(fetch.urls) == 2


def test_cache_key_rounds_nearby_points_together():
    assert fc.cache_key(28.56291, 77.16781, "Asia/Kolkata") == fc.cache_key(28.5631, 77.1679, "Asia/Kolkata")
    assert fc.cache_key(28.56, 77.16, "Asia/Kolkata") != fc.cache_key(28.56, 77.16, "UTC")


def test_cache_from_env(monkeypatch):
    monkeypatch.delenv("TABLE_NAME", raising=False)
    assert fc.cache_from_env() is None


# --- forecast Lambda --------------------------------------------------------

def forecast_event(**q):
    return {"queryStringParameters": q or None}


def getter(response=None):
    fetch = Fetcher(response or fake_response())
    return lambda lat, lon, tz: fc.get_forecast(lat, lon, tz, cache=None, fetch=fetch, now=NOW)


def body(resp):
    return json.loads(resp["body"])


def test_forecast_tomorrow_by_default():
    resp = forecast_app.handle(forecast_event(lat="28.5629", lon="77.1678"), getter(), now=NOW)
    assert resp["statusCode"] == 200
    b = body(resp)
    assert b["date"] == "2026-10-09"
    assert b["pm25_hourly"][7] == 200.0 and len(b["pm25_hourly"]) == 24
    assert b["unit"] == "μg/m³" and "Open-Meteo" in b["source"]
    assert "45 km" in b["note"]


def test_forecast_specific_date():
    resp = forecast_app.handle(forecast_event(lat="28.5", lon="77.1", date="2026-10-10"), getter(), now=NOW)
    assert body(resp)["date"] == "2026-10-10"


def test_forecast_date_outside_window_is_400():
    resp = forecast_app.handle(forecast_event(lat="28.5", lon="77.1", date="2026-12-01"), getter(), now=NOW)
    assert resp["statusCode"] == 400


@pytest.mark.parametrize("q", [{}, {"lat": "x", "lon": "77"}, {"lat": "95", "lon": "77"}])
def test_forecast_bad_input_is_400(q):
    resp = forecast_app.handle(forecast_event(**q), getter(), now=NOW)
    assert resp["statusCode"] == 400
    assert "error" in body(resp)


def test_forecast_upstream_failure_is_502():
    def broken(lat, lon, tz):
        raise fc.UpstreamError("Open-Meteo unreachable")
    resp = forecast_app.handle(forecast_event(lat="28.5", lon="77.1"), broken, now=NOW)
    assert resp["statusCode"] == 502


def test_responses_allow_browser_calls():
    resp = forecast_app.handle(forecast_event(lat="28.5", lon="77.1"), getter(), now=NOW)
    assert resp["headers"]["Content-Type"] == "application/json"


# --- plan Lambda ------------------------------------------------------------

def sample_request(**extra):
    tt = json.loads((REPO / "data" / "sample_timetable.json").read_text())
    cls = tt["classes"][0]
    return {"school": tt["school"], "slots": tt["slots"],
            "classes": [{"id": cls["id"], "name": cls["name"], "periods": cls["days"]["monday"]}],
            **extra}


def plan_event(payload):
    return {"body": json.dumps(payload) if not isinstance(payload, str) else payload}


def test_plan_sample_monday_moves_pe_to_clean_hour():
    resp = plan_app.handle(plan_event(sample_request()), getter(), CONFIG, now=NOW)
    assert resp["statusCode"] == 200
    b = body(resp)
    assert b["date"] == "2026-10-09"
    assert b["verdict"] == "reorder"
    after = b["classes"][0]["after"]
    assert next(p for p in after if p["subject"] == "PE")["slot"] in {"p5", "p6", "p7", "p8"}
    assert b["reduction_pct"] > 0


def test_plan_includes_air_sources_and_labels():
    b = body(plan_app.handle(plan_event(sample_request()), getter(), CONFIG, now=NOW))
    hours = {h["hour"]: h for h in b["air"]["hours"]}
    assert sorted(hours) == list(range(7, 14))
    assert hours[7] == {"hour": 7, "pm25": 200.0, "category": "Very Poor"}
    assert hours[12]["category"] == "Satisfactory"
    assert "Open-Meteo" in b["air"]["source"]
    assert any("assumption" in a for a in b["assumptions"])
    assert "estimate" in b["label"].lower()


def test_plan_all_indoors_day():
    resp = plan_app.handle(plan_event(sample_request()), getter(fake_response(values=[300.0] * 24)),
                           CONFIG, now=NOW)
    assert body(resp)["verdict"] == "all_indoors"


def test_plan_explicit_date():
    b = body(plan_app.handle(plan_event(sample_request(date="2026-10-10")), getter(), CONFIG, now=NOW))
    assert b["date"] == "2026-10-10"


@pytest.mark.parametrize("payload", [
    "not json",
    {},
    {"school": {"latitude": 28.5, "longitude": 77.1}, "slots": [], "classes": "nope"},
])
def test_plan_bad_body_is_400(payload):
    resp = plan_app.handle(plan_event(payload), getter(), CONFIG, now=NOW)
    assert resp["statusCode"] == 400
    assert "error" in body(resp)


def test_plan_constraint_error_is_400_with_message():
    req = sample_request()
    req["classes"][0]["periods"][3]["slot"] = "p1"   # two periods in p1
    resp = plan_app.handle(plan_event(req), getter(), CONFIG, now=NOW)
    assert resp["statusCode"] == 400
    assert "slot" in body(resp)["error"]


def test_plan_upstream_failure_is_502():
    def broken(lat, lon, tz):
        raise fc.UpstreamError("down")
    resp = plan_app.handle(plan_event(sample_request()), broken, CONFIG, now=NOW)
    assert resp["statusCode"] == 502


class FakeDynamo:
    def __init__(self):
        self.items = {}

    def put_item(self, TableName, Item):
        self.items[(TableName, Item["pk"]["S"], Item["sk"]["S"])] = Item

    def get_item(self, TableName, Key):
        item = self.items.get((TableName, Key["pk"]["S"], Key["sk"]["S"]))
        return {"Item": item} if item else {}


def test_dynamo_cache_round_trip():
    cache = fc.DynamoCache("t", client=FakeDynamo())
    assert cache.get("k") is None
    cache.put("k", {"days": {"2026-10-09": [1.5, None]}}, 1234.9)
    assert cache.get("k") == {"data": {"days": {"2026-10-09": [1.5, None]}}, "expires_at": 1234}


def test_dynamo_cache_works_with_get_forecast():
    cache, fetch = fc.DynamoCache("t", client=FakeDynamo()), Fetcher(fake_response())
    fc.get_forecast(28.5, 77.1, "Asia/Kolkata", cache=cache, fetch=fetch, now=NOW)
    again = fc.get_forecast(28.5, 77.1, "Asia/Kolkata", cache=cache, fetch=fetch, now=NOW + 10)
    assert again["cached"] is True and len(fetch.urls) == 1
