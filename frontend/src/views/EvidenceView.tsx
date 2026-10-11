import { useEffect, useState } from 'react'
import { loadStatic } from '../api/client'
import { Button, Notice, Spinner } from '../components/ui'
import { useLang } from '../i18n/lang'
import { bandFor } from '../lib/aqi'
import { fmtNum, formatDay, weekdayLabel } from '../lib/format'

// ---- data/backtest_result.json (written by scripts/backtest.py) ----------------

interface EvidenceFile {
  period: { start: string; end: string }
  sources: { air_quality: string; inhalation_rates: string; pm25_categories: string }
  assumptions: string[]
  assumptions_hi?: string[]
  label: string
  label_hi?: string
  summary: {
    school_days: number
    all_indoors_days: number
    season_reduction_pct: number
    mean_daily_reduction_pct: number
    by_weekday: Record<string, { days: number; mean_reduction_pct: number }>
  }
  days: { date: string; verdict: string; reduction_pct: number }[]
  hourly_profile: { hour: number; median_pm25: number; days: number }[]
}

function isEvidence(x: unknown): x is EvidenceFile {
  const d = x as EvidenceFile
  return !!d && typeof d.summary?.season_reduction_pct === 'number' && Array.isArray(d.days) && Array.isArray(d.hourly_profile)
}

// ---- charts (also used by the "Last winter" tab) -------------------------------

/** One bar per school day; all-indoors days in red. */
export function DailyCutChart({ data }: { data: { date: string; cutPct: number; allIndoors?: boolean }[] }) {
  const { t, lang } = useLang()
  const W = 640
  const H = 190
  const L = 34
  const R = 6
  const T = 8
  const B = 22
  const max = Math.max(10, Math.ceil(Math.max(...data.map((d) => d.cutPct)) / 10) * 10)
  const bw = (W - L - R) / data.length
  const y = (v: number) => T + (H - T - B) * (1 - v / max)
  const ticks = [0, max / 2, max]
  const monthLabels: { x: number; label: string }[] = []
  let last = ''
  data.forEach((d, i) => {
    const m = d.date.slice(0, 7)
    if (m !== last) {
      last = m
      monthLabels.push({
        x: L + i * bw,
        label: new Date(d.date + 'T00:00:00').toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { month: 'short' }),
      })
    }
  })
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('dailyCutTitle')} className="block w-full">
      {ticks.map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--color-line)" />
          <text x={L - 5} y={y(v) + 3} textAnchor="end" fontSize="10" fill="var(--color-muted)" className="num">
            {v}%
          </text>
        </g>
      ))}
      {data.map((d, i) => (
        <rect
          key={d.date}
          x={L + i * bw + 0.5}
          y={y(Math.max(d.cutPct, 0))}
          width={Math.max(bw - 1.5, 1)}
          height={Math.max(H - B - y(Math.max(d.cutPct, 0)), 0)}
          rx={1}
          fill={d.allIndoors ? 'var(--color-aqi-verypoor)' : 'var(--color-accent)'}
        >
          <title>{`${d.date}: −${fmtNum(d.cutPct, 1)}%${d.allIndoors ? ' · all indoors' : ''}`}</title>
        </rect>
      ))}
      {monthLabels.map((m) => (
        <text key={m.x} x={m.x} y={H - 6} fontSize="10" fill="var(--color-muted)">
          {m.label}
        </text>
      ))}
    </svg>
  )
}

/** Typical PM2.5 for each school hour, in CPCB colours. */
function HourProfile({ rows }: { rows: { hour: number; median_pm25: number }[] }) {
  const { t } = useLang()
  const max = Math.max(...rows.map((r) => r.median_pm25)) * 1.15
  return (
    <div className="flex h-48 items-end gap-2" role="img" aria-label={t('evHourTitle')}>
      {rows.map((r) => (
        <div key={r.hour} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
          <span className="num text-sm font-semibold">{Math.round(r.median_pm25)}</span>
          <div
            className="w-full rounded-t-md"
            style={{ height: `${(r.median_pm25 / max) * 100}%`, background: bandFor(r.median_pm25).color }}
          />
          <span className="num text-xs text-muted">{String(r.hour).padStart(2, '0')}:00</span>
        </div>
      ))}
    </div>
  )
}

export function Stat({ label, value, help, big }: { label: string; value: string; help?: string; big?: boolean }) {
  return (
    <div className="border-l-2 border-line pl-3">
      <p className="text-[13px] font-medium text-muted">{label}</p>
      <p className={'num font-semibold leading-tight ' + (big ? 'text-4xl text-accent' : 'text-2xl')}>{value}</p>
      {help && <p className="text-xs text-muted">{help}</p>}
    </div>
  )
}

// ---- page ---------------------------------------------------------------------

export function EvidenceView({ onTryOwn }: { onTryOwn?: () => void }) {
  const { t, lang } = useLang()
  const [data, setData] = useState<EvidenceFile | null>(null)
  const [state, setState] = useState<'loading' | 'missing' | 'unexpected' | 'ok'>('loading')

  const load = () => {
    setState('loading')
    loadStatic<unknown>('backtest_result.json')
      .then((raw) => {
        if (!isEvidence(raw)) return setState('unexpected')
        setData(raw)
        setState('ok')
      })
      .catch(() => setState('missing'))
  }
  useEffect(load, [])

  const s = data?.summary
  const morning = data?.hourly_profile.find((h) => h.hour === 8)
  const afternoon = data?.hourly_profile.find((h) => h.hour === 13)
  const weekdays = s ? Object.entries(s.by_weekday) : []
  const maxDay = Math.max(1, ...weekdays.map(([, w]) => w.mean_reduction_pct))

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1100px] space-y-8 px-4 py-6 lg:px-6">
        {state === 'loading' && (
          <p className="flex items-center gap-2 text-muted">
            <Spinner /> {t('evidenceLoading')}
          </p>
        )}
        {(state === 'missing' || state === 'unexpected') && (
          <div className="space-y-2">
            <Notice tone="bad">{state === 'missing' ? t('evidenceMissing') : t('evidenceUnexpected')}</Notice>
            <Button small onClick={load}>
              {t('retry')}
            </Button>
          </div>
        )}

        {state === 'ok' && data && s && (
          <>
            <header className="max-w-3xl">
              <p className="text-sm font-medium uppercase tracking-wide text-accent">{t('evEyebrow')}</p>
              <h1 className="display mt-1 text-3xl font-semibold leading-tight sm:text-4xl">
                {t('evHeadline', { pct: fmtNum(s.season_reduction_pct, 0) })}
              </h1>
              <p className="mt-3 text-[17px] text-muted">{t('evidenceLead')}</p>
              <p className="mt-3 text-sm text-ink">
                {t('evContext', { from: formatDay(data.period.start, lang), to: formatDay(data.period.end, lang) })}
              </p>
            </header>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <Stat big label={t('seasonCut')} value={`−${fmtNum(s.season_reduction_pct, 1)}%`} help={t('seasonCutHelp')} />
              <Stat label={t('meanDailyCut')} value={`−${fmtNum(s.mean_daily_reduction_pct, 1)}%`} help={t('meanDailyHelp')} />
              <Stat label={t('schoolDays')} value={fmtNum(s.school_days)} help={t('evDaysHelp')} />
              <Stat label={t('winterIndoors')} value={fmtNum(s.all_indoors_days)} help={t('winterIndoorsHelp')} />
            </div>

            <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
              <div className="rounded-xl border border-line bg-surface p-5">
                <h2 className="display text-lg font-semibold">{t('evHourTitle')}</h2>
                <p className="mb-4 mt-1 text-sm text-muted">
                  {morning && afternoon
                    ? t('evHourBody', {
                        am: fmtNum(morning.median_pm25, 0),
                        pm: fmtNum(afternoon.median_pm25, 0),
                        x: fmtNum(morning.median_pm25 / afternoon.median_pm25, 1),
                      })
                    : ''}
                </p>
                <HourProfile rows={data.hourly_profile} />
                <p className="mt-3 text-xs text-muted">{t('evHourNote')}</p>
              </div>

              <div className="rounded-xl border border-line bg-surface p-5">
                <h2 className="display text-lg font-semibold">{t('evWeekdayTitle')}</h2>
                <p className="mb-4 mt-1 text-sm text-muted">{t('evWeekdayBody')}</p>
                <ul className="space-y-3">
                  {weekdays.map(([day, w]) => (
                    <li key={day} className="grid grid-cols-[88px_minmax(0,1fr)_56px] items-center gap-3">
                      <span className="text-sm font-medium">{weekdayLabel(day, lang)}</span>
                      <span className="h-3 rounded-full bg-wash">
                        <span
                          className="block h-3 rounded-full bg-accent"
                          style={{ width: `${Math.max((w.mean_reduction_pct / maxDay) * 100, 1.5)}%` }}
                        />
                      </span>
                      <span className="num text-right text-sm font-semibold">{w.mean_reduction_pct >= 0.5 ? `−${fmtNum(w.mean_reduction_pct, 0)}%` : '0%'}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <section className="rounded-xl border border-line bg-surface p-5">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="display text-lg font-semibold">{t('dailyCutTitle')}</h2>
                <span className="flex items-center gap-3 text-xs text-muted">
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm bg-accent" /> {t('evLegendMoved')}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm bg-aqi-verypoor" /> {t('evLegendIndoors')}
                  </span>
                </span>
              </div>
              <DailyCutChart
                data={data.days.map((d) => ({ date: d.date, cutPct: d.reduction_pct, allIndoors: d.verdict === 'all_indoors' }))}
              />
            </section>

            {onTryOwn && (
              <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-accent px-5 py-4 text-white">
                <div>
                  <h2 className="display text-lg font-semibold">{t('evTryTitle')}</h2>
                  <p className="text-sm text-white/85">{t('evTryBody')}</p>
                </div>
                <button
                  type="button"
                  onClick={onTryOwn}
                  className="h-10 rounded-md bg-white px-4 font-medium text-accent hover:bg-accent-wash"
                >
                  {t('evTryButton')}
                </button>
              </section>
            )}

            <details className="group rounded-xl border border-line bg-surface">
              <summary className="flex h-12 cursor-pointer list-none items-center justify-between px-5 font-medium">
                {t('evHowTitle')}
                <span className="text-muted transition-transform group-open:rotate-180">⌄</span>
              </summary>
              <div className="space-y-3 border-t border-line px-5 py-4 text-sm text-muted">
                <ul className="list-disc space-y-1 pl-5">
                  <li>{t('evHowTimetable')}</li>
                  <li>{t('noteCalendar')}</li>
                  <li>{t('noteGrap')}</li>
                  {(lang === 'hi' ? data.assumptions_hi ?? data.assumptions : data.assumptions).map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
                <p>
                  <span className="font-medium text-ink">{t('airSource')}:</span> {data.sources.air_quality}
                </p>
                <p>{lang === 'hi' ? data.label_hi ?? data.label : data.label}</p>
              </div>
            </details>
          </>
        )}
      </div>
    </div>
  )
}
