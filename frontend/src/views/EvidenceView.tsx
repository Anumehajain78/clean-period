import { useEffect, useState } from 'react'
import { normalizeBacktest } from '../api/adapt'
import { loadStatic } from '../api/client'
import type { BacktestVM } from '../api/types'
import { Button, Notice, Spinner } from '../components/ui'
import { useLang } from '../i18n/lang'
import { fmtNum } from '../lib/format'

function DailyCutChart({ data }: { data: BacktestVM['days'] }) {
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
            {v}
          </text>
        </g>
      ))}
      {data.map((d, i) => (
        <rect
          key={d.date}
          x={L + i * bw + 0.5}
          y={y(Math.max(d.cutPct, 0))}
          width={Math.max(bw - 1, 1)}
          height={Math.max(H - B - y(Math.max(d.cutPct, 0)), 0)}
          fill="var(--color-accent)"
        >
          <title>{`${d.date}: −${fmtNum(d.cutPct, 1)}%`}</title>
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

function Stat({ label, value, help, big }: { label: string; value: string; help?: string; big?: boolean }) {
  return (
    <div className="border-l-2 border-line pl-3">
      <p className="text-[13px] font-medium text-muted">{label}</p>
      <p className={'num font-semibold leading-tight ' + (big ? 'text-4xl text-accent' : 'text-2xl')}>{value}</p>
      {help && <p className="text-xs text-muted">{help}</p>}
    </div>
  )
}

export function EvidenceView() {
  const { t, lang } = useLang()
  const [data, setData] = useState<BacktestVM | null>(null)
  const [state, setState] = useState<'loading' | 'missing' | 'unexpected' | 'ok'>('loading')

  const load = () => {
    setState('loading')
    loadStatic<unknown>('backtest_result.json')
      .then((raw) => {
        const vm = normalizeBacktest(raw)
        if (!vm) return setState('unexpected')
        setData(vm)
        setState('ok')
      })
      .catch(() => setState('missing'))
  }
  useEffect(load, [])

  const fmtDay = (iso: string) =>
    new Date(iso + 'T00:00:00').toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1100px] space-y-5 px-4 py-5 lg:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-2xl">
            <h1 className="text-2xl font-semibold tracking-tight">{t('evidenceTitle')}</h1>
            <p className="mt-1 text-muted">{t('evidenceLead')}</p>
          </div>
          <span className="rounded-[4px] border border-warn/30 bg-warn-wash px-2.5 py-1 text-sm font-medium text-warn">
            {t('sampleBanner')}
          </span>
        </div>

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

        {state === 'ok' && data && (
          <>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <div className="sm:col-span-2 lg:col-span-1">
                <Stat big label={t('seasonCut')} value={`−${fmtNum(data.seasonCutPct, 1)}%`} help={t('seasonCutHelp')} />
              </div>
              {data.meanDailyCutPct != null && (
                <Stat label={t('meanDailyCut')} value={`−${fmtNum(data.meanDailyCutPct, 1)}%`} help={t('meanDailyHelp')} />
              )}
              {data.schoolDays != null && <Stat label={t('schoolDays')} value={fmtNum(data.schoolDays)} />}
              {data.from && data.to && <Stat label={t('period')} value={`${fmtDay(data.from)} – ${fmtDay(data.to)}`} />}
            </div>

            <section className="rounded-[4px] border border-line bg-surface p-4">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold">{t('dailyCutTitle')}</h2>
                <span className="text-xs text-muted">
                  {t('dailyCutAxis')} ({t('estimate')})
                </span>
              </div>
              {data.days.length > 0 && <DailyCutChart data={data.days} />}
            </section>
            {data.assumptions.length > 0 && (
              <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted">
                {data.assumptions.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            )}
            {data.label && <p className="text-xs text-muted">{data.label}</p>}
          </>
        )}

        <section>
          <h2 className="mb-1 text-sm font-semibold">{t('evidenceNotes')}</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
            <li>{t('noteSample')}</li>
            <li>{t('noteGrap')}</li>
            <li>{t('noteCalendar')}</li>
            <li>{t('noteApprox')}</li>
            <li>{t('dataSource')}</li>
          </ul>
        </section>
      </div>
    </div>
  )
}
