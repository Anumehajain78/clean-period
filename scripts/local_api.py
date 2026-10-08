"""Run the Lambda handlers as a local HTTP server.

For frontend development without AWS or Docker. Stdlib only, no cache.
Saved schools live in memory and are lost when the server stops.

    python scripts/local_api.py          # http://127.0.0.1:8787
    GET  /forecast?lat=28.56&lon=77.17
    POST /plan   (JSON body, see docs/api.md)
    POST /notice (template only, unless NOTICE_USE_AI=1: then it calls Amazon Bedrock)
    POST /schools, GET|PUT /schools/<id>, GET /schools/<id>/plans/latest
    POST /_nightly  (dev only: runs the 19:00 nightly job now)
"""

import json
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import re
from urllib.parse import parse_qsl, urlparse

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO / "backend"))
os.environ.pop("TABLE_NAME", None)
os.environ.setdefault("NOTICE_USE_AI", "0")

from functions.forecast import app as forecast_app  # noqa: E402
from functions.notice import app as notice_app  # noqa: E402
from functions.common import forecast as fc  # noqa: E402
from functions.common.store import MemoryStore  # noqa: E402
from functions.nightly import app as nightly_app  # noqa: E402
from functions.plan import app as plan_app  # noqa: E402
from functions.schools import app as schools_app  # noqa: E402

PORT = int(os.environ.get("PORT", "8787"))
STORE = MemoryStore()
SCHOOL_ROUTES = [
    (re.compile(r"^/schools$"), "/schools"),
    (re.compile(r"^/schools/([\w-]+)$"), "/schools/{id}"),
    (re.compile(r"^/schools/([\w-]+)/plans/latest$"), "/schools/{id}/plans/latest"),
]


def school_event(method, path, headers, body):
    for pattern, template in SCHOOL_ROUTES:
        m = pattern.match(path)
        if m:
            return {"routeKey": f"{method} {template}", "body": body,
                    "pathParameters": {"id": m.group(1)} if m.groups() else None,
                    "headers": {k.lower(): v for k, v in headers.items()}}
    return None


class Handler(BaseHTTPRequestHandler):
    def _send(self, resp):
        self.send_response(resp["statusCode"])
        for k, v in resp.get("headers", {}).items():
            self.send_header(k, v)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "content-type, x-edit-key")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS")
        self.end_headers()
        self.wfile.write(resp["body"].encode())

    def do_OPTIONS(self):
        self._send({"statusCode": 204, "body": ""})

    def _body(self):
        length = int(self.headers.get("Content-Length") or 0)
        return self.rfile.read(length).decode() if length else ""

    def _school(self, method):
        event = school_event(method, urlparse(self.path).path, dict(self.headers), self._body())
        if event is None:
            return False
        self._send(schools_app.handle(event, STORE))
        return True

    def do_GET(self):
        if self._school("GET"):
            return
        url = urlparse(self.path)
        if url.path != "/forecast":
            return self._send({"statusCode": 404, "body": json.dumps({"error": "not found"})})
        self._send(forecast_app.handler({"queryStringParameters": dict(parse_qsl(url.query)) or None}, None))

    def do_PUT(self):
        if not self._school("PUT"):
            self._send({"statusCode": 404, "body": json.dumps({"error": "not found"})})

    def do_POST(self):
        path = urlparse(self.path).path
        if path == "/_nightly":
            summary = nightly_app.run(STORE, lambda lat, lon, tz: fc.get_forecast(lat, lon, tz), nightly_app._CONFIG)
            return self._send({"statusCode": 200, "headers": {"Content-Type": "application/json"},
                               "body": json.dumps(summary)})
        if self._school("POST"):
            return
        handler = {"/plan": plan_app.handler, "/notice": notice_app.handler}.get(path)
        if handler is None:
            return self._send({"statusCode": 404, "body": json.dumps({"error": "not found"})})
        self._send(handler({"body": self._body()}, None))


if __name__ == "__main__":
    ai = "on (Amazon Bedrock)" if os.environ["NOTICE_USE_AI"] == "1" else "off (template only)"
    print(f"Clean Period local API on http://127.0.0.1:{PORT}, AI notice {ai}")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
