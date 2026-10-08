"""Parent notice in English and Hindi, built from a plan.

Code turns the plan into a small set of facts and writes a template notice
from them. An AI model may rewrite the notice for tone, but `check` rejects
any text with a number or time that is not in the facts, so the plan and its
numbers always come from code. Pure Python, no AWS.
"""

import json
import re
from datetime import date

MAX_CHARS = 1500

WEEKDAYS_HI = {"monday": "सोमवार", "tuesday": "मंगलवार", "wednesday": "बुधवार", "thursday": "गुरुवार",
               "friday": "शुक्रवार", "saturday": "शनिवार", "sunday": "रविवार"}
MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August",
             "September", "October", "November", "December"]
MONTHS_HI = ["जनवरी", "फ़रवरी", "मार्च", "अप्रैल", "मई", "जून", "जुलाई", "अगस्त",
             "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर"]
CATEGORY_HI = {"Good": "अच्छी", "Satisfactory": "संतोषजनक", "Moderate": "मध्यम", "Poor": "खराब",
               "Very Poor": "बहुत खराब", "Severe": "गंभीर"}

_DEVANAGARI_DIGITS = str.maketrans("०१२३४५६७८९", "0123456789")
_NUMBER = re.compile(r"\d+(?::\d{2}|\.\d+)?")


def _hour(h):
    return f"{h:02d}:00"


def facts(plan, school_name):
    """The few facts a parent needs, taken from a /plan response."""
    day = date.fromisoformat(plan["date"])
    hours = [h for h in plan.get("air", {}).get("hours", []) if h.get("pm25") is not None]
    worst = max(hours, key=lambda h: h["pm25"], default=None)
    cleanest = min(hours, key=lambda h: h["pm25"], default=None)

    def hour_fact(h):
        return {"time": _hour(h["hour"]), "pm25": round(h["pm25"]), "category": h["category"]} if h else None

    classes = []
    for c in plan["classes"]:
        start = {p["slot"]: p["start"] for p in c["before"]}
        outdoor = {p["subject"] for p in c["before"] if p["place"] == "ground"}
        classes.append({
            "name": c["name"],
            "reduction_pct": round(c["reduction_pct"]),
            "moves": [{"subject": m["subject"], "from": start[m["from_slot"]], "to": start[m["to_slot"]]}
                      for m in c["moves"] if m["subject"] in outdoor],
            "made_indoor": [p["subject"] for p in c["after"] if p.get("converted_from")],
        })

    return {
        "date": plan["date"],
        "weekday": day.strftime("%A").lower(),
        "school": school_name,
        "verdict": plan["verdict"],
        "worst_hour": hour_fact(worst),
        "cleanest_hour": hour_fact(cleanest),
        "classes": classes,
    }


def _date_text(f):
    d = date.fromisoformat(f["date"])
    en = f"{f['weekday'].capitalize()}, {d.day} {MONTHS_EN[d.month - 1]} {d.year}"
    hi = f"{WEEKDAYS_HI[f['weekday']]}, {d.day} {MONTHS_HI[d.month - 1]} {d.year}"
    return en, hi


def template(f):
    """Plain notice written by code. Always correct; the fallback for AI text."""
    date_en, date_hi = _date_text(f)
    w, c = f["worst_hour"], f["cleanest_hour"]
    en = ["Dear parents,", ""]
    hi = ["प्रिय अभिभावक,", ""]

    if w and c and w["pm25"] == c["pm25"]:
        en.append(f"For {date_en}, the air quality forecast near {f['school']} shows PM2.5 "
                  f"at about {w['pm25']} µg/m³ ({w['category']}) through the school day.")
        hi.append(f"{date_hi} के लिए {f['school']} के पास हवा के पूर्वानुमान में पूरे स्कूल समय PM2.5 "
                  f"लगभग {w['pm25']} µg/m³ ({CATEGORY_HI.get(w['category'], w['category'])}) है।")
    elif w and c:
        en.append(f"For {date_en}, the air quality forecast near {f['school']} shows PM2.5 "
                  f"at about {w['pm25']} µg/m³ ({w['category']}) at {w['time']}, and about "
                  f"{c['pm25']} µg/m³ ({c['category']}) at {c['time']}.")
        hi.append(f"{date_hi} के लिए {f['school']} के पास हवा के पूर्वानुमान में {w['time']} बजे PM2.5 "
                  f"लगभग {w['pm25']} µg/m³ ({CATEGORY_HI.get(w['category'], w['category'])}) और "
                  f"{c['time']} बजे लगभग {c['pm25']} µg/m³ ({CATEGORY_HI.get(c['category'], c['category'])}) है।")
    else:
        en.append(f"This is the plan for {date_en} at {f['school']}.")
        hi.append(f"यह {f['school']} में {date_hi} की योजना है।")

    if f["verdict"] == "all_indoors":
        en.append("The air is expected to be Very Poor or worse for the whole school day, "
                  "so all outdoor periods will be held indoors:")
        hi.append("पूरे स्कूल समय हवा \"बहुत खराब\" या उससे बुरी रहने की संभावना है, "
                  "इसलिए बाहर होने वाले सभी पीरियड अंदर होंगे:")
        for cls in f["classes"]:
            subjects = ", ".join(cls["made_indoor"])
            en.append(f"- {cls['name']}: {subjects} indoors (estimated dose cut about {cls['reduction_pct']}%).")
            hi.append(f"- {cls['name']}: {subjects} अंदर (अनुमानित कमी लगभग {cls['reduction_pct']}%)।")
    elif any(cls["moves"] for cls in f["classes"]):
        en.append("To reduce the polluted air children breathe in, we have moved outdoor periods to cleaner hours. "
                  "No period is cancelled.")
        hi.append("बच्चों की साँस में जाने वाली प्रदूषित हवा कम करने के लिए बाहर के पीरियड साफ़ हवा वाले समय में "
                  "रखे गए हैं। कोई पीरियड रद्द नहीं हुआ है।")
        for cls in f["classes"]:
            for m in cls["moves"]:
                en.append(f"- {cls['name']}: {m['subject']} moves from {m['from']} to {m['to']}.")
                hi.append(f"- {cls['name']}: {m['subject']} अब {m['from']} की जगह {m['to']} बजे।")
            if cls["moves"]:
                en.append(f"  Estimated dose cut for {cls['name']}: about {cls['reduction_pct']}%.")
                hi.append(f"  {cls['name']} के लिए अनुमानित कमी: लगभग {cls['reduction_pct']}%।")
    else:
        en.append("No change to the timetable is needed tomorrow.")
        hi.append("कल समय-सारणी में कोई बदलाव ज़रूरी नहीं है।")

    en += ["", "These numbers are estimates based on an air quality forecast. "
               "This reduces exposure; it does not make a polluted day safe.", f"- {f['school']}"]
    hi += ["", "ये आँकड़े हवा के पूर्वानुमान पर आधारित अनुमान हैं। इससे प्रदूषण का असर कम होता है, "
               "पर प्रदूषित दिन सुरक्षित नहीं बनता।", f"- {f['school']}"]
    return {"en": "\n".join(en), "hi": "\n".join(hi)}


def _canon(token):
    if ":" in token:
        h, m = token.split(":")
        return f"{int(h)}:{m}"
    return str(float(token)).removesuffix(".0")


def allowed_numbers(f):
    """Every number or time the notice may contain."""
    d = date.fromisoformat(f["date"])
    text = json.dumps(f, ensure_ascii=False)
    found = {_canon(t) for t in _NUMBER.findall(text)}
    return found | {str(d.day), str(d.month), str(d.year), "2.5"}


def check(notice, f):
    """Problems with a notice, or [] if it is safe to show."""
    if not isinstance(notice, dict):
        return ["notice must be an object with en and hi"]
    problems = []
    allowed = allowed_numbers(f)
    needs_pct = f["verdict"] == "all_indoors" or any(c["moves"] for c in f["classes"])
    for lang in ("en", "hi"):
        text = notice.get(lang)
        if not isinstance(text, str) or not text.strip():
            problems.append(f"{lang}: missing")
            continue
        if len(text) > MAX_CHARS:
            problems.append(f"{lang}: too long ({len(text)} chars)")
        plain = text.translate(_DEVANAGARI_DIGITS)
        for token in _NUMBER.findall(plain):
            if _canon(token) not in allowed:
                problems.append(f"{lang}: number {token} is not in the facts")
        for cls in f["classes"]:
            for m in cls["moves"]:
                if m["from"] not in plain or m["to"] not in plain:
                    problems.append(f"{lang}: missing move of {m['subject']} from {m['from']} to {m['to']}")
        if needs_pct:
            for cls in f["classes"]:
                if f"{cls['reduction_pct']}%" not in plain.replace(" %", "%"):
                    problems.append(f"{lang}: missing {cls['reduction_pct']}% for {cls['name']}")
    return problems


SYSTEM = """You write short notices from a school to parents in India, in English and in Hindi.
Use only the facts provided. Do not add any number, time, date, health claim or advice that is not in the facts.
Keep every time in HH:MM form and every percentage exactly as given, with the % sign.
Keep the date, the PM2.5 values with their times, and every moved period with its old and new time.
Say that the numbers are estimates, and that this reduces exposure but does not make a polluted day safe.
Use short paragraphs, with each moved period on its own line. Keep each language under 120 words, warm and plain.
Reply in exactly this format, with nothing else:
[EN]
<English notice>
[HI]
<Hindi notice in Devanagari script>"""


def prompt(f, draft):
    """System and user text for the model."""
    user = ("Facts:\n" + json.dumps(f, ensure_ascii=False) +
            "\n\nDraft written by code (keep every fact, improve the wording):\n"
            "English:\n" + draft["en"] + "\n\nHindi:\n" + draft["hi"])
    return SYSTEM, user


_SECTIONS = re.compile(r"\[EN\]\s*\n(?P<en>.*?)\n\s*\[HI\]\s*\n(?P<hi>.*)", re.S)


def parse_ai(text):
    """Model reply -> {"en", "hi"}. Expects [EN] and [HI] sections (JSON also accepted).

    Plain sections, not JSON: inside JSON strings some models write Hindi as
    \\u escape codes, which costs about six tokens per letter.
    """
    m = _SECTIONS.search(text)
    if m:
        out = {"en": m.group("en").strip(), "hi": m.group("hi").strip()}
        if not out["en"] or not out["hi"]:
            raise ValueError("reply has an empty [EN] or [HI] section")
        return out
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end < start:
        raise ValueError("reply has no [EN]/[HI] sections")
    try:
        obj = json.loads(text[start:end + 1])
    except json.JSONDecodeError as e:
        raise ValueError(f"reply is not valid JSON: {e}") from None
    if not isinstance(obj, dict) or not all(isinstance(obj.get(k), str) for k in ("en", "hi")):
        raise ValueError("reply needs string fields en and hi")
    return {"en": obj["en"], "hi": obj["hi"]}
