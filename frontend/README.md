# Clean Period frontend

React + Vite + TypeScript + Tailwind (v4). No other runtime dependencies.

    npm install
    npm run dev       # http://localhost:5173
    npm run build

`.env` holds `VITE_API_URL` (the stack's ApiUrl). In `npm run dev` the app calls
`/api` on the dev server and Vite forwards it to that URL, so the browser's CORS
rule does not block localhost. Restart `npm run dev` after changing `.env`.

## Where things are
- `src/i18n/strings.ts` all UI text, `en` and `hi` (a missing Hindi key fails `tsc`)
- `src/api/` the only place that knows the API: `types.ts` (docs/api.md shapes),
  `client.ts` (calls), `adapt.ts` (request builder, response mapping, sample and backtest readers)
- `src/state/usePlanner.ts` draft timetable, validation, plan and notice calls
- `src/views/` Plan, Evidence, Method; `src/components/` shared pieces
- `scripts/sync-data.mjs` copies `../data/sample_timetable.json` and
  `../data/backtest_result.json` into `public/` before `dev` and `build`

## Notes
- The plan request has no indoor factor: it lives in the backend config and each
  plan response lists the assumptions it used, which the UI shows.
- `api.md` does not describe the fields inside `data/backtest_result.json`.
  `normalizeBacktest` in `src/api/adapt.ts` looks numbers up by key name and the
  Evidence tab says so if it cannot find the headline figure.
- The 120 µg/m³ "all indoors" line is a constant in `src/lib/aqi.ts` (from CLAUDE.md).
