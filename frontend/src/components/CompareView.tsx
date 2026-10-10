import { useMemo, useState } from 'react'
import type { PlanVM, RowVM } from '../api/types'
import { useLang } from '../i18n/lang'
import { ALL_INDOORS_THRESHOLD, bandFor } from '../lib/aqi'
import { fmtNum, formatDate, hourOf } from '../lib/format'
import { ACTIVITY_KEY } from './TimetableEditor'
import { AqiChart } from './AqiChart'
import { Segmented } from './ui'

function PeriodList({ rows, title, accent }: { rows: RowVM[]; title: string; accent?: boolean }) {
  const { t } = useLang()
  return (
    <section className="min-w-0">
      <h3 className={'mb-1.5 text-sm font-semibold ' + (accent ? 'text-accent' : 'text-muted')}>{title}</h3>
      <ul className="rounded-[4px] border border-line bg-surface">
        {rows.map((r, i) => {
          const flagged = !!r.movedFrom || r.madeIndoor
          return (
            <li
              key={i}
              className={
                'flex items-center gap-3 border-b border-line px-3 py-2 last:border-b-0 ' +
                (flagged && accent ? 'border-l-[3px] border-l-accent bg-accent-wash/60 pl-[9px]' : '')
              }
            >
              <span className="num w-[84px] shrink-0 text-[13px] text-muted">
                {r.start}–{r.end}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium">{r.subject}</span>
                <span className="block truncate text-xs text-muted">
                  {t(ACTIVITY_KEY[r.activity])} · {r.indoors ? t('indoors') : t('outdoors')}
                  {accent && r.movedFrom && ` · ${t('movedFrom', { time: r.movedFrom })}`}
                  {accent && r.madeIndoor && ` · ${t('madeIndoor')}`}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end">
                <span className="num flex items-center gap-1.5 text-[13px]">
                  {r.pm25 != null && (
                    <span
                      aria-hidden
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ background: bandFor(r.pm25).color }}
                    />
                  )}
                  {r.pm25 != null ? fmtNum(r.pm25) : '–'}
                </span>
                <span className="num text-xs text-muted">
                  {fmtNum(r.dose, 1)} {t('doseUnit')}
                </span>
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export function CompareView({ plan }: { plan: PlanVM }) {
  const { t, lang } = useLang()
  const [idx, setIdx] = useState(0)
  const [side, setSide] = useState<'after' | 'before'>('after')
  const cls = plan.classes[Math.min(idx, plan.classes.length - 1)]

  const { from, to } = useMemo(() => {
    const all = plan.classes.flatMap((c) => c.after)
    const f = Math.min(...all.map((p) => hourOf(p.start)))
    const l = Math.max(...all.map((p) => hourOf(p.end)))
    return { from: f, to: l }
  }, [plan])

  const verdictTitle =
    plan.verdict === 'all_indoors'
      ? t('verdictAllIndoors')
      : plan.movedCount === 0
        ? t('verdictUnchanged')
        : plan.movedCount === 1
          ? t('verdictRearrangedOne')
          : t('verdictRearranged', { n: plan.movedCount })

  return (
    <div className="space-y-4 p-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)] lg:items-start">
        <div
          className={
            'rounded-[4px] border-l-4 bg-surface py-3 pl-4 pr-3 ' +
            (plan.verdict === 'all_indoors' ? 'border-l-bad' : 'border-l-accent')
          }
          style={{ boxShadow: 'inset 0 0 0 1px var(--color-line)' }}
        >
          <p className="text-[13px] text-muted">{formatDate(plan.date, lang)}</p>
          <h2 className="text-xl font-semibold leading-snug">{verdictTitle}</h2>
          {plan.verdict === 'all_indoors' && <p className="mt-1 text-[15px] text-muted">{t('verdictAllIndoorsBody')}</p>}
          <p className="mt-2 flex items-baseline gap-2">
            <span className="num text-3xl font-semibold text-accent">−{fmtNum(plan.totalCutPct, 0)}%</span>
            <span className="text-sm text-muted">
              {t('doseCut')} ({t('estimate')}) · {t('allClasses')}
            </span>
          </p>
        </div>

        <div>
          <p className="mb-1 text-[13px] font-medium text-muted">{t('hourlyPm')} (µg/m³)</p>
          <AqiChart hourly={plan.hours} fromHour={from} toHour={to} threshold={ALL_INDOORS_THRESHOLD} />
        </div>
      </div>

      {plan.classes.length > 1 && (
        <div role="tablist" aria-label={t('perClass')} className="flex flex-wrap gap-2">
          {plan.classes.map((c, i) => (
            <button
              key={c.name + i}
              role="tab"
              type="button"
              aria-selected={i === idx}
              onClick={() => setIdx(i)}
              className={
                'h-9 rounded-[4px] border px-3 text-sm ' +
                (i === idx ? 'border-accent bg-accent-wash font-medium text-accent' : 'border-line bg-surface hover:bg-wash')
              }
            >
              {c.name} <span className="num ml-1 text-muted">−{fmtNum(c.cutPct)}%</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[15px]">
          <span className="font-semibold">{cls.name}</span>
          <span className="num ml-2 text-muted">
            {fmtNum(cls.doseBefore, 1)} → {fmtNum(cls.doseAfter, 1)} {t('doseUnit')} ({t('estimate')}) ·{' '}
            <span className="font-semibold text-accent">−{fmtNum(cls.cutPct)}%</span>
          </span>
        </p>
        <Segmented
          label={t('before') + ' / ' + t('after')}
          value={side}
          onChange={setSide}
          className="md:hidden"
          items={[
            { id: 'after', label: t('showAfter') },
            { id: 'before', label: t('showBefore') },
          ]}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className={side === 'before' ? 'hidden md:block' : ''}>
          <PeriodList rows={cls.after} title={t('after')} accent />
        </div>
        <div className={side === 'after' ? 'hidden md:block' : ''}>
          <PeriodList rows={cls.before} title={t('before')} />
        </div>
      </div>

      <section className="space-y-2 border-t border-line pt-3 text-xs text-muted">
        {plan.assumptions.length > 0 && (
          <div>
            <p className="mb-1 font-medium text-ink">{t('planAssumptions')}</p>
            <ul className="list-disc space-y-0.5 pl-5">
              {plan.assumptions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>
        )}
        {plan.label && <p>{plan.label}</p>}
        <p>
          <span className="font-medium text-ink">{t('airSource')}:</span> {plan.airSource || t('dataSource')}
        </p>
        {plan.categoryNote && <p>{plan.categoryNote}</p>}
      </section>
    </div>
  )
}
