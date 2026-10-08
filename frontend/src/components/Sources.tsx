import { t, type Lang } from '../i18n/strings'
import type { BacktestResult, PlanResponse } from '../types'

export function Sources({ lang, plan, backtest }: { lang: Lang; plan: PlanResponse | null; backtest: BacktestResult }) {
  const assumptions = plan?.assumptions ?? backtest.assumptions
  return (
    <footer className="rounded-xl bg-stone-100 p-4 text-xs text-stone-700">
      <h2 className="mb-2 text-sm font-semibold">* {t(lang, 'sources')}</h2>
      <p className="font-medium">{t(lang, 'estimates')} {t(lang, 'limitsNote')}</p>
      <ul className="mt-2 list-disc space-y-1 pl-4">
        <li>{plan?.air.source ?? backtest.sources.air_quality}</li>
        <li>{backtest.sources.inhalation_rates}</li>
        <li>{backtest.sources.pm25_categories}</li>
        {assumptions.map((a) => <li key={a}>{a}</li>)}
      </ul>
    </footer>
  )
}
