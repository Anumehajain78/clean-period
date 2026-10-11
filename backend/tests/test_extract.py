import base64
import json

import pytest
from botocore.exceptions import ClientError

from core import extract
from functions.extract import app

MODEL = "apac.amazon.nova-pro-v1:0"
PNG = base64.b64encode(b"\x89PNG fake image bytes").decode()

READ = {
    "class_name": "Class 7-A",
    "days": {
        "Monday": [
            {"start": "8:00", "end": "8:40", "subject": "Maths", "activity": "classroom", "teacher": "Mrs Rao"},
            {"start": "08:40", "end": "09:20", "subject": "Games", "activity": "pe", "teacher": None},
            {"start": "10:40", "end": "11:00", "subject": "Lunch break", "activity": "recess"},
        ],
        "tuesday": [
            {"start": "13:00", "end": "13:40", "subject": "Yoga", "activity": "indoor"},
        ],
    },
}


# --- core.extract.clean ---------------------------------------------------------

def test_clean_normalises_days_times_and_activities():
    out = extract.clean(READ)
    assert out["class_name"] == "Class 7-A"
    assert list(out["days"]) == ["monday", "tuesday"]
    mon = out["days"]["monday"]
    assert mon[0] == {"start": "08:00", "end": "08:40", "subject": "Maths", "activity": "classroom",
                      "teacher": "Mrs Rao"}
    assert mon[1]["activity"] == "pe" and mon[1]["teacher"] == ""
    assert mon[2]["activity"] == "recess"
    assert out["days"]["tuesday"][0]["activity"] == "indoor_activity"
    assert out["dropped"] == 0


@pytest.mark.parametrize("subject,expected", [
    ("Physical Education", "pe"), ("PT", "pe"), ("Sports", "pe"), ("Games", "pe"),
    ("Morning Assembly", "assembly"), ("Recess", "recess"), ("Lunch", "recess"), ("Short break", "recess"),
    ("Yoga", "indoor_activity"), ("Hindi", "classroom"),
])
def test_activity_guessed_from_subject_when_missing_or_unknown(subject, expected):
    out = extract.clean({"days": {"monday": [{"start": "08:00", "end": "08:40", "subject": subject,
                                              "activity": "???"}]}})
    assert out["days"]["monday"][0]["activity"] == expected


def test_clean_drops_rows_it_cannot_trust():
    raw = {"days": {"monday": [
        {"start": "8", "end": "8:40", "subject": "Maths"},          # bad time
        {"start": "09:00", "end": "08:00", "subject": "English"},   # ends before it starts
        {"start": "09:00", "end": "09:40", "subject": "  "},        # no subject
        {"start": "09:40", "end": "10:20", "subject": "Science"},
    ]}}
    out = extract.clean(raw)
    assert [p["subject"] for p in out["days"]["monday"]] == ["Science"]
    assert out["dropped"] == 3


def test_clean_sorts_by_start_and_ignores_unknown_days():
    raw = {"days": {"Funday": [{"start": "08:00", "end": "08:40", "subject": "X"}],
                    "MON": [{"start": "09:00", "end": "09:40", "subject": "B"},
                            {"start": "08:00", "end": "08:40", "subject": "A"}]}}
    out = extract.clean(raw)
    assert list(out["days"]) == ["monday"]
    assert [p["subject"] for p in out["days"]["monday"]] == ["A", "B"]


def test_clean_accepts_12_hour_afternoon_times():
    out = extract.clean({"days": {"friday": [{"start": "1:00 PM", "end": "1:40 PM", "subject": "Art"}]}})
    assert out["days"]["friday"][0]["start"] == "13:00"


def test_clean_rejects_non_object():
    with pytest.raises(ValueError):
        extract.clean(["nope"])


def test_parse_reply_finds_json_in_text():
    assert extract.parse_reply('Here:\n```json\n{"days": {}}\n```') == {"days": {}}
    with pytest.raises(ValueError):
        extract.parse_reply("I cannot read this image.")


# --- POST /extract ---------------------------------------------------------------

class FakeBedrock:
    def __init__(self, reply=None, error=None, stop="end_turn"):
        self.reply, self.error, self.stop, self.calls = reply, error, stop, []

    def converse(self, **kw):
        self.calls.append(kw)
        if self.error:
            raise self.error
        return {"stopReason": self.stop, "output": {"message": {"content": [{"text": self.reply}]}}}


def ev(payload):
    return {"body": payload if isinstance(payload, str) else json.dumps(payload)}


def out(resp):
    return resp["statusCode"], json.loads(resp["body"])


def test_extract_reads_photo():
    client = FakeBedrock(reply=json.dumps(READ))
    status, b = out(app.handle(ev({"image": PNG, "media_type": "image/png"}), client, MODEL))
    assert status == 200
    assert b["class_name"] == "Class 7-A" and b["days"]["monday"][1]["subject"] == "Games"
    assert "check" in b["note"].lower()
    call = client.calls[0]
    assert call["modelId"] == MODEL
    image = call["messages"][0]["content"][0]["image"]
    assert image["format"] == "png" and image["source"]["bytes"] == b"\x89PNG fake image bytes"


def test_extract_strips_data_url_prefix():
    client = FakeBedrock(reply=json.dumps(READ))
    status, _ = out(app.handle(ev({"image": "data:image/jpeg;base64," + PNG, "media_type": "image/jpeg"}),
                               client, MODEL))
    assert status == 200
    assert client.calls[0]["messages"][0]["content"][0]["image"]["format"] == "jpeg"


@pytest.mark.parametrize("payload", [
    "not json", {}, {"image": PNG}, {"image": PNG, "media_type": "image/gif"},
    {"image": "%%% not base64 %%%", "media_type": "image/png"},
])
def test_extract_bad_input_is_400(payload):
    status, b = out(app.handle(ev(payload), FakeBedrock(reply="{}"), MODEL))
    assert status == 400 and "error" in b


def test_extract_too_large_is_413():
    big = base64.b64encode(b"x" * (app.MAX_BYTES + 1)).decode()
    status, _ = out(app.handle(ev({"image": big, "media_type": "image/png"}), FakeBedrock(reply="{}"), MODEL))
    assert status == 413


def test_extract_nothing_found_is_422():
    status, b = out(app.handle(ev({"image": PNG, "media_type": "image/png"}),
                               FakeBedrock(reply='{"days": {}}'), MODEL))
    assert status == 422 and "timetable" in b["error"]


@pytest.mark.parametrize("client", [
    FakeBedrock(reply="Sorry, I can't."),
    FakeBedrock(reply="{", stop="max_tokens"),
    FakeBedrock(error=ClientError({"Error": {"Code": "ThrottlingException", "Message": "slow"}}, "Converse")),
])
def test_extract_model_failure_is_502(client):
    status, b = out(app.handle(ev({"image": PNG, "media_type": "image/png"}), client, MODEL))
    assert status == 502 and "error" in b


def test_extract_without_model_is_503():
    status, _ = out(app.handle(ev({"image": PNG, "media_type": "image/png"}), None, MODEL))
    assert status == 503


def test_clean_reads_bare_afternoon_times_as_pm():
    out = extract.clean({"days": {"monday": [{"start": "1:00", "end": "1:40", "subject": "Art"},
                                             {"start": "12:20", "end": "1:00", "subject": "Music"}]}})
    assert [(p["start"], p["end"]) for p in out["days"]["monday"]] == [("12:20", "13:00"), ("13:00", "13:40")]
