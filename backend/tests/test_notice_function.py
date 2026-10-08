import json

import pytest
from botocore.exceptions import ClientError, ReadTimeoutError

from core import notice
from functions.notice import app

from test_notice import DIRTY_MORNING, SCHOOL, make_plan

PLAN = make_plan(DIRTY_MORNING)
FACTS = notice.facts(PLAN, SCHOOL)
PCT = FACTS["classes"][0]["reduction_pct"]
MODEL = "apac.amazon.nova-pro-v1:0"

GOOD_AI = {
    "en": f"Dear parents, on Monday 12 October 2026 PE moves from 08:00 to 13:00. Estimated cut {PCT}%.",
    "hi": f"प्रिय अभिभावक, खेल 08:00 की जगह 13:00 बजे होगा। अनुमानित कमी {PCT}%।",
}


class FakeBedrock:
    """Just enough of boto3's bedrock-runtime client: converse()."""

    def __init__(self, reply=None, stop_reason="end_turn", error=None):
        self.reply, self.stop_reason, self.error, self.calls = reply, stop_reason, error, []

    def converse(self, **kwargs):
        self.calls.append(kwargs)
        if self.error:
            raise self.error
        return {"stopReason": self.stop_reason,
                "output": {"message": {"role": "assistant", "content": [{"text": self.reply}]}}}


def event(**body):
    return {"body": json.dumps({"plan": PLAN, "school_name": SCHOOL, **body})}


def body(resp):
    return json.loads(resp["body"])


def test_ai_notice_used_when_it_passes_the_check():
    client = FakeBedrock(reply=json.dumps(GOOD_AI, ensure_ascii=False))
    b = body(app.handle(event(), client, MODEL))
    assert b["source"] == "ai" and b["model"] == MODEL
    assert b["en"] == GOOD_AI["en"] and b["hi"] == GOOD_AI["hi"]
    assert "fallback_reason" not in b


def test_request_sent_to_model():
    client = FakeBedrock(reply=json.dumps(GOOD_AI, ensure_ascii=False))
    app.handle(event(), client, MODEL)
    call = client.calls[0]
    assert call["modelId"] == MODEL
    assert call["system"] == [{"text": notice.SYSTEM}]
    assert json.dumps(FACTS, ensure_ascii=False) in call["messages"][0]["content"][0]["text"]
    assert call["inferenceConfig"]["maxTokens"] >= 1000


def test_ai_with_invented_number_falls_back_to_template():
    bad = {**GOOD_AI, "en": GOOD_AI["en"] + " Kids breathe 70% less."}
    b = body(app.handle(event(), FakeBedrock(reply=json.dumps(bad)), MODEL))
    assert b["source"] == "template"
    assert "70" in b["fallback_reason"]
    assert b["en"] == notice.template(FACTS)["en"]


def client_error(code, message):
    return ClientError({"Error": {"Code": code, "Message": message}}, "Converse")


@pytest.mark.parametrize("kw,reason", [
    ({"reply": "Here you go!"}, "JSON"),
    ({"reply": "{}", "stop_reason": "content_filtered"}, "content_filtered"),
    ({"reply": "{", "stop_reason": "max_tokens"}, "max_tokens"),
    ({"error": client_error("AccessDeniedException", "no access")}, "AccessDenied"),
    ({"error": client_error("ThrottlingException", "slow down")}, "Throttling"),
    ({"error": ReadTimeoutError(endpoint_url="https://bedrock")}, "timeout"),
])
def test_ai_failures_fall_back_to_template(kw, reason):
    b = body(app.handle(event(), FakeBedrock(**kw), MODEL))
    assert b["source"] == "template"
    assert reason.lower() in b["fallback_reason"].lower()


def test_use_ai_false_skips_the_model():
    client = FakeBedrock(reply=json.dumps(GOOD_AI))
    b = body(app.handle(event(use_ai=False), client, MODEL))
    assert b["source"] == "template" and client.calls == []
    assert "fallback_reason" not in b


def test_no_client_means_template():
    assert body(app.handle(event(), None, MODEL))["source"] == "template"


def test_response_has_facts_and_label():
    b = body(app.handle(event(use_ai=False), None, MODEL))
    assert b["facts"] == FACTS
    assert "estimate" in b["label"].lower()


@pytest.mark.parametrize("payload", ["nope", {}, {"plan": {"date": "x"}, "school_name": SCHOOL}])
def test_bad_body_is_400(payload):
    ev = {"body": payload if isinstance(payload, str) else json.dumps(payload)}
    resp = app.handle(ev, None, MODEL)
    assert resp["statusCode"] == 400 and "error" in body(resp)
