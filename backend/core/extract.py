"""Turn an AI reading of a timetable photo into rows the teacher can check.

The model only reads; this code decides what is kept. Rows with a bad time,
an end before the start, or no subject are dropped and counted. Pure Python.
"""

import json
import re

ACTIVITIES = ("classroom", "pe", "indoor_activity", "assembly", "recess")
WEEKDAYS = ("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday")

_TIME = re.compile(r"^\s*(\d{1,2})[:.](\d{2})\s*([ap]\.?m\.?)?\s*$", re.I)
_SYNONYMS = {"indoor": "indoor_activity", "sports": "pe", "games": "pe", "break": "recess", "lunch": "recess"}
_GUESS = [  # first match wins; order matters ("board games" is indoor, "games" is PE)
    ("assembly", r"\bassembly\b|\bprayer\b"),
    ("recess", r"\brecess\b|\bbreak\b|\blunch\b|\binterval\b|\btiffin\b"),
    ("indoor_activity", r"\byoga\b|\bmeditation\b|\bboard games?\b|\bchess\b"),
    ("pe", r"\bp\.?\s?e\.?\b|\bp\.?\s?t\.?\b|\bphysical\b|\bsports?\b|\bgames?\b|\bplay\b|\bdrill\b"),
]

PROMPT = """This is a photo of a school timetable. Read it exactly; do not guess anything that is not shown.
Return only a JSON object:
{"class_name": "<class or section if written, else empty>",
 "days": {"monday": [{"start": "HH:MM", "end": "HH:MM", "subject": "...", "teacher": "<if written, else empty>",
                      "activity": "classroom | pe | indoor_activity | assembly | recess"}], "tuesday": [...]}}
Use 24-hour times. If the times are written once in a header row or column, use them for every day.
activity: pe for PE, games or sports outdoors; assembly; recess for breaks and lunch;
indoor_activity for yoga or indoor games; classroom for everything else.
Include every day and every period you can read, in order."""


def _time(text):
    m = _TIME.match(str(text or ""))
    if not m:
        return None
    h, mm, ampm = int(m.group(1)), int(m.group(2)), (m.group(3) or "").lower().replace(".", "")
    if mm > 59 or h > 23:
        return None
    if ampm == "pm" and h < 12:
        h += 12
    elif ampm == "am" and h == 12:
        h = 0
    elif not ampm and 1 <= h <= 6:
        h += 12  # a school period written "1:00" without am/pm is in the afternoon
    return f"{h:02d}:{mm:02d}"


def _activity(given, subject):
    a = str(given or "").strip().lower().replace(" ", "_")
    if a in ACTIVITIES:
        return a
    if a in _SYNONYMS:
        return _SYNONYMS[a]
    for activity, pattern in _GUESS:
        if re.search(pattern, subject, re.I):
            return activity
    return "classroom"


def _weekday(key):
    k = str(key).strip().lower()[:3]
    return next((d for d in WEEKDAYS if d.startswith(k)), None) if len(k) == 3 else None


def clean(raw):
    """{"class_name", "days": {weekday: [rows sorted by start]}, "dropped": n}."""
    if not isinstance(raw, dict):
        raise ValueError("reading is not an object")
    days, dropped = {}, 0
    for key, rows in (raw.get("days") or {}).items():
        day = _weekday(key)
        if day is None or not isinstance(rows, list):
            continue
        for r in rows:
            if not isinstance(r, dict):
                dropped += 1
                continue
            start, end = _time(r.get("start")), _time(r.get("end"))
            subject = str(r.get("subject") or "").strip()
            if not start or not end or end <= start or not subject:
                dropped += 1
                continue
            days.setdefault(day, []).append({
                "start": start, "end": end, "subject": subject[:60],
                "activity": _activity(r.get("activity"), subject),
                "teacher": str(r.get("teacher") or "").strip()[:40],
            })
    ordered = {d: sorted(days[d], key=lambda p: p["start"]) for d in WEEKDAYS if d in days}
    return {"class_name": str(raw.get("class_name") or "").strip()[:40], "days": ordered, "dropped": dropped}


def parse_reply(text):
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end < start:
        raise ValueError("no JSON object in the reading")
    try:
        return json.loads(text[start:end + 1])
    except json.JSONDecodeError as e:
        raise ValueError(f"reading is not valid JSON: {e}") from None
