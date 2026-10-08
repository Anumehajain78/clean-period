"""Backtest the sample timetable on last winter's real hourly PM2.5.

Writes data/backtest_result.json: season summary, one row per school day,
skipped days with reasons, an hourly PM2.5 profile for charts, and every
source and assumption the UI must show next to the numbers.

    python scripts/fetch_history.py   # first, if the history file is missing
    python scripts/backtest.py
"""

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO / "backend"))

from core import backtest, dose  # noqa: E402


def rounded(obj, places=2):
    if isinstance(obj, float):
        return round(obj, places)
    if isinstance(obj, dict):
        return {k: rounded(v, places) for k, v in obj.items()}
    if isinstance(obj, list):
        return [rounded(v, places) for v in obj]
    return obj


def rel(path):
    path = path.resolve()
    return str(path.relative_to(REPO)) if path.is_relative_to(REPO) else str(path)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--timetable", type=Path, default=REPO / "data" / "sample_timetable.json")
    ap.add_argument("--history", type=Path,
                    default=REPO / "data" / "history" / "pm25_28.5629_77.1678_2025-11-01_2026-01-31.json")
    ap.add_argument("--calendar", type=Path, default=REPO / "data" / "school_calendar_delhi_2025-26.json")
    ap.add_argument("--config", type=Path, default=dose.DEFAULT_CONFIG_PATH)
    ap.add_argument("--out", type=Path, default=REPO / "data" / "backtest_result.json")
    args = ap.parse_args()

    timetable = json.loads(args.timetable.read_text())
    history = json.loads(args.history.read_text())
    calendar = json.loads(args.calendar.read_text())
    config = dose.load_config(args.config)

    result = backtest.run(timetable, history["days"], backtest.expand_closures(calendar["closures"]), config)
    dates = sorted(history["days"])

    out = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "school": timetable["school"],
        "period": {"start": dates[0], "end": dates[-1]} if dates else None,
        "inputs": {
            "timetable": rel(args.timetable),
            "timetable_note": timetable.get("_note"),
            "history": rel(args.history),
            "calendar": rel(args.calendar),
            "config": rel(args.config),
        },
        "sources": {
            "air_quality": history["source"]["attribution"],
            "air_quality_note": history["source"]["note"],
            "inhalation_rates": config["inhalation_rate_m3_min"]["source"],
            "pm25_categories": config["pm25_categories"]["source"],
            "closures": [{"reason": c["reason"], "source": c["source"]} for c in calendar["closures"]],
        },
        "assumptions": [
            f"Indoor PM2.5 is {config['exposure_factor']['indoor']} x outdoor (assumption).",
            "Breathing rates are published averages for ages 6 to <11, not measured per child.",
            "PM2.5 is model data on a ~45 km grid, not a street-level measurement.",
            f"All-indoors rule uses {config['all_indoors_threshold_pm25']} ug/m3 on hourly values; "
            "CPCB bands are defined for 24-hour averages.",
            calendar["not_included"],
            "Doses are estimates.",
        ],
        **rounded(result),
    }

    args.out.write_text(json.dumps(out, indent=1, ensure_ascii=False) + "\n")
    s = out["summary"]
    print(f"wrote {rel(args.out)}")
    print(f"school days {s['school_days']}, skipped {len(out['skipped'])}, all-indoors days {s['all_indoors_days']}")
    print(f"season dose cut {s['season_reduction_pct']}%  (mean of daily cuts {s['mean_daily_reduction_pct']}%)")
    for w, v in s["by_weekday"].items():
        print(f"  {w:<10} {v['days']:2d} days  mean cut {v['mean_reduction_pct']}%")


if __name__ == "__main__":
    main()
