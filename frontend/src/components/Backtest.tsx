import { t, weekdayNames, type Lang } from '../i18n/strings'
import type { BacktestResult } from '../types'
import { hh, pct } from '../ui'

export function Backtest({ data, lang }: { data: BacktestResult; lang: Lang }) {
  const s = data.summary
  const maxCut = Math.max(1, ...Object.values(s.by_weekday).map((w) => w.mean_reduction_pct))
  const maxPm = Math.max(1, ...data.hourly_profile.map((h) => h.median_pm25))

  return (
    <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
      <h2 className="text-lg font-semibold">{t(lang, 'backtestTitle')}</h2>
      <p className="text-xs text-stone-500">
        {t(lang, 'backtestSub')} · {data.school.name} · {data.period.start} – {data.period.end}
      </p>

      <p className="mt-3">
        <span className="text-4xl font-bold text-emerald-700">{pct(s.season_reduction_pct)}</span>{' '}
        <span className="text-sm text-stone-600">{t(lang, 'seasonCut')}*</span>
      </p>
      <p className="text-sm text-stone-600">
        {pct(s.mean_daily_reduction_pct)} {t(lang, 'meanDaily')} · {s.school_days} {t(lang, 'schoolDays')} ·{' '}
        {s.all_indoors_days} {t(lang, 'allIndoorsDays')}
      </p>

      <h3 className="mt-4 text-sm font-medium">{t(lang, 'byWeekday')}</h3>
      <ul className="mt-2 space-y-1">
        {Object.entries(s.by_weekday).map(([day, w]) => (
          <li key={day} className="flex items-center gap-2 text-sm">
            <span className="w-20 shrink-0">{weekdayNames[day]?.[lang] ?? day}</span>
            <span className="h-3 rounded bg-emerald-600" style={{ width: `${(w.mean_reduction_pct / maxCut) * 60}%` }} />
            <span className="tabular-nums text-xs text-stone-600">{pct(w.mean_reduction_pct)}</span>
          </li>
        ))}
      </ul>

      <h3 className="mt-4 text-sm font-medium">{t(lang, 'hourlyProfile')}</h3>
      <div className="mt-2 flex h-32 items-end gap-1">
        {data.hourly_profile.map((h) => (
          <div key={h.hour} className="flex flex-1 flex-col items-center justify-end gap-1">
            <span className="tabular-nums text-[10px] text-stone-600">{h.median_pm25.toFixed(0)}</span>
            <div className="w-full rounded-t bg-orange-500" style={{ height: `${(h.median_pm25 / maxPm) * 80}%` }} />
            <span className="text-[10px] text-stone-500">{hh(h.hour)}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-stone-500">{data.sources.air_quality}</p>
    </section>
  )
}
