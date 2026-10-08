"""API Gateway (HTTP API, payload v2) helpers."""

import json


class BadRequest(Exception):
    pass


def respond(status, body):
    return {
        "statusCode": status,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(body, ensure_ascii=False),
    }


def error(status, message):
    return respond(status, {"error": message})


def json_body(event):
    raw = event.get("body")
    if event.get("isBase64Encoded") and raw:
        import base64
        raw = base64.b64decode(raw).decode()
    try:
        body = json.loads(raw or "")
    except json.JSONDecodeError:
        raise BadRequest("body must be JSON") from None
    if not isinstance(body, dict):
        raise BadRequest("body must be a JSON object")
    return body


def coords(lat, lon):
    try:
        lat, lon = float(lat), float(lon)
    except (TypeError, ValueError):
        raise BadRequest("latitude and longitude must be numbers") from None
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise BadRequest("latitude or longitude out of range")
    return lat, lon
