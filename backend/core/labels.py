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
