import { useState } from 'react'
import backtestJson from '../../data/backtest_result.json'
import sampleTimetable from '../../data/sample_timetable.json'
import { makePlan } from './api'
import { Backtest } from './components/Backtest'
import { PlanResult } from './components/PlanResult'
import { Sources } from './components/Sources'
import { TimetableForm } from './components/TimetableForm'
import { t, type Lang } from './i18n/strings'
import type { BacktestResult, PlanResponse, Timetable } from './types'
import { tomorrowWeekday } from './ui'

const backtest = backtestJson as unknown as BacktestResult
const sample = sampleTimetable as unknown as Timetable

export default function App() {
  const [lang, setLang] = useState<Lang>('en')
  const [timetable, setTimetable] = useState<Timetable>(() => structuredClone(sample))
  const [weekday, setWeekday] = useState(() => {
    const days = Object.keys(sample.classes[0].days)
    const tomorrow = tomorrowWeekday()
    return days.includes(tomorrow) ? tomorrow : days[0]
  })
  const [plan, setPlan] = useState<PlanResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onPlan() {
    setLoading(true)
    setError(null)
    try {
      setPlan(await makePlan({
        school: timetable.school,
        slots: timetable.slots,
        classes: timetable.classes.map((c) => ({ id: c.id, name: c.name, periods: c.days[weekday] ?? [] })),
      }))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div lang={lang} className="mx-auto max-w-3xl space-y-4 px-4 py-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-emerald-800">{t(lang, 'appTitle')}</h1>
          <p className="text-sm text-stone-600">{t(lang, 'tagline')}</p>
        </div>
        <button type="button" onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}
          className="shrink-0 rounded-full border border-stone-300 bg-white px-3 py-1 text-sm">
          {t(lang, 'langToggle')}
        </button>
      </header>

      <TimetableForm lang={lang} timetable={timetable} weekday={weekday}
        onWeekday={(d) => { setWeekday(d); setPlan(null) }}
        onChange={(tt) => { setTimetable(tt); setPlan(null) }} />

      <button type="button" onClick={onPlan} disabled={loading}
        className="w-full rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white disabled:opacity-60">
        {loading ? t(lang, 'planning') : t(lang, 'makePlan')}
      </button>
      {error && (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          {t(lang, 'planError')}: {error}
        </p>
      )}

      {plan && <PlanResult plan={plan} lang={lang} />}
      <Backtest data={backtest} lang={lang} />
      <Sources lang={lang} plan={plan} backtest={backtest} />
    </div>
  )
}
