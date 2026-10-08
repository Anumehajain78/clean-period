"""POST /notice

Body: {"plan": <POST /plan response>, "school_name": "...", "use_ai"?: true}

Returns the parent notice in English and Hindi. Code writes a template from
the plan's facts. If AI is on, Claude Sonnet 4.6 (Amazon Bedrock) rewrites it for tone;
the AI text is used only if every number in it comes from the facts,
otherwise the template is returned with the reason.
"""

import os
import time

from core import labels, notice
from functions.common.http import BadRequest, error, json_body, respond

# Newer Claude models are "not available for this account" on our AWS account
# (checked 2026-10-08); Sonnet 4.6 is the strongest one it can call.
DEFAULT_MODEL = "global.anthropic.claude-sonnet-4-6"


class NoticeAIError(Exception):
    pass


def ai_notice(f, draft, client, model):
    system, user = notice.prompt(f, draft)
    msg = client.messages.create(
        model=model,
        max_tokens=16000,
        system=system,
        messages=[{"role": "user", "content": user}],
        output_config={"effort": "low"},
    )
    if msg.stop_reason in ("refusal", "max_tokens"):
        raise NoticeAIError(f"model stopped with {msg.stop_reason}")
    text = "".join(b.text for b in msg.content if b.type == "text")
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
        import anthropic
        return (NoticeAIError, anthropic.APIStatusError, anthropic.APIConnectionError)
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
    try:
        from anthropic import AnthropicBedrock
    except ImportError:
        return None
    # 15 s and no retry: API Gateway gives up at 30 s, and the template covers a failure.
    return AnthropicBedrock(aws_region=os.environ.get("AWS_REGION"), timeout=15, max_retries=0)


_CLIENT = None


def handler(event, context):
    global _CLIENT
    if _CLIENT is None:
        started = time.monotonic()
        _CLIENT = _client()
        print(f"notice: client ready in {time.monotonic() - started:.1f}s")
    return handle(event, _CLIENT, os.environ.get("NOTICE_MODEL", DEFAULT_MODEL))
