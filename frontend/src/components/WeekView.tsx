import { useMemo } from 'react'
import { buildRequest } from '../api/adapt'
import { api } from '../api/client'
import type { OutlookDay } from '../api/types'
import { useLang } from '../i18n/lang'
import type { Key } from '../i18n/strings'
import { bandFor } from '../lib/aqi'
import { fmtNum, formatDate } from '../lib/format'
import type { Planner } from '../state/usePlanner'
import { useRemote } from '../state/useRemote'
import { Button, Notice, Spinner } from './ui'

const BAND_KEY: Record<string, Key> = {
  Good: 'bandGood', Satisfactory: 'bandSatisfactory', Moderate: 'bandModerate',
  Poor: 'bandPoor', 'Very Poor': 'bandVerypoor', Severe: 'bandSevere',
}

function DayCard({ d }: { d: OutlookDay }) {
  const { t, lang } = useLang()
  const planned = d.status === 'planned'
  const verdict = !planned
    ? t('weekNoForecast')
    : d.verdict === 'all_indoors'
      ? t('weekIndoors')
      : d.moved === 0
        ? t('weekNone')
        : d.moved === 1
          ? t('weekMoveOne')
          : t('weekMove', { n: d.moved ?? 0 })
  return (
    <li
      className={
        'flex flex-col rounded-xl border bg-surface p-4 ' +
        (d.cleanest ? 'border-accent ring-1 ring-accent' : 'border-line') +
        (planned ? '' : ' opacity-70')
      }
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="display text-[17px] font-semibold">{formatDate(d.date, lang)}</h3>
        {d.cleanest && (
          <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-white">{t('weekCleanestTag')}</span>
        )}
      </div>

      {planned && d.hours && (
        <div className="mt-3">
          <div className="flex h-3 gap-px overflow-hidden rounded-sm">
            {d.hours.map((h) => (
              <span
                key={h.hour}
                title={`${String(h.hour).padStart(2, '0')}:00 · ${Math.round(h.pm25)} µg/m³`}
                className="flex-1"
                style={{ background: bandFor(h.pm25).color }}
              />
            ))}
          </div>
          <div className="num mt-1 flex justify-between text-[11px] text-muted">
            <span>{String(d.hours[0].hour).padStart(2, '0')}:00</span>
            <span>
              {t('schoolAir')}: {d.category ? t(BAND_KEY[d.category] ?? 'bandModerate') : ''} · {fmtNum(d.school_mean_pm25 ?? 0)}
            </span>
          </div>
        </div>
      )}

      <p className={'mt-3 text-[15px] font-medium ' + (d.verdict === 'all_indoors' ? 'text-bad' : planned ? 'text-ink' : 'text-muted')}>
        {verdict}
      </p>
      {planned && (d.reduction_pct ?? 0) >= 0.5 && (
        <p className="num mt-auto pt-2 text-2xl font-semibold text-accent">
          −{fmtNum(d.reduction_pct ?? 0)}%{' '}
          <span className="text-sm font-normal text-muted">
            {t('doseCut')} ({t('estimate')})
          </span>
        </p>
      )}
    </li>
  )
}

export function WeekView({ p }: { p: Planner }) {
  const { t, lang } = useLang()
  const key = useMemo(
    () => (p.blocker ? null : JSON.stringify(buildRequest(p.school, p.classes))),
    [p.blocker, p.school, p.classes],
  )
  const [res, retry] = useRemote(key, () => api.outlook(JSON.parse(key!)))
  const cleanest = res.state === 'ok' ? res.data.days.find((d) => d.cleanest) : undefined

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 pb-10 pt-5">
      <div>
        <h2 className="display text-2xl font-semibold">{t('weekTitle')}</h2>
        <p className="mt-1 text-[15px] text-muted">{t('weekLead')}</p>
      </div>

      {p.blocker && <Notice tone="warn">{t(p.blocker)}</Notice>}
      {res.state === 'loading' && (
        <p className="flex items-center gap-2 text-muted" role="status">
          <Spinner /> {t('weekLoading')}
        </p>
      )}
      {res.state === 'error' && (
        <div className="space-y-2">
          <Notice tone="bad">
            {t('weekFailed')} {res.network ? t('errNetwork') : res.detail ? t('serverSaid', { msg: res.detail }) : ''}
          </Notice>
          <Button small onClick={retry}>
            {t('retry')}
          </Button>
        </div>
      )}

      {res.state === 'ok' && (
        <>
          {cleanest && (
            <div className="rounded-xl border-l-4 border-l-accent bg-accent-wash px-4 py-3">
              <p className="text-[15px]">
                {t('weekCleanest', { day: formatDate(cleanest.date, lang) })}
              </p>
            </div>
          )}
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {res.data.days.map((d) => (
              <DayCard key={d.date} d={d} />
            ))}
          </ul>
          <div className="space-y-1 border-t border-line pt-3 text-xs text-muted">
            <p>{t('weekSame')}</p>
            <p>{lang === 'hi' ? res.data.label_hi : res.data.label}</p>
            <p>
              <span className="font-medium text-ink">{t('airSource')}:</span> {res.data.source}
            </p>
            {res.data.category_note && <p>{res.data.category_note}</p>}
          </div>
        </>
      )}
    </div>
  )
}
