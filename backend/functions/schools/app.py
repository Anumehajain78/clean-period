"""Saved schools, so the nightly job can plan them. No accounts: whoever creates
a school gets a secret edit key once; only a hash of it is stored.

POST /schools                     {"timetable": {...}}  -> 201 {"id", "edit_key"}
GET  /schools/{id}                -> {"id", "timetable"}
PUT  /schools/{id}                header x-edit-key, {"timetable": {...}}
GET  /schools/{id}/plans/latest   -> newest nightly result
"""

import hashlib
import hmac
import secrets
import time

from core import nightly
from functions.common.http import BadRequest, error, json_body, respond
from functions.common.store import store_from_env


def key_hash(key):
    return hashlib.sha256(key.encode()).hexdigest()


def _timetable(event):
    tt = json_body(event).get("timetable")
    problems = nightly.validate_timetable(tt)
    if problems:
        return None, respond(400, {"error": "timetable is not valid", "problems": problems})
    return tt, None


def handle(event, store, now=None):
    now = now if now is not None else time.time()
    route = event.get("routeKey", "")
    school_id = (event.get("pathParameters") or {}).get("id")
    try:
        if route == "POST /schools":
            tt, bad = _timetable(event)
            if bad:
                return bad
            school_id, key = secrets.token_urlsafe(12), secrets.token_urlsafe(32)
            store.put_school(school_id, tt, key_hash(key), now)
            return respond(201, {"id": school_id, "edit_key": key})

        if route not in ("GET /schools/{id}", "PUT /schools/{id}", "GET /schools/{id}/plans/latest"):
            return error(404, "not found")
        saved = store.get_school(school_id) if school_id else None
        if saved is None:
            return error(404, "school not found")

        if route == "GET /schools/{id}":
            return respond(200, {"id": school_id, "timetable": saved["timetable"]})

        if route == "PUT /schools/{id}":
            key = (event.get("headers") or {}).get("x-edit-key") or ""
            if not hmac.compare_digest(key_hash(key), saved["key_hash"]):
                return error(403, "wrong or missing edit key")
            tt, bad = _timetable(event)
            if bad:
                return bad
            store.put_school(school_id, tt, saved["key_hash"], now)
            return respond(200, {"id": school_id})

        result = store.latest_result(school_id)
        if result is None:
            return error(404, "no nightly plan yet; plans are made every evening at 19:00 IST")
        return respond(200, result)
    except BadRequest as e:
        return error(400, str(e))


_STORE = None


def handler(event, context):
    global _STORE
    if _STORE is None:
        _STORE = store_from_env()
    return handle(event, _STORE)
