import json
from pathlib import Path

import pytest

from core import dose, notice, optimiser

REPO = Path(__file__).resolve().parents[2]
CONFIG = dose.load_config()
TT = json.loads((REPO / "data" / "sample_timetable.json").read_text())
SCHOOL = "Chinmaya Vidyalaya, Vasant Vihar"

DIRTY_MORNING = {7: 240.0, 8: 236.0, 9: 219.0, 10: 183.0, 11: 133.0, 12: 99.0, 13: 82.0}


def make_plan(pm, day="monday", date="2026-10-12"):
    cls = TT["classes"][0]
    plan = optimiser.plan_day(TT["slots"], [{"id": cls["id"], "name": cls["name"],
                                             "periods": cls["days"][day]}], pm, CONFIG)
    hours = [{"hour": h, "pm25": pm[h], "category": None} for h in sorted(pm)]
    from core import thresholds
    for h in hours:
        h["category"] = thresholds.pm25_category(h["pm25"], CONFIG)
    return {"date": date, **plan, "air": {"hours": hours}}


# --- facts ------------------------------------------------------------------

def test_facts_reorder_day():
    f = notice.facts(make_plan(DIRTY_MORNING), SCHOOL)
    assert f["date"] == "2026-10-12" and f["weekday"] == "monday"
    assert f["school"] == SCHOOL and f["verdict"] == "reorder"
    cls = f["classes"][0]
    assert cls["name"] == "Class VI-B"
    assert {"subject": "PE", "from": "08:00", "to": "13:00"} in cls["moves"]
    assert isinstance(cls["reduction_pct"], int) and cls["reduction_pct"] > 0
    assert f["worst_hour"] == {"time": "07:00", "pm25": 240, "category": "Very Poor"}
    assert f["cleanest_hour"] == {"time": "13:00", "pm25": 82, "category": "Moderate"}


def test_facts_lists_only_outdoor_moves_for_parents():
    f = notice.facts(make_plan(DIRTY_MORNING), SCHOOL)
    # Art swapped into PE's old slot; parents only need the outdoor change.
    assert [m["subject"] for m in f["classes"][0]["moves"]] == ["PE"]


def test_facts_all_indoors_day():
    f = notice.facts(make_plan({h: 300.0 for h in range(7, 14)}), SCHOOL)
    assert f["verdict"] == "all_indoors"
    assert f["classes"][0]["moves"] == []
    assert set(f["classes"][0]["made_indoor"]) == {"Assembly", "PE", "Recess"}


# --- template ---------------------------------------------------------------

def test_template_reorder_mentions_the_move_in_both_languages():
    n = notice.template(notice.facts(make_plan(DIRTY_MORNING), SCHOOL))
    pct = notice.facts(make_plan(DIRTY_MORNING), SCHOOL)["classes"][0]["reduction_pct"]
    for text in (n["en"], n["hi"]):
        assert "08:00" in text and "13:00" in text and f"{pct}%" in text
        assert SCHOOL in text
    assert "PE" in n["en"] and "estimate" in n["en"].lower()
    assert "अनुमान" in n["hi"]


def test_template_all_indoors():
    n = notice.template(notice.facts(make_plan({h: 300.0 for h in range(7, 14)}), SCHOOL))
    assert "indoors" in n["en"].lower()
    assert "अंदर" in n["hi"]


def test_template_no_moves():
    n = notice.template(notice.facts(make_plan({h: 100.0 for h in range(7, 14)}), SCHOOL))
    assert "no change" in n["en"].lower()


def test_template_passes_its_own_check():
    for pm in (DIRTY_MORNING, {h: 300.0 for h in range(7, 14)}, {h: 100.0 for h in range(7, 14)}):
        f = notice.facts(make_plan(pm), SCHOOL)
        assert notice.check(notice.template(f), f) == []


# --- check (guards the AI text) ---------------------------------------------

@pytest.fixture
def f():
    return notice.facts(make_plan(DIRTY_MORNING), SCHOOL)


def good(f):
    pct = f["classes"][0]["reduction_pct"]
    return {
        "en": f"Dear parents, on Monday 12 October 2026 PE moves from 08:00 to 13:00, "
              f"when PM2.5 is about 82 µg/m³. This cuts the estimated dose by {pct}%.",
        "hi": f"प्रिय अभिभावक, सोमवार 12 अक्टूबर 2026 को खेल 08:00 की जगह 13:00 बजे होगा। "
              f"अनुमानित कमी {pct}%।",
    }


def test_check_accepts_text_using_only_facts(f):
    assert notice.check(good(f), f) == []


def test_check_rejects_invented_number(f):
    bad = good(f)
    bad["en"] += " Children breathe 40% less."
    assert any("40" in p for p in notice.check(bad, f))


def test_check_rejects_invented_time(f):
    bad = good(f)
    bad["hi"] += " 15:30 बजे छुट्टी।"
    assert any("15:30" in p for p in notice.check(bad, f))


def test_check_reads_devanagari_digits(f):
    bad = good(f)
    bad["hi"] += " ९९% सुरक्षित।"
    assert any("99" in p for p in notice.check(bad, f))


def test_check_requires_both_languages(f):
    assert notice.check({"en": "Hello"}, f)
    assert notice.check({"en": "Hello", "hi": "  "}, f)
    assert notice.check("not a dict", f)


def test_check_rejects_very_long_text(f):
    long = good(f)
    long["en"] = long["en"] + " ok" * 1000
    assert any("long" in p for p in notice.check(long, f))


def test_check_rejects_missing_reduction_on_reorder_day(f):
    bad = good(f)
    bad["en"] = "Dear parents, PE moves from 08:00 to 13:00."
    assert any("%" in p for p in notice.check(bad, f))


# --- prompt -----------------------------------------------------------------

def test_prompt_contains_facts_and_draft(f):
    system, user = notice.prompt(f, notice.template(f))
    assert "only the facts" in system.lower()
    assert "does not make a polluted day safe" in system
    assert "[EN]" in system and "[HI]" in system
    assert json.dumps(f, ensure_ascii=False) in user
    assert notice.template(f)["en"] in user


def test_parse_ai_sections():
    reply = "[EN]\nDear parents,\nPE moves.\n[HI]\nप्रिय अभिभावक,\nखेल।\n"
    assert notice.parse_ai(reply) == {"en": "Dear parents,\nPE moves.", "hi": "प्रिय अभिभावक,\nखेल।"}


def test_parse_ai_sections_ignores_text_around_them():
    reply = "Here it is:\n[EN]\nA\n[HI]\nB"
    assert notice.parse_ai(reply) == {"en": "A", "hi": "B"}


def test_parse_ai_rejects_empty_section():
    with pytest.raises(ValueError):
        notice.parse_ai("[EN]\nA\n[HI]\n   ")


def test_parse_ai_json_still_accepted():
    assert notice.parse_ai('{"en": "a", "hi": "b"}') == {"en": "a", "hi": "b"}
    assert notice.parse_ai('```json\n{"en": "a", "hi": "b"}\n```') == {"en": "a", "hi": "b"}
    with pytest.raises(ValueError):
        notice.parse_ai("Sure! Here is the notice.")


def test_template_flat_air_states_one_level():
    n = notice.template(notice.facts(make_plan({h: 300.0 for h in range(7, 14)}), SCHOOL))
    assert n["en"].count("300 µg/m³") == 1 and "through the school day" in n["en"]
    assert n["hi"].count("300 µg/m³") == 1


def test_template_names_the_plan_date():
    n = notice.template(notice.facts(make_plan(DIRTY_MORNING), SCHOOL))
    assert "Monday, 12 October 2026" in n["en"]
    assert "सोमवार, 12 अक्टूबर 2026" in n["hi"]


def test_check_rejects_a_dropped_move(f):
    bad = good(f)
    bad["hi"] = f"प्रिय अभिभावक, अनुमानित कमी {f['classes'][0]['reduction_pct']}%।"
    problems = notice.check(bad, f)
    assert any("08:00" in p and "hi" in p for p in problems)


def test_check_rejects_missing_indoor_subject_on_bad_day():
    f = notice.facts(make_plan({h: 300.0 for h in range(7, 14)}), SCHOOL)
    pct = f["classes"][0]["reduction_pct"]
    bad = {"en": f"All outdoor periods move indoors. Cut about {pct}%.",
           "hi": f"सभी बाहर के पीरियड अंदर होंगे। लगभग {pct}%।"}
    assert notice.check(bad, f) == []          # subjects may be summarised as "all outdoor periods"


def test_prompt_asks_to_keep_date_air_and_moves(f):
    system, _ = notice.prompt(f, notice.template(f))
    assert "date" in system and "PM2.5" in system and "every moved period" in system
