# Demo video script (3 minutes, two speakers)

**Speaker A (Anumeha):** the problem and the product demo.
**Speaker B (Rakshit):** tech stack, architecture, AWS, learning.

About 410 spoken words (about 2:45 at a normal pace), leaving room for pauses. Times are targets.
Record the screen at 1280 × 800 or larger; zoom the browser to 110 %.

## Before you record

- Open https://main.d32sdayd4hpv2r.amplifyapp.com in a clean browser window.
- On the Plan tab: school name, town (search **Lucknow** or your own town), and
  one class already filled (use **Read a photo** once before recording, so the
  ~20 s read is not in the video; or cut that wait in editing).
- Open each tab once (Before & after, Parent notice, This week, Last winter) so
  the results load instantly while recording.
- **This week** changes every day: say the day the screen shows, not a day from
  this script.
- Have [docs/architecture.md](architecture.md) open on GitHub (it renders the
  diagram) and the AWS console on the Lambda list, for Speaker B.

---

## 0:00 – 0:20 · The problem (A)

**Screen:** Evidence tab, the daily chart.

> **A:** On a smoggy morning, schools in India get two choices: stay open, or
> close. But what harms a child is the dose: how dirty the air is, how hard the
> child is breathing, and for how long. A child running in PE breathes almost
> nine times as much air per minute as a child sitting in class. And in a Delhi
> winter, 8 a.m. is often twice as polluted as 1 p.m.

## 0:20 – 0:50 · Your timetable, in a minute (A)

**Screen:** Plan tab. Show the town, then the class with its day strip. Point
at the three ways in: Fill the school day, Read a photo, Add periods.

> **A:** Clean Period works with the school's real timetable. A teacher finds
> the town, then fills the school day, or simply takes a photo of the printed
> timetable. AI reads it, and the teacher checks every row. Outdoor periods
> show in orange on the day strip.

## 0:50 – 1:20 · Tomorrow's plan (A)

**Screen:** click **Make plan for tomorrow** → Before & after. Point at the air
row, then the PE block moving from the red hour to the green hour.

> **A:** One click plans tomorrow. On top is the hourly air forecast. Below,
> the day before and after: PE moves out of the polluted morning into clean air.
> Nothing is cancelled, only the order changes, and the estimated dose cut is
> right here. If every hour is very poor, every outdoor period goes indoors.

## 1:20 – 1:45 · Parents, this week, last winter (A)

**Screen:** Parent notice (Hindi side) → This week (point at the cleanest-day
card) → Last winter (point at the season cut).

> **A:** Parents get a ready notice in Hindi and English. "This week" plans
> each coming school day and marks the cleanest day for outdoor events. And
> "Last winter" replays real air data for this school: it would have cut the
> children's dose by about [say the % on screen] over the season.

## 1:45 – 2:30 · Stack and architecture (B)

**Screen:** docs/architecture.md diagram on GitHub, then the AWS Lambda list.

> **B:** The site is React with TypeScript and Tailwind, hosted on AWS Amplify.
> It calls an API Gateway HTTP API in Mumbai, backed by seven Python Lambdas.
> The core, the dose engine and optimiser, is plain Python with 257 tests.
> The optimiser respects real school rules: a teacher in one class at a time,
> the ground's capacity, and fixed periods like assembly.
> Air data comes from Open-Meteo's CAMS forecast, cached in DynamoDB.
> Amazon Bedrock, with Amazon Nova Pro, reads timetable photos and words the
> notice. Our rule: code decides the plan, AI only writes text, and code
> rejects any AI sentence with a number that isn't in the plan.

## 2:30 – 2:50 · How we used AWS (B)

**Screen:** EventBridge Scheduler schedule (19:00 Asia/Kolkata), then the
GitHub Actions run list.

> **B:** EventBridge Scheduler runs a nightly job at 7 p.m. that plans tomorrow
> for every saved school. Everything is infrastructure as code with SAM, and
> every push to main is tested and deployed by GitHub Actions, signing in to
> AWS with OIDC, so no keys are stored anywhere.

## 2:50 – 3:00 · Learning (B), close (A)

**Screen:** Method tab, "Limits we state openly".

> **B:** Our biggest lesson: we planned on Claude, but our account couldn't use
> it, so we switched to Nova and made code check every AI answer.
>
> **A:** Clean Period. Same periods, cleaner air.

---

## Points the judges asked for, and where they are

| Required point | Where in the video |
|---|---|
| About the project | 0:00 – 1:45 (A) |
| Tech stack and architecture | 1:45 – 2:30 (B) |
| How we used AWS | 1:45 – 2:50 (B): Amplify, API Gateway, Lambda, DynamoDB, Bedrock, EventBridge Scheduler, SAM, IAM OIDC |
| Learning and growth | 2:50 – 3:00 (B) |

## Facts used in the script (all from the repo)

- "Almost nine times": PE 0.042 m³/min vs sitting 0.0048 m³/min = 8.75 ×
  (US EPA Exposure Factors Handbook 2011, Table 6-2, ages 6 to under 11).
- "8 a.m. often twice as polluted as 1 p.m.": median PM2.5 in Vasant Vihar,
  Nov 2025 to Jan 2026 school days: 136 at 08:00 vs 66 at 13:00
  (`data/backtest_result.json`, hourly profile).
- "Very poor": above 120 µg/m³ every school hour (CPCB bands; hourly use is an
  approximation, stated in the Method tab).
- Season cut: read it from the Last winter screen while recording. For the
  Delhi evidence (sample timetable) it is 22%; for Lucknow with the same
  timetable it was 28.9%.
- Seven Lambdas, 257 tests, 19:00 Asia/Kolkata schedule: `infra/template.yaml`,
  `backend/tests/`.
