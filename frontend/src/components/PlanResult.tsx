import { categoryNames, t, type Lang } from '../i18n/strings'
import type { PlanResponse, PlannedPeriod } from '../types'
import { OUTDOOR, categoryClass, hh, pct, ug } from '../ui'

function PeriodRow({ p, lang, changed }: { p: PlannedPeriod; lang: Lang; changed: boolean }) {
  const outdoor = OUTDOOR.has(p.activity)
  return (
    <li className={`flex items-center justify-between gap-2 rounded-md px-2 py-1 text-sm
      ${changed ? 'bg-emerald-50 ring-1 ring-emerald-300' : ''}`}>
      <span className="w-12 shrink-0 tabular-nums text-stone-500">{p.start}</span>
      <span className="flex-1 truncate">
        {p.subject}
        {outdoor && <span className="ml-1 text-xs text-orange-700">• {t(lang, 'outdoor')}</span>}
        {p.converted_from && <span className="ml-1 text-xs text-emerald-700">• {t(lang, 'madeIndoor')}</span>}
      </span>
      <span className="tabular-nums text-xs text-stone-600">{ug(p.dose_ug)}</span>
    </li>
  )
}

export function PlanResult({ plan, lang }: { plan: PlanResponse; lang: Lang }) {
  return (
    <section className="space-y-4">
      <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
        <p className="text-sm text-stone-500">{t(lang, 'planFor')} {plan.date}</p>
        <p className={`mt-1 font-medium ${plan.verdict === 'all_indoors' ? 'text-red-700' : 'text-emerald-800'}`}>
          {plan.verdict === 'all_indoors' ? t(lang, 'verdictIndoors') : t(lang, 'verdictReorder')}
        </p>
        <p className="mt-3">
          <span className="text-4xl font-bold text-emerald-700">{pct(plan.reduction_pct)}</span>{' '}
          <span className="text-sm text-stone-600">{t(lang, 'doseCut')}*</span>
        </p>

        <h3 className="mt-4 text-sm font-medium">{t(lang, 'airTomorrow')}</h3>
        <ul className="mt-2 grid grid-cols-4 gap-1 sm:grid-cols-7">
          {plan.air.hours.map((h) => (
            <li key={h.hour} className={`rounded-md p-1 text-center text-xs ${categoryClass[h.category ?? ''] ?? 'bg-stone-200'}`}>
              <div className="font-semibold">{hh(h.hour)}</div>
              <div className="tabular-nums">{h.pm25 === null ? '–' : h.pm25.toFixed(0)}</div>
              <div className="truncate">{h.category ? categoryNames[h.category]?.[lang] ?? h.category : ''}</div>
            </li>
          ))}
        </ul>
      </div>

      {plan.classes.map((c) => {
        const moved = new Set(c.moves.map((m) => m.to_slot))
        return (
          <div key={c.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
            <div className="flex items-baseline justify-between">
              <h3 className="font-semibold">{c.name}</h3>
              <span className="text-sm font-semibold text-emerald-700">−{pct(c.reduction_pct)}</span>
            </div>
            <p className="text-xs text-stone-500">
              {t(lang, 'dose')}: {ug(c.before_ug)} → {ug(c.after_ug)}*
            </p>
            {c.moves.length === 0 && plan.verdict === 'reorder' && (
              <p className="mt-2 text-sm text-stone-600">{t(lang, 'noMoves')}</p>
            )}
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <h4 className="mb-1 text-xs font-semibold uppercase text-stone-500">{t(lang, 'before')}</h4>
                <ul className="space-y-0.5">
                  {c.before.map((p) => <PeriodRow key={p.slot} p={p} lang={lang} changed={false} />)}
                </ul>
              </div>
              <div>
                <h4 className="mb-1 text-xs font-semibold uppercase text-stone-500">{t(lang, 'after')}</h4>
                <ul className="space-y-0.5">
                  {c.after.map((p) => (
                    <PeriodRow key={p.slot} p={p} lang={lang} changed={moved.has(p.slot) || !!p.converted_from} />
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )
      })}
    </section>
  )
}
