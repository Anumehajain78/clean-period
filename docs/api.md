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
  "model": "anthropic.claude-opus-4-8",
  "fallback_reason": "only when AI text was rejected or failed",
  "facts": {"date": "...", "verdict": "...", "classes": [], "worst_hour": {}, "cleanest_hour": {}},
  "label": "Estimates from a PM2.5 forecast ..."
}
```

Code writes a template notice from the plan's facts. With AI on, Claude on
Amazon Bedrock rewrites it for tone; the AI text is used only if every number
and time in it appears in `facts`, otherwise the template comes back with
`fallback_reason`. The UI shows which one it is.

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
