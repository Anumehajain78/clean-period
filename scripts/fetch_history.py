"""Download real past hourly PM2.5 for a school location from Open-Meteo.

Writes data/history/pm25_<lat>_<lon>_<start>_<end>.json with the source URL,
attribution and fetch time, and one list of 24 hourly values per date
(index = hour, local time). Missing hours stay null; nothing is filled in.

    python scripts/fetch_history.py                      # sample school, Nov 2025 to Jan 2026
    python scripts/fetch_history.py --lat 26.85 --lon 80.95 --start 2025-12-01 --end 2025-12-31
"""

import argparse
import json
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO / "backend"))

from core import openmeteo  # noqa: E402


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--timetable", default=REPO / "data" / "sample_timetable.json", type=Path,
                    help="read location and timezone from this timetable (default: the sample)")
    ap.add_argument("--lat", type=float, help="override latitude")
    ap.add_argument("--lon", type=float, help="override longitude")
    ap.add_argument("--timezone", help="override timezone")
    ap.add_argument("--start", default="2025-11-01")
    ap.add_argument("--end", default="2026-01-31")
    ap.add_argument("--out", default=REPO / "data" / "history", type=Path)
    args = ap.parse_args()

    school = json.loads(args.timetable.read_text())["school"]
    lat = args.lat if args.lat is not None else school["latitude"]
    lon = args.lon if args.lon is not None else school["longitude"]
    tz = args.timezone or school["timezone"]

    url = openmeteo.history_url(lat, lon, args.start, args.end, timezone=tz)
    print(f"GET {url}")
    with urllib.request.urlopen(url, timeout=60) as resp:
        raw = json.load(resp)
    days = openmeteo.hourly_by_date(raw)

    out = {
        "source": {
            "attribution": openmeteo.ATTRIBUTION,
            "url": url,
            "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "requested": {"latitude": lat, "longitude": lon},
            "grid_point": {"latitude": raw.get("latitude"), "longitude": raw.get("longitude")},
            "timezone": raw.get("timezone"),
            "unit": openmeteo.EXPECTED_UNIT,
            "note": "Area-level model data (CAMS Global, ~45 km grid), not a street-level measurement.",
        },
        "hours_missing": openmeteo.count_missing(days),
        "days": {d: [hours.get(h) for h in range(24)] for d, hours in sorted(days.items())},
    }

    args.out.mkdir(parents=True, exist_ok=True)
    path = args.out / f"pm25_{lat}_{lon}_{args.start}_{args.end}.json"
    path.write_text(json.dumps(out, indent=1, ensure_ascii=False) + "\n")
    print(f"wrote {path.relative_to(REPO) if path.is_relative_to(REPO) else path}: "
          f"{len(out['days'])} days, {out['hours_missing']} missing hours")


if __name__ == "__main__":
    main()
