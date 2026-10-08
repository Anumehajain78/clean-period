"""POST /notice

Body: {"plan": <POST /plan response>, "school_name": "...", "use_ai"?: true}

Returns the parent notice in English and Hindi. Code writes a template from
the plan's facts. If AI is on, Amazon Nova Pro (Amazon Bedrock, Converse API)
rewrites it for tone; the AI text is used only if every number in it comes from
the facts and every moved period is still there, otherwise the template is
returned with the reason.
"""

import os
import time

from core import labels, notice
from functions.common.http import BadRequest, error, json_body, respond

# Amazon's own model: sold by AWS, so no Marketplace subscription and credits apply.
# Claude needs a Marketplace subscription, which this account cannot complete.
DEFAULT_MODEL = "apac.amazon.nova-pro-v1:0"


class NoticeAIError(Exception):
    pass


def ai_notice(f, draft, client, model):
    system, user = notice.prompt(f, draft)
    r = client.converse(
        modelId=model,
        system=[{"text": system}],
        messages=[{"role": "user", "content": [{"text": user}]}],
        inferenceConfig={"maxTokens": 2000, "temperature": 0.3},
    )
    if r["stopReason"] != "end_turn":
        raise NoticeAIError(f"model stopped with {r['stopReason']}")
    text = "".join(b.get("text", "") for b in r["output"]["message"]["content"])
    try:
        out = notice.parse_ai(text)
    except ValueError as e:
        raise NoticeAIError(f"reply was not the expected JSON: {e}") from None
    problems = notice.check(out, f)
    if problems:
        raise NoticeAIError("; ".join(problems[:3]))
    return out


def _ai_errors():
    try:
        from botocore.exceptions import BotoCoreError, ClientError
        return (NoticeAIError, ClientError, BotoCoreError)
    except ImportError:
        return (NoticeAIError,)


def handle(event, client, model):
    try:
        body = json_body(event)
        plan, school_name = body.get("plan"), body.get("school_name")
        if not isinstance(plan, dict) or not isinstance(school_name, str):
            raise BadRequest("body needs plan (object) and school_name (string)")
        f = notice.facts(plan, school_name)
    except (BadRequest, KeyError, TypeError, ValueError) as e:
        return error(400, f"missing field {e}" if isinstance(e, KeyError) else str(e))

    draft = notice.template(f)
    out = {**draft, "source": "template", "facts": f, "label": labels.ESTIMATE_LABEL}
    if body.get("use_ai", True) and client is not None:
        started = time.monotonic()
        try:
            out.update(ai_notice(f, draft, client, model), source="ai", model=model)
        except _ai_errors() as e:
            reason = str(e) or type(e).__name__
            print(f"notice: AI text not used: {reason}")
            out["fallback_reason"] = reason
        print(f"notice: model call took {time.monotonic() - started:.1f}s")
    return respond(200, out)


def _client():
    if os.environ.get("NOTICE_USE_AI", "1") != "1":
        return None
    import boto3
    from botocore.config import Config
    # 15 s and no retry: API Gateway gives up at 30 s, and the template covers a failure.
    return boto3.client("bedrock-runtime", config=Config(
        connect_timeout=5, read_timeout=15, retries={"total_max_attempts": 1}))


_CLIENT = None


def handler(event, context):
    global _CLIENT
    if _CLIENT is None:
        started = time.monotonic()
        _CLIENT = _client()
        print(f"notice: client ready in {time.monotonic() - started:.1f}s")
    return handle(event, _CLIENT, os.environ.get("NOTICE_MODEL", DEFAULT_MODEL))
