# Clean Period API

Base URL: the `ApiUrl` output of the SAM stack (not deployed yet). All
responses are JSON. Errors are `{"error": "<message>"}` with status 400 (bad
input) or 502 (Open-Meteo unreachable).

## GET /forecast

Query: `lat`, `lon`, optional `date` (YYYY-MM-DD, default tomorrow at the
location), optional `timezone` (default `Asia/Kolkata`).

```json
{
  "date": "2026-10-09",
  "timezone": "Asia/Kolkata",
  "pm25_hourly": [97.1, 104.0, "... 24 values, index = hour, null if missing"],
  "unit": "μg/m³",
  "grid_point": {"latitude": 28.6, "longitude": 77.2},
  "fetched_at": "2026-10-08T12:00:00+00:00",
  "cached": false,
  "source": "Open-Meteo Air Quality API (CC BY 4.0), CAMS Global data from Copernicus",
  "note": "Area-level model forecast (CAMS Global, ~45 km grid), not a street-level measurement."
}
```

## POST /plan

Body: the school, the slots, and each class's periods **for that day**
(same shape as `data/sample_timetable.json`, with `days.<weekday>` flattened
to `periods`). `date` is optional and defaults to tomorrow at the school.

```json
{
  "school": {"latitude": 28.5629, "longitude": 77.1678, "timezone": "Asia/Kolkata", "ground_capacity": null},
  "slots": [{"id": "p1", "start": "08:00", "end": "08:40"}],
  "classes": [{"id": "6B", "name": "Class VI-B", "periods": [
    {"slot": "p1", "subject": "PE", "activity": "pe", "teacher": "T-PE", "place": "ground", "movable": true}
  ]}],
  "date": "2026-10-09"
}
```

`activity` is one of `classroom`, `assembly`, `recess`, `pe`, `indoor_activity`.

Response:

```json
{
  "date": "2026-10-09",
  "verdict": "reorder | all_indoors",
  "classes": [{
    "id": "6B", "name": "Class VI-B",
    "before": ["periods in slot order, each with start, end, dose_ug"],
    "after":  ["same; converted periods carry converted_from"],
    "before_ug": 389.2, "after_ug": 338.4, "reduction_pct": 13.0,
    "moves": [{"subject": "PE", "from_slot": "p1", "to_slot": "p8"}]
  }],
  "total_before_ug": 389.2, "total_after_ug": 338.4, "reduction_pct": 13.0,
  "air": {
    "hours": [{"hour": 7, "pm25": 97.1, "category": "Poor"}],
    "unit": "μg/m³", "source": "...", "grid_point": {}, "fetched_at": "...", "cached": false,
    "category_source": "...", "category_note": "Bands are defined for 24-hour averages..."
  },
  "assumptions": ["Indoor PM2.5 is taken as 0.7 x outdoor (assumption).", "..."],
  "label": "Estimates from a PM2.5 forecast and published average breathing rates. ..."
}
```

The UI must show `label`, `assumptions` and `air.source` next to the numbers.

## POST /notice

Body: `{"plan": <the POST /plan response>, "school_name": "...", "use_ai": true}`

```json
{
  "en": "Dear parents, ...",
  "hi": "प्रिय अभिभावक, ...",
  "source": "ai | template",
  "model": "apac.amazon.nova-pro-v1:0",
  "fallback_reason": "only when AI text was rejected or failed",
  "facts": {"date": "...", "verdict": "...", "classes": [], "worst_hour": {}, "cleanest_hour": {}},
  "label": "Estimates from a PM2.5 forecast ..."
}
```

Code writes a template notice from the plan's facts. With AI on, Amazon Nova
Pro on Amazon Bedrock rewrites it for tone; the AI text is used only if every
number and time in it appears in `facts` and every moved period is kept, otherwise the template comes back with
`fallback_reason`. The UI shows which one it is.

## POST /outlook and POST /backtest

Body for both: the same as `POST /plan` (school, slots, classes for one day).

`/outlook` plans the next 5 school days (Monday to Friday, from tomorrow) with
the 7-day forecast:

```json
{"days": [{"date": "2026-10-12", "weekday": "monday", "status": "planned | no_forecast",
           "verdict": "reorder", "reduction_pct": 20.6, "moved": 1,
           "school_mean_pm25": 39.0, "school_max_pm25": 61.0, "category": "Satisfactory",
           "hours": [{"hour": 7, "pm25": 61.0}], "cleanest": true}],
 "source": "...", "grid_point": {}, "fetched_at": "...", "category_note": "...", "label": "...", "label_hi": "..."}
```

`moved` counts outdoor periods only. A day the forecast does not fully cover is
`no_forecast`. The planned day with the lowest school-hours mean is `cleanest`.

`/backtest` replays last winter (1 Nov 2025 to 31 Jan 2026, real hourly
PM2.5 at the school, cached 30 days) with the same timetable every weekday:

```json
{"summary": {"school_days": 65, "all_indoors_days": 5, "season_reduction_pct": 28.9, "mean_daily_reduction_pct": 26.4},
 "days": [{"date": "2025-11-03", "reduction_pct": 24.1, "verdict": "reorder"}], "skipped": 27,
 "hourly_profile": [{"hour": 7, "median_pm25": 140.0, "days": 65}],
 "period": {"start": "2025-11-01", "end": "2026-01-31"}, "source": "...", "grid_point": {},
 "assumptions": ["..."], "assumptions_hi": ["..."], "label": "...", "label_hi": "..."}
```

Weekends are skipped; holidays are not removed (they differ by school and
state); the assumptions list says both.

## POST /extract

Body: `{"image": "<base64, data: prefix allowed>", "media_type": "image/jpeg | image/png | image/webp"}`,
at most 3.5 MB after decoding (the site shrinks photos first).

```json
{
  "class_name": "VI - B",
  "days": {"monday": [{"start": "07:40", "end": "08:00", "subject": "Assembly", "activity": "assembly", "teacher": ""}]},
  "dropped": 0,
  "note": "Read by AI from the photo. Check every row against the timetable before planning."
}
```

Amazon Nova Pro reads the photo; `core/extract.py` keeps only rows with valid
24-hour times, an end after the start and a subject, sorts them, and counts
the rest in `dropped`. Activities missing or unknown are guessed from the
subject (PE, games, assembly, break, yoga). A read takes about 20 s.
Errors: 400 bad input, 413 photo too large, 422 nothing found, 502 the model
could not read it, 503 reading switched off.

## Saved schools and the nightly plan

No accounts. Saving a school returns a secret `edit_key` once; only its hash is
stored. The frontend keeps the id and key in the browser.

| Method and path | Body / header | Response |
|---|---|---|
| `POST /schools` | `{"timetable": <same shape as data/sample_timetable.json>}` | `201 {"id", "edit_key"}`, or `400 {"error", "problems": [...]}` |
| `GET /schools/{id}` | | `{"id", "timetable"}` |
| `PUT /schools/{id}` | header `x-edit-key`, `{"timetable": ...}` | `200`, `403` wrong key, `404` unknown |
| `GET /schools/{id}/plans/latest` | | newest nightly result, `404` if none yet |

Nightly result:

```json
{
  "date": "2026-10-09",
  "status": "planned | no_school | error",
  "reason": "only for no_school and error",
  "plan": "<same shape as the POST /plan response>",
  "notice": {"en": "...", "hi": "...", "source": "template"},
  "created_at": 1791460000
}
```

The `nightly` Lambda runs every evening at 19:00 Asia/Kolkata (EventBridge
Scheduler). For each saved school it fetches the forecast, plans tomorrow's
weekday, writes the template notice and stores the result for 30 days. A
school with no lessons tomorrow gets `no_school`; a failure for one school is
stored as `error` and the run continues. Locally, `POST /_nightly` on
`scripts/local_api.py` runs it now (saved schools are in memory there).

## Backtest data

`data/backtest_result.json` (from `scripts/backtest.py`), static, for the
backtest screen: `summary`, `days`, `skipped`, `hourly_profile`, `sources`,
`assumptions`, `label`.

## Build and test locally

    cd backend && ../.venv/bin/pytest
    sam build -t infra/template.yaml
    python scripts/local_api.py                   # AI notice off
    NOTICE_USE_AI=1 python scripts/local_api.py   # AI notice on: calls Amazon Bedrock
