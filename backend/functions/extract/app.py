"""POST /extract  {"image": "<base64>", "media_type": "image/jpeg|png|webp"}

Reads a timetable photo with Amazon Nova Pro (Bedrock) and returns rows for the
teacher to check and edit. Nothing is planned or saved here.
"""

import base64
import binascii
import os

from core import extract
from functions.common.http import BadRequest, error, json_body, respond

DEFAULT_MODEL = "apac.amazon.nova-pro-v1:0"
MAX_BYTES = 3_500_000  # Lambda payloads stop at 6 MB; the site shrinks photos first
FORMATS = {"image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp"}
NOTE = "Read by AI from the photo. Check every row against the timetable before planning."


def handle(event, client, model):
    try:
        body = json_body(event)
        fmt = FORMATS.get(body.get("media_type"))
        if not fmt:
            raise BadRequest("media_type must be image/jpeg, image/png or image/webp")
        data = str(body.get("image") or "")
        if data.startswith("data:"):
            data = data.split(",", 1)[-1]
        try:
            raw = base64.b64decode(data, validate=True)
        except (binascii.Error, ValueError):
            raise BadRequest("image must be base64") from None
        if not raw:
            raise BadRequest("image is empty")
    except BadRequest as e:
        return error(400, str(e))
    if len(raw) > MAX_BYTES:
        return error(413, "photo is too large; use a smaller photo")
    if client is None:
        return error(503, "photo reading is not available")

    try:
        from botocore.exceptions import BotoCoreError, ClientError
        r = client.converse(
            modelId=model,
            messages=[{"role": "user", "content": [
                {"image": {"format": fmt, "source": {"bytes": raw}}},
                {"text": extract.PROMPT},
            ]}],
            inferenceConfig={"maxTokens": 4000, "temperature": 0},
        )
        if r["stopReason"] != "end_turn":
            raise ValueError(f"model stopped with {r['stopReason']}")
        text = "".join(b.get("text", "") for b in r["output"]["message"]["content"])
        result = extract.clean(extract.parse_reply(text))
    except (ValueError, ClientError, BotoCoreError) as e:
        print(f"extract: {e}")
        return error(502, f"could not read the photo: {e}")

    if not result["days"]:
        return error(422, "no timetable rows found in the photo")
    return respond(200, {**result, "note": NOTE})


_CLIENT = None


def handler(event, context):
    global _CLIENT
    if _CLIENT is None and os.environ.get("EXTRACT_USE_AI", "1") == "1":
        import boto3
        from botocore.config import Config
        _CLIENT = boto3.client("bedrock-runtime", config=Config(
            connect_timeout=5, read_timeout=25, retries={"total_max_attempts": 1}))
    return handle(event, _CLIENT, os.environ.get("EXTRACT_MODEL", DEFAULT_MODEL))
