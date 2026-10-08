"""The full plan response for one school day, shared by POST /plan and the nightly job."""

from core import labels, optimiser, thresholds


def air_summary(slots, hourly, forecast, config):
    hours = thresholds.school_hours(slots)
    return {
        "hours": [{"hour": h, "pm25": hourly.get(h),
                   "category": thresholds.pm25_category(hourly[h], config) if hourly.get(h) is not None else None}
                  for h in hours],
        "unit": "μg/m³",
        "source": forecast["source"],
        "grid_point": forecast["grid_point"],
        "fetched_at": forecast["fetched_at"],
        "cached": forecast["cached"],
        "category_source": config["pm25_categories"]["source"],
        "category_note": config["pm25_categories"]["note"],
    }


def plan_response(day, slots, classes, hourly, forecast, config, ground_capacity=None):
    """Plan, air quality for school hours, and the labels the UI must show.

    forecast: the source fields of a forecast (source, grid_point, fetched_at, cached).
    Raises ValueError when the timetable breaks a constraint or an hour has no PM2.5.
    """
    plan = optimiser.plan_day(slots, classes, hourly, config, ground_capacity=ground_capacity)
    return {
        "date": day,
        **plan,
        "air": air_summary(slots, hourly, forecast, config),
        "assumptions": labels.assumptions(config),
        "assumptions_hi": labels.assumptions_hi(config),
        "label": labels.ESTIMATE_LABEL,
        "label_hi": labels.ESTIMATE_LABEL_HI,
    }
