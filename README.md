# Clean Period

**Same periods, cleaner air.** Clean Period rearranges a school's timetable for
tomorrow so that outdoor periods fall in the hours with the cleanest air. No
period is cancelled.

**Live:** https://main.d32sdayd4hpv2r.amplifyapp.com

Built for Environmental Hacks 2026 (WeMakeDevs x AWS), Track 01 Air, sub-topic
*School safety on bad days*.

---

## The problem

On a polluted day a school can only stay open or close. But what harms a child
is the **inhaled dose**: pollution × breathing rate × time. A child running in
a PE period breathes almost **nine times** as much air per minute as a child
sitting in class (US EPA Exposure Factors Handbook, ages 6 to under 11). In
Delhi's winter the air at 8 a.m. is often about twice as polluted as at 1 p.m.
So one outdoor sports period in the morning can be a large share of the whole
day's dose.

Clean Period takes the school's real timetable and tomorrow's hourly PM2.5
forecast, and moves outdoor periods to the cleanest hours.

## What it does

1. **Enter the timetable.** Find the school's town, then for each class
   fill the school day (start time, period length, break), read a photo of the
   printed timetable with AI, or add periods one by one. New classes copy the
   bell times.
2. **Make tomorrow's plan.** The backend fetches the hourly PM2.5 forecast,
   computes the inhaled dose of every period and searches for the order with
   the lowest total dose, without breaking school rules.
3. **See before and after.** The school day is drawn as a strip over the
   hourly air colours, so you see PE move out of a red hour into a green one,
   with the estimated dose cut per class.
4. **Send the parent notice.** A ready notice in **Hindi and English**, worded
   by AI and checked by code, with a copy button.
5. **This week.** The same timetable planned for each coming school day, with
   the **cleanest day for outdoor events** marked.
6. **Your school, last winter.** Last winter's real hourly air at the school's
   own location, replayed against its timetable: the season dose cut it would
   have had.
7. **Download** any timetable, or the new one, as CSV or a printable PDF.
8. **Bad days.** If every school hour is Very Poor or worse (above
   120 µg/m³), every outdoor period becomes an indoor activity.
9. **Nightly plan.** Saved schools get tomorrow's plan and notice built every
   evening at 19:00 IST.

Every number on screen is labelled as an estimate, with its source.

## Does it work? The evidence

We replayed every school day of last winter (1 Nov 2025 to 31 Jan 2026) with
**real hourly air data** for Vasant Vihar, New Delhi, and a Class VI timetable,
skipping weekends, the DoE winter vacation and gazetted holidays:

| | |
|---|---|
| Season dose cut (total dose before vs after) | **22%** |
| Mean of daily cuts | 17% |
| School days | 50 |
| All-indoors days | 1 |

**Sample timetable, real air data.** The timetable is a test timetable, not the
real timetable of any school. The Evidence tab shows the per-day chart; the
"Last winter" tab runs the same replay for any school's own timetable and town.

## How it works

```
dose (µg) = PM2.5 (µg/m³) × exposure factor × inhalation rate (m³/min) × minutes
```

| Activity | Breathing rate (m³/min), ages 6 to <11 | Where |
|---|---|---|
| Classroom | 0.0048 (sitting) | indoors |
| Assembly, indoor activity | 0.011 (light) | outdoors / indoors |
| Recess | 0.022 (moderate) | outdoors |
| PE, sports | 0.042 (high) | outdoors |

Indoor air is taken as 0.7 × outdoor (an assumption, configurable in
`backend/config/dose_config.json`). Air bands follow CPCB's National AQI.

**The optimiser** swaps movable periods within each class and keeps the swap
that lowers the total dose most, until no swap helps. Rules it never breaks: a
teacher is never in two classes at once, the ground holds at most N classes,
fixed periods (assembly, recess, exams) never move, and every class keeps the
same periods. For one class it reaches the best possible order; a test checks
this against brute force.

**Design rule: code decides the plan, AI only handles text.** AI reads timetable
photos and words the parent notice. Code validates every row it reads and
rejects any notice with a number or time that is not in the plan.

## Architecture

Full diagram and request flows: **[docs/architecture.md](docs/architecture.md)**.
API reference: **[docs/api.md](docs/api.md)**.

```
Browser (React on Amplify) ──> API Gateway (HTTP API) ──> Lambda (Python 3.12)
                                                            ├── forecast, plan, insights ──> Open-Meteo (CAMS)
                                                            ├── notice, extract ───────────> Bedrock (Amazon Nova Pro)
                                                            └── schools, nightly ──────────> DynamoDB
EventBridge Scheduler (19:00 IST) ──> nightly Lambda
GitHub Actions (OIDC) ──> SAM deploy + Amplify publish on every push to main
```

## Tech stack

| Layer | What we used |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4; Mukta (Latin + Devanagari) and Bricolage Grotesque type; no chart library |
| Backend | Python 3.12, standard library only in `backend/core/` (dose engine, optimiser, thresholds, notice, insights); boto3 in Lambda |
| AI | Amazon Bedrock, Amazon Nova Pro (Converse API): timetable photo reading and notice wording |
| Data | Open-Meteo Air Quality API (CAMS Global, Copernicus), Open-Meteo Geocoding (GeoNames) |
| Infra | AWS SAM / CloudFormation, GitHub Actions with OIDC |
| Tests | pytest, 257 tests |

## How we used AWS (region ap-south-1, Mumbai)

| Service | Role |
|---|---|
| **AWS Amplify Hosting** | Serves the website |
| **Amazon API Gateway** (HTTP API) | Public API, CORS locked to the site |
| **AWS Lambda** | 7 functions: `forecast`, `plan`, `notice`, `extract`, `insights`, `schools`, `nightly` |
| **Amazon DynamoDB** | One table: forecast and history cache, saved schools, nightly results; TTL expiry, one GSI |
| **Amazon EventBridge Scheduler** | Runs the nightly plan at 19:00 Asia/Kolkata |
| **Amazon Bedrock** | Amazon Nova Pro reads timetable photos and words the Hindi/English notice |
| **AWS SAM / CloudFormation** | All infrastructure as code (`infra/template.yaml`) |
| **AWS IAM** (OIDC) | GitHub Actions deploys with a short-lived role; no stored keys |
| **Amazon CloudWatch** | Lambda logs, including nightly run summaries |

## Data sources and credits

- Air quality: [Open-Meteo Air Quality API](https://open-meteo.com/en/docs/air-quality-api), CC BY 4.0;
  model data from CAMS Global (Copernicus), about 45 km grid.
- Place search: Open-Meteo Geocoding API, location data from GeoNames.
- Breathing rates: US EPA Exposure Factors Handbook (2011), Chapter 6, Table 6-2.
- Air bands: CPCB National AQI (2014), as tabled in the IMD AQI SOP.
- School calendar (evidence only): Delhi Directorate of Education 2025-26 and
  gazetted holidays, with sources in `data/school_calendar_delhi_2025-26.json`.

## Limits we state openly

- Doses are estimates built on a forecast and published average breathing rates.
- The indoor factor (0.7) is an assumption.
- The forecast is area-level (about 45 km grid), not street-level.
- CPCB bands are defined for 24-hour averages; applying them to hourly values
  is an approximation.
- Built for India: the bands are CPCB's and the notice is in Hindi and English.
- This reduces exposure. It does not make a severe day safe.

## Run it locally

```bash
python3 -m venv .venv && .venv/bin/pip install -r backend/requirements-dev.txt
cd backend && ../.venv/bin/pytest            # 257 tests
```

```bash
.venv/bin/python scripts/local_api.py         # API on http://127.0.0.1:8787 (AI off unless NOTICE_USE_AI=1)
npm --prefix frontend install
npm --prefix frontend run dev                 # site on http://localhost:5173
```

Set `VITE_API_URL` in `frontend/.env.local` to point the site at an API.
Rebuild the evidence: `python scripts/fetch_history.py && python scripts/backtest.py`.

## Deploy

```bash
sam build -t infra/template.yaml && sam deploy
```

Every push to `main` runs `.github/workflows/deploy.yml`: tests, `sam deploy`,
then the site is built with the live API URL and published to Amplify. The
one-time GitHub-to-AWS trust is `infra/github-deploy.yaml`.

## Repository

```
backend/core/        dose, optimiser, thresholds, planning, notice, extract, insights, backtest (pure Python)
backend/functions/   one folder per Lambda
backend/config/      dose_config.json
backend/tests/       pytest
frontend/            React site
infra/               SAM template, GitHub deploy role
scripts/             fetch_history, backtest, local_api
data/                sample timetable, history, calendar, backtest result
docs/                architecture, API, demo script
```

## Team

- **Anumeha Jain** ([@Anumehajain78](https://github.com/Anumehajain78)): backend, infrastructure, scripts
- **Rakshit Jain** ([@rakshitjain23](https://github.com/rakshitjain23)): frontend, docs
