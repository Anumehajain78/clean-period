import copy
import json
from datetime import datetime, timezone
from pathlib import Path

import pytest

from core import dose
from functions.common import forecast as fc
from functions.common.store import MemoryStore
from functions.nightly import app as nightly_app
from functions.schools import app as schools_app

REPO = Path(__file__).resolve().parents[2]
CONFIG = dose.load_config()
TT = json.loads((REPO / "data" / "sample_timetable.json").read_text())
NOW = datetime(2026, 10, 8, 13, 30, tzinfo=timezone.utc).timestamp()   # 19:00 IST, Thursday


def ev(route, body=None, school_id=None, key=None):
    e = {"routeKey": route, "headers": {}}
    if body is not None:
        e["body"] = body if isinstance(body, str) else json.dumps(body)
    if school_id:
        e["pathParameters"] = {"id": school_id}
    if key:
        e["headers"]["x-edit-key"] = key
    return e


def out(resp):
    return resp["statusCode"], json.loads(resp["body"])


@pytest.fixture
def store():
    return MemoryStore()


def create(store, tt=TT):
    return out(schools_app.handle(ev("POST /schools", {"timetable": tt}), store, now=NOW))


# --- schools ------------------------------------------------------------------

def test_create_returns_id_and_key_once(store):
    status, b = create(store)
    assert status == 201
    assert len(b["id"]) >= 12 and len(b["edit_key"]) >= 32
    saved = store.get_school(b["id"])
    assert saved["timetable"] == TT
    assert b["edit_key"] not in json.dumps(saved)          # only a hash is stored


def test_ids_and_keys_are_unique(store):
    a, b = create(store)[1], create(store)[1]
    assert a["id"] != b["id"] and a["edit_key"] != b["edit_key"]


def test_get_school_has_no_key(store):
    sid = create(store)[1]["id"]
    status, b = out(schools_app.handle(ev("GET /schools/{id}", school_id=sid), store, now=NOW))
    assert status == 200 and b == {"id": sid, "timetable": TT}


def test_create_rejects_invalid_timetable(store):
    bad = copy.deepcopy(TT)
    bad["school"]["latitude"] = "north"
    status, b = create(store, bad)
    assert status == 400 and any("latitude" in p for p in b["problems"])
    assert store.school_ids() == []


def test_update_needs_the_right_key(store):
    created = create(store)[1]
    changed = copy.deepcopy(TT)
    changed["school"]["name"] = "Renamed"
    route = "PUT /schools/{id}"
    assert out(schools_app.handle(ev(route, {"timetable": changed}, created["id"]), store, now=NOW))[0] == 403
    assert out(schools_app.handle(ev(route, {"timetable": changed}, created["id"], "wrong"), store, now=NOW))[0] == 403
    status, _ = out(schools_app.handle(ev(route, {"timetable": changed}, created["id"], created["edit_key"]),
                                       store, now=NOW))
    assert status == 200
    assert store.get_school(created["id"])["timetable"]["school"]["name"] == "Renamed"


def test_unknown_school_is_404(store):
    for route in ("GET /schools/{id}", "GET /schools/{id}/plans/latest"):
        assert out(schools_app.handle(ev(route, school_id="nope"), store, now=NOW))[0] == 404
    assert out(schools_app.handle(ev("PUT /schools/{id}", {"timetable": TT}, "nope", "k"), store, now=NOW))[0] == 404


def test_bad_json_is_400(store):
    assert out(schools_app.handle(ev("POST /schools", "not json"), store, now=NOW))[0] == 400


def test_unknown_route_is_404(store):
    assert out(schools_app.handle(ev("DELETE /schools/{id}", school_id="x"), store, now=NOW))[0] == 404


def test_latest_plan_none_yet_is_404(store):
    sid = create(store)[1]["id"]
    status, b = out(schools_app.handle(ev("GET /schools/{id}/plans/latest", school_id=sid), store, now=NOW))
    assert status == 404 and "nightly" in b["error"]


# --- nightly ------------------------------------------------------------------

MORNING = [200.0] * 11 + [60.0] * 13


def forecast_for(lat, lon, tz):
    return {"days": {"2026-10-08": MORNING, "2026-10-09": MORNING, "2026-10-10": MORNING},
            "utc_offset_seconds": 19800, "source": "Open-Meteo test",
            "grid_point": {"latitude": 28.6, "longitude": 77.2},
            "fetched_at": "2026-10-08T13:30:00+00:00", "cached": False}


def test_nightly_plans_every_school_for_tomorrow(store):
    a = create(store)[1]["id"]
    b = create(store)[1]["id"]
    summary = nightly_app.run(store, forecast_for, CONFIG, now=NOW)
    assert summary == {"schools": 2, "planned": 2, "no_school": 0, "error": 0}
    for sid in (a, b):
        r = store.latest_result(sid)
        assert r["date"] == "2026-10-09" and r["status"] == "planned"   # Friday
        assert r["notice"]["hi"]


def test_nightly_result_served_by_schools_api(store):
    sid = create(store)[1]["id"]
    nightly_app.run(store, forecast_for, CONFIG, now=NOW)
    status, b = out(schools_app.handle(ev("GET /schools/{id}/plans/latest", school_id=sid), store, now=NOW))
    assert status == 200 and b["status"] == "planned" and b["plan"]["verdict"] == "reorder"


def test_nightly_one_failure_does_not_stop_others(store):
    good = create(store)[1]["id"]
    far = copy.deepcopy(TT)
    far["school"]["latitude"] = 10.0
    bad = create(store, far)[1]["id"]

    def flaky(lat, lon, tz):
        if lat == 10.0:
            raise fc.UpstreamError("Open-Meteo request failed")
        return forecast_for(lat, lon, tz)

    summary = nightly_app.run(store, flaky, CONFIG, now=NOW)
    assert summary == {"schools": 2, "planned": 1, "no_school": 0, "error": 1}
    assert store.latest_result(good)["status"] == "planned"
    err = store.latest_result(bad)
    assert err["status"] == "error" and "Open-Meteo" in err["reason"] and err["date"] == "2026-10-09"


def test_nightly_weekend(store):
    sid = create(store)[1]["id"]
    friday_evening = datetime(2026, 10, 9, 13, 30, tzinfo=timezone.utc).timestamp()
    summary = nightly_app.run(store, forecast_for, CONFIG, now=friday_evening)
    assert summary["no_school"] == 1
    assert store.latest_result(sid)["status"] == "no_school"
