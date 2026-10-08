"""Text that must travel with every number shown to a user."""

ESTIMATE_LABEL = ("Estimates from a PM2.5 forecast and published average breathing rates. "
                  "This reduces exposure; it does not make a severe day safe.")


def assumptions(config):
    return [
        f"Indoor PM2.5 is taken as {config['exposure_factor']['indoor']} x outdoor (assumption).",
        "Breathing rates are published averages for ages 6 to <11 "
        f"({config['inhalation_rate_m3_min']['source']}), not measured per child.",
        "PM2.5 is model data on a ~45 km grid, not a street-level measurement.",
        f"The all-indoors rule uses {config['all_indoors_threshold_pm25']} ug/m3 on hourly values; "
        "CPCB bands are defined for 24-hour averages.",
        "Doses are estimates.",
    ]


ESTIMATE_LABEL_HI = ("PM2.5 पूर्वानुमान और प्रकाशित औसत साँस दर पर आधारित अनुमान। "
                     "इससे प्रदूषण का असर कम होता है, पर बहुत खराब दिन सुरक्षित नहीं बनता।")


def assumptions_hi(config):
    """Hindi version of `assumptions`, same order."""
    return [
        f"कमरे के अंदर PM2.5 को बाहर का {config['exposure_factor']['indoor']} गुना माना गया है (मान्यता)।",
        "साँस की दर 6 से 11 साल के बच्चों की प्रकाशित औसत दर है "
        f"({config['inhalation_rate_m3_min']['source']}), हर बच्चे के लिए मापी नहीं गई।",
        "PM2.5 लगभग 45 km के ग्रिड का मॉडल डेटा है, किसी सड़क का माप नहीं।",
        f"\"सब अंदर\" नियम घंटे के मानों पर {config['all_indoors_threshold_pm25']} µg/m³ का उपयोग करता है; "
        "CPCB श्रेणियाँ 24 घंटे के औसत के लिए बनी हैं।",
        "खुराक के आँकड़े अनुमान हैं।",
    ]
