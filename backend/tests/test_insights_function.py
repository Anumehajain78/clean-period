import json
from datetime import datetime, timezone
from pathlib import Path

import pytest

from core import dose
from functions.common import forecast as fc
from functions.insights import app

from test_functions import FakeCache, Fetcher, fake_response

REPO = Path(__file__).resolve().parents[2]
CONFIG = dose.load_config()
TT = json.loads((REPO / "data" / "sample_timetable.json").read_text())
NOW = datetime(2026, 10, 8, 14, 30, tzinfo=timezone.utc).timestamp()   # Thu evening IST
MORNING = [200.0] * 11 + [60.0] * 13


def body_for(**extra):
    c = TT["classes"][0]
    return {"school": TT["school"], "slots": TT["slots"],
            "classes": [{"id": c["id"], "name": c["name"], "periods": c["days"]["monday"]}], **extra}


def ev(route, payload):
    return {"routeKey": route, "body": json.dumps(payload) if not isinstance(payload, str) else payload}


def out(resp):
    return resp["statusCode"], json.loads(resp["body"])


def forecast_7(lat, lon, tz, days=3):
    assert days == 7
    start = datetime(2026, 10, 8)
    dates = [f"2026-10-{8 + i:02d}" for i in range(7)]
    return {"days": {d: MORNING for d in dates[:5]}, "utc_offset_seconds": 19800,
            "source": "Open-Meteo test", "grid_point": {"latitude": 28.6, "longitude": 77.2},
            "fetched_at": "x", "cached": False}


def history(lat, lon, tz, start, end):
    from datetime import date, timedelta
    d0 = date.fromisoformat(start)
    n = (date.fromisoformat(end) - d0).days + 1
    return {"days": {(d0 + timedelta(days=i)).isoformat(): MORNING for i in range(n)},
            "source": "Open-Meteo history test", "grid_point": {"latitude": 28.6, "longitude": 77.2}, "cached": False}


def handle(route, payload, gf=forecast_7, gh=history):
    return out(app.handle(ev(route, payload), gf, gh, CONFIG, now=NOW))


# --- outlook ----------------------------------------------------------------------

def test_outlook_next_school_days_from_tomorrow():
    status, b = handle("POST /outlook", body_for())
    assert status == 200
    dates = [d["date"] for d in b["days"]]
    assert dates == ["2026-10-09", "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15"]   # Fri, then Mon-Thu
    assert [d["status"] for d in b["days"]] == ["planned", "planned", "no_forecast", "no_forecast", "no_forecast"]
    assert b["days"][0]["moved"] == 1
    assert "Open-Meteo" in b["source"] and b["label"] and b["label_hi"]


def test_outlook_bad_body_is_400():
    assert handle("POST /outlook", "nope")[0] == 400
    assert handle("POST /outlook", {"school": {}, "slots": [], "classes": []})[0] == 400


def test_outlook_upstream_error_is_502():
    def broken(lat, lon, tz, days=3):
        raise fc.UpstreamError("down")
    assert handle("POST /outlook", body_for(), gf=broken)[0] == 502


# --- your school, last winter ------------------------------------------------------

def test_backtest_replays_last_winter():
    status, b = handle("POST /backtest", body_for())
    assert status == 200
    assert b["period"] == {"start": app.WINTER[0], "end": app.WINTER[1]}
    s = b["summary"]
    assert s["school_days"] == 65                       # weekdays from 1 Nov 2025 to 31 Jan 2026
    assert s["season_reduction_pct"] > 0
    assert len(b["days"]) == 65
    assert "Open-Meteo" in b["source"]
    text = " ".join(b["assumptions"])
    assert "every weekday" in text and "holidays" in text
    assert len(b["assumptions_hi"]) == len(b["assumptions"])


def test_backtest_constraint_error_is_400():
    bad = body_for()
    bad["classes"][0]["periods"] = [dict(p, slot="p1") for p in bad["classes"][0]["periods"][:2]]
    status, b = handle("POST /backtest", bad)
    assert status == 400 and "slot" in b["error"]


def test_unknown_route_is_404():
    assert handle("GET /nope", body_for())[0] == 404


# --- forecast helpers ----------------------------------------------------------------

def test_get_forecast_days_parameter_has_its_own_cache_key():
    cache, fetch = FakeCache(), Fetcher(fake_response())
    fc.get_forecast(28.5, 77.1, "Asia/Kolkata", cache=cache, fetch=fetch, now=NOW)
    fc.get_forecast(28.5, 77.1, "Asia/Kolkata", cache=cache, fetch=fetch, now=NOW, days=7)
    assert "forecast_days=7" in fetch.urls[1] and len(fetch.urls) == 2


def test_get_history_fetches_once_then_caches():
    cache, fetch = FakeCache(), Fetcher(fake_response(days=("2025-11-03", "2025-11-04")))
    h = fc.get_history(28.5, 77.1, "Asia/Kolkata", "2025-11-03", "2025-11-04", cache=cache, fetch=fetch, now=NOW)
    assert "start_date=2025-11-03" in fetch.urls[0] and sorted(h["days"]) == ["2025-11-03", "2025-11-04"]
    again = fc.get_history(28.5, 77.1, "Asia/Kolkata", "2025-11-03", "2025-11-04", cache=cache, fetch=fetch, now=NOW + 3600)
    assert again["cached"] is True and len(fetch.urls) == 1
