from core import dose, labels

CONFIG = dose.load_config()


def test_assumptions_mention_every_stated_limit():
    text = " ".join(labels.assumptions(CONFIG))
    assert "0.7" in text and "assumption" in text
    assert "6 to <11" in text
    assert "45 km" in text
    assert "120" in text and "24-hour" in text
    assert "estimates" in text.lower()


def test_assumptions_follow_config():
    cfg = {**CONFIG, "exposure_factor": {**CONFIG["exposure_factor"], "indoor": 0.5},
           "all_indoors_threshold_pm25": 90}
    text = " ".join(labels.assumptions(cfg))
    assert "0.5" in text and "90" in text


def test_label_says_estimate():
    assert "estimate" in labels.ESTIMATE_LABEL.lower()


def test_hindi_assumptions_match_english_one_to_one():
    en, hi = labels.assumptions(CONFIG), labels.assumptions_hi(CONFIG)
    assert len(hi) == len(en)
    text = " ".join(hi)
    assert "0.7" in text and "120" in text and "45" in text
    assert "अनुमान" in text


def test_hindi_assumptions_follow_config():
    cfg = {**CONFIG, "exposure_factor": {**CONFIG["exposure_factor"], "indoor": 0.5},
           "all_indoors_threshold_pm25": 90}
    text = " ".join(labels.assumptions_hi(cfg))
    assert "0.5" in text and "90" in text


def test_hindi_label():
    assert "अनुमान" in labels.ESTIMATE_LABEL_HI
