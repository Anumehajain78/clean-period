"""Run the forecast, plan and notice Lambda handlers as a local HTTP server.

For frontend development without AWS or Docker. Stdlib only, no cache.

    python scripts/local_api.py          # http://127.0.0.1:8787
    GET  /forecast?lat=28.56&lon=77.17
    POST /plan   (JSON body, see docs/api.md)
    POST /notice (template only, unless NOTICE_USE_AI=1: then it calls Amazon Bedrock)
"""

import json
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qsl, urlparse

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO / "backend"))
os.environ.pop("TABLE_NAME", None)
os.environ.setdefault("NOTICE_USE_AI", "0")

from functions.forecast import app as forecast_app  # noqa: E402
from functions.notice import app as notice_app  # noqa: E402
from functions.plan import app as plan_app  # noqa: E402

PORT = int(os.environ.get("PORT", "8787"))


class Handler(BaseHTTPRequestHandler):
    def _send(self, resp):
        self.send_response(resp["statusCode"])
        for k, v in resp.get("headers", {}).items():
            self.send_header(k, v)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "content-type")
        self.end_headers()
        self.wfile.write(resp["body"].encode())

    def do_OPTIONS(self):
        self._send({"statusCode": 204, "body": ""})

    def do_GET(self):
        url = urlparse(self.path)
        if url.path != "/forecast":
            return self._send({"statusCode": 404, "body": json.dumps({"error": "not found"})})
        self._send(forecast_app.handler({"queryStringParameters": dict(parse_qsl(url.query)) or None}, None))

    def do_POST(self):
        handler = {"/plan": plan_app.handler, "/notice": notice_app.handler}.get(urlparse(self.path).path)
        if handler is None:
            return self._send({"statusCode": 404, "body": json.dumps({"error": "not found"})})
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length).decode() if length else ""
        self._send(handler({"body": body}, None))


if __name__ == "__main__":
    ai = "on (Amazon Bedrock)" if os.environ["NOTICE_USE_AI"] == "1" else "off (template only)"
    print(f"Clean Period local API on http://127.0.0.1:{PORT}, AI notice {ai}")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
