# Clean Period

A web app that rearranges a school's timetable for tomorrow so children breathe
less polluted air, without cancelling any period.

Built for Environmental Hacks 2026 (WeMakeDevs x AWS), Track 01 Air, sub-topic
"School safety on bad days". Submission: 3-minute demo video, public repo, live
URL on AWS. Deadline is Oct 11, 2026 (check the schedule page for the exact time).

## The idea in one paragraph

What harms a child is the inhaled dose: pollution level x breathing rate x time.
A running child breathes several times more air per minute than a sitting one,
so one outdoor sports period at a polluted hour can be a large share of the
day's dose. Schools only get "open or closed". Clean Period takes the real
timetable and tomorrow's hourly forecast, and moves outdoor periods to the
cleanest hours.

## The one flow that must work

1. A teacher enters the school location and one or more class timetables.
2. The backend fetches tomorrow's hourly PM2.5 forecast for that location.
3. The dose engine computes the inhaled dose for every period of every class.
4. The optimiser rearranges periods to minimise total dose.
5. The UI shows the timetable before and after, the percentage dose cut per
   class, and a ready notice for parents in Hindi and English.

## Dose model

    dose (ug) = PM2.5 (ug/m3) x exposure_factor x inhalation_rate (m3/min) x minutes

- exposure_factor: 1.0 outdoors, INDOOR_FACTOR indoors. Default 0.7. This is an
  assumption, keep it configurable and label it in the UI.
- Inhalation rates for ages 6 to <11, in m3/min: sedentary 0.0048, light 0.011,
  moderate 0.022, high 0.042. Verified 2026-10-08: these are the means in US EPA
  Exposure Factors Handbook (2011), Chapter 6, Table 6-2.
  https://www.epa.gov/sites/production/files/2015-09/documents/efh-chapter06.pdf
- Activity mapping: classroom = sedentary, indoors. Assembly = light, outdoors.
  Recess = moderate, outdoors. PE and sports = high, outdoors. Indoor activity
  (yoga, board games) = light, indoors.
- All of the above lives in `backend/config/dose_config.json`. Never hard-code.
- Bad-day rule: if no school hour is at or below the "all indoors" PM2.5
  threshold, the plan is "all outdoor periods become indoor activity". The
  threshold is 120 ug/m3, the top of Poor, so the rule triggers when every
  school hour is Very Poor or worse (decided 2026-10-08). Thresholds follow
  CPCB National AQI (2014) PM2.5 categories, 24-hour average, ug/m3: Good 0-30,
  Satisfactory 31-60, Moderate 61-90, Poor 91-120, Very Poor 121-250,
  Severe above 250. Verified 2026-10-08 from the IMD AQI SOP, Table 3.1
  (https://mausam.imd.gov.in/imd_latest/contents/pdf/emrc_sop.pdf), with the
  30/60 edges confirmed in a CPCB bulletin. The original CPCB 2014 report could
  not be fetched. The categories are defined for 24-hour averages, and IMD says
  AQI is "not on hourly concentration", so applying them to hourly values is
  an approximation. Say so.

## Optimiser

Input per period: class, subject, activity type, teacher, place (classroom or
ground), movable (true or false).

Constraints:
- A teacher cannot be in two classes at once.
- The ground holds at most N classes at once (configurable).
- Fixed periods (lunch, exams) never move. Assembly and recess are whole-school
  slots and are fixed too. Only the bad-day rule moves them indoors.
- Every class keeps exactly the same set of periods, only the order changes.

Objective: minimise total dose across all classes.

Version 1 (done, `core/optimiser.py`): greedy search over swaps of any two
movable periods with different activities, in slots of the same length. It
rejects swaps that break a constraint. For one class without clashes this
reaches the best order (a test checks this against brute force). The ground
limit counts only movable ground periods, not whole-school assembly or recess. Version 2, only if version 1 is done and tested:
OR-Tools CP-SAT.

## Backtest (this is our proof)

`scripts/backtest.py` takes the school timetable and real hourly PM2.5 for
last winter (Nov 2025 to Jan 2026). For every school day it computes the dose
with the original and the optimised timetable, and writes the season-average
reduction plus chart data for the UI. Air data is real only, never synthetic.
Show the data source on screen.

The timetable is `data/sample_timetable.json` (Class VI-B), transcribed from
`data/class6_timetable.png`. It is a SAMPLE timetable, not the real timetable of
any school. Location: Chinmaya Vidyalaya, Vasant Vihar, New Delhi (28.5629,
77.1678). The UI, README and demo must say "sample timetable, real air data".
Swap in a real timetable if we get one.

School days skip weekends and the closures in
`data/school_calendar_delhi_2025-26.json` (DoE winter vacation 1-15 Jan 2026
and gazetted or declared holidays, each with a source). Days when GRAP orders
moved classes online are not removed; say so. The result is in
`data/backtest_result.json`. It reports two figures: the season dose cut
(total dose before vs after, the headline) and the mean of the daily cuts.

## Data source

Open-Meteo Air Quality API, hourly `pm2_5`, timezone Asia/Kolkata.
`https://air-quality-api.open-meteo.com/v1/air-quality`
Forecast with `forecast_days` (default 5, max 7), past data with `start_date`
and `end_date`.
Verified 2026-10-08:
- No API key needed. Free tier is non-commercial only, limited to 600 calls/min,
  5,000/hour and 10,000/day. Data is CC BY 4.0: credit "Open-Meteo" and
  "CAMS (Copernicus)" on screen.
- Over India the data comes from the CAMS Global model: about 0.4 deg (~45 km)
  grid, 3-hourly steps, returned as hourly values. History has values from
  early Aug 2022; earlier dates return nulls. Nov 2025 to Jan 2026 is complete
  for Delhi (2208 hours, no nulls).
Cache every response in DynamoDB. The forecast covers an area of about 45 km,
not one street. Hour-to-hour changes are partly interpolated, so the plan
mostly follows the daily cycle (morning and evening peaks), not exact hours.

## Architecture (AWS, region ap-south-1)

- Frontend: React + Vite + TypeScript + Tailwind, on Amplify Hosting.
- API: API Gateway (HTTP API) to Lambda (Python 3.12).
- Lambdas: `schools`, `forecast`, `plan` (dose + optimiser), `notice`, `extract`.
- DynamoDB, single table: School, Timetable, Plan, ForecastCache.
- EventBridge Scheduler: every evening at 19:00 IST, build tomorrow's plan for
  every saved school.
- Bedrock: writes the parent notice from the plan JSON, and (should-have) reads
  a timetable photo into JSON. Check which vision model is enabled in the region.
- S3: uploaded timetable photos.
- Deploy: AWS SAM, template in `infra/`, settings in `samconfig.toml`.
  Backend deployed 2026-10-08 as stack `clean-period` in account 373544523000
  (Ledger Orbit), ap-south-1: API https://6d96lz6fye.execute-api.ap-south-1.amazonaws.com.
  Site: https://main.d32sdayd4hpv2r.amplifyapp.com (Amplify app d32sdayd4hpv2r,
  manual-deploy app, no Amplify GitHub connection). CORS allows only that site.
  Every push to main runs `.github/workflows/deploy.yml`: tests, `sam deploy`,
  then builds the frontend with the live ApiUrl and publishes it to Amplify.
  GitHub signs in with OIDC to role `github-deploy-clean-period`, created once
  by `infra/github-deploy.yaml` (stack `clean-period-github`, also owns the
  Amplify app). Bedrock model access not enabled yet, so the live notice is the
  template. API contract: `docs/api.md`.
- Notice: `core/notice.py` builds facts and a template notice; the `notice`
  Lambda asks Claude Opus 5.5 on Bedrock (`anthropic.claude-opus-5-5`, global
  endpoint from ap-south-1, so inference may run outside India) to reword it
  and keeps the AI text only if every number in it is in the facts. The SDK is
  a Lambda layer on that function only; all Lambdas are x86_64 so the layer
  builds without Docker.
- Nightly: `schools` Lambda saves timetables (no accounts: a secret edit key,
  stored hashed). `nightly` Lambda runs at 19:00 Asia/Kolkata via a SAM
  `ScheduleV2` event, plans tomorrow for every saved school with
  `core/nightly.py` and stores the result (plan + template notice, 30-day TTL).
  The AI notice is not used at night, to keep Bedrock calls on demand only.

Design rule: AI reads and writes text. Code decides the plan. The plan never
depends on a model's opinion.

## Repo layout

    clean-period/
      CLAUDE.md
      README.md
      frontend/
      backend/
        core/          dose.py, optimiser.py, thresholds.py (pure Python)
        functions/     one folder per Lambda
        config/        dose_config.json
        tests/
      infra/           template.yaml (SAM)
      scripts/         fetch_history.py, backtest.py
      data/            sample_timetable.json, history/
      docs/            architecture.md, demo-script.md

Owners: Anumeha (GitHub Anumehajain78) owns `backend/`, `infra/`, `scripts/`.
Rakshit (GitHub rakshitjain23) owns `frontend/` and `docs/`. Commit each
owner's folders under that owner's git author. Say so before editing the other
owner's folder.

## Scope

Must have:
- Manual timetable entry for at least one class
- Forecast fetch, dose engine, optimiser version 1
- Before and after timetable with percentage dose cut
- "All indoors" verdict on the worst days
- Backtest result shown in the UI
- Parent notice in Hindi and English
- Deployed on AWS with a live URL

Should have:
- Timetable photo upload read by Bedrock, with an edit screen
- Nightly automatic plan
- Multiple classes sharing one ground

Do not build:
- Login or accounts
- A general AQI dashboard or map
- Per-child health profiles
- Native mobile app
- SMS or WhatsApp sending (a copy button is enough)

## Working rules for Claude Code

- Works for any school at any location. Nothing school-specific in code:
  location, slot times, number and length of periods, subjects and teachers all
  come from input. Tests cover at least two different schools (different
  cities, slot counts and lengths). Chinmaya Vidyalaya is only the demo and
  backtest example. The CPCB bands and the Hindi notice make the product
  India-first. Say that, and don't promise other countries.
- `backend/core/` has no AWS calls and has unit tests for every function.
- Write the test first for dose and optimiser logic.
- Every number shown to a user is labelled as an estimate, with its source.
- No invented data anywhere in the app or the demo.
- Mobile-first UI. All UI strings in one file with `en` and `hi` keys.
- Ask before adding a dependency. Keep commits small.
- If something in this file marked VERIFY turns out wrong, fix the file.

## Build order

1. `core/dose.py` with tests, using `data/sample_timetable.json`
2. `scripts/fetch_history.py` and the `forecast` Lambda
3. `core/optimiser.py` version 1 with tests
4. `scripts/backtest.py` and its chart data
5. SAM deploy of `plan` and `forecast`, then the frontend flow
6. Parent notice, then the nightly schedule
7. Photo upload if time remains
8. README, architecture diagram, demo video

## Limits we state openly

- Doses are estimates built on a forecast and published average breathing rates.
- The indoor factor is an assumption.
- The forecast is area-level (~45 km grid), not street-level.
- This reduces exposure. It does not make a severe day safe.
