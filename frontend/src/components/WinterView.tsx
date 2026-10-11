import { useMemo } from 'react'
import { buildRequest } from '../api/adapt'
import { api } from '../api/client'
import { useLang } from '../i18n/lang'
import { fmtNum, formatDay } from '../lib/format'
import type { Planner } from '../state/usePlanner'
import { useRemote } from '../state/useRemote'
import { DailyCutChart, Stat } from '../views/EvidenceView'
import { Button, Notice, Spinner } from './ui'

export function WinterView({ p }: { p: Planner }) {
  const { t, lang } = useLang()
  const key = useMemo(
    () => (p.blocker ? null : JSON.stringify(buildRequest(p.school, p.classes))),
    [p.blocker, p.school, p.classes],
  )
  const [res, retry] = useRemote(key, () => api.backtest(JSON.parse(key!)))
  const place = p.school.place || p.school.name || `${p.school.lat}, ${p.school.lng}`

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 pb-10 pt-5">
      <div>
        <h2 className="display text-2xl font-semibold">{t('winterTitle')}</h2>
        <p className="mt-1 max-w-2xl text-[15px] text-muted">{t('winterLead')}</p>
      </div>

      {p.blocker && <Notice tone="warn">{t(p.blocker)}</Notice>}
      {res.state === 'loading' && (
        <p className="flex items-center gap-2 text-muted" role="status">
          <Spinner /> {t('winterLoading')}
        </p>
      )}
      {res.state === 'error' && (
        <div className="space-y-2">
          <Notice tone="bad">
            {t('winterFailed')} {res.network ? t('errNetwork') : res.detail ? t('serverSaid', { msg: res.detail }) : ''}
          </Notice>
          <Button small onClick={retry}>
            {t('retry')}
          </Button>
        </div>
      )}

      {res.state === 'ok' && (() => {
        const d = res.data
        const s = d.summary
        return (
          <>
            <p className="text-[15px]">
              {t('winterFor', {
                place,
                from: formatDay(d.period.start, lang),
                to: formatDay(d.period.end, lang),
              })}
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat big label={t('seasonCut')} value={`−${fmtNum(s.season_reduction_pct, 1)}%`} help={t('seasonCutHelp')} />
              <Stat label={t('meanDailyCut')} value={`−${fmtNum(s.mean_daily_reduction_pct, 1)}%`} help={t('meanDailyHelp')} />
              <Stat label={t('schoolDays')} value={fmtNum(s.school_days)} />
              <Stat label={t('winterIndoors')} value={fmtNum(s.all_indoors_days)} help={t('winterIndoorsHelp')} />
            </div>
            {d.days.length > 0 && (
              <section className="rounded-xl border border-line bg-surface p-4">
                <h3 className="mb-2 text-[15px] font-semibold">{t('dailyCutTitle')}</h3>
                <DailyCutChart data={d.days.map((x) => ({ date: x.date, cutPct: x.reduction_pct }))} />
              </section>
            )}
            <section className="space-y-1 border-t border-line pt-3 text-xs text-muted">
              <ul className="list-disc space-y-0.5 pl-5">
                {(lang === 'hi' ? d.assumptions_hi : d.assumptions).map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
              <p>{lang === 'hi' ? d.label_hi : d.label}</p>
              <p>
                <span className="font-medium text-ink">{t('airSource')}:</span> {d.source} ·{' '}
                {fmtNum(d.grid_point.latitude, 2)}, {fmtNum(d.grid_point.longitude, 2)}
              </p>
            </section>
          </>
        )
      })()}
    </div>
  )
}
