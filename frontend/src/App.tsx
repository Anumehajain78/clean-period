import { useEffect, useState } from 'react'
import backtestJson from '../../data/backtest_result.json'
import sampleTimetable from '../../data/sample_timetable.json'
import { makeNotice, makePlan } from './api'
import { Backtest } from './components/Backtest'
import { NightlyCard } from './components/NightlyCard'
import { NoticeCard } from './components/NoticeCard'
import { PlanResult } from './components/PlanResult'
import { Sources } from './components/Sources'
import { TimetableForm } from './components/TimetableForm'
import { t, weekdayNames, type Lang } from './i18n/strings'
import { loadTimetable, saveTimetable } from './storage'
import { emptyTimetable, problems, schoolDays, sortedSlots } from './timetable'
import type { BacktestResult, NoticeResponse, PlanResponse, Timetable } from './types'
import { tomorrowWeekday } from './ui'

const backtest = backtestJson as unknown as BacktestResult
const sample = sampleTimetable as unknown as Timetable

export default function App() {
  const [lang, setLang] = useState<Lang>('en')
  const [timetable, setTimetable] = useState<Timetable>(() => loadTimetable() ?? structuredClone(sample))
  const tomorrow = tomorrowWeekday()
  const [weekday, setWeekday] = useState(() => {
    const days = schoolDays(timetable)
    return days.includes(tomorrow) ? tomorrow : days[0]
  })
  useEffect(() => saveTimetable(timetable), [timetable])
  const issues = problems(timetable, weekday)
  const [plan, setPlan] = useState<PlanResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<NoticeResponse | null>(null)
  const [writing, setWriting] = useState(false)
  const [noticeError, setNoticeError] = useState<string | null>(null)

  function resetPlan() {
    setPlan(null)
    setNotice(null)
    setNoticeError(null)
  }

  async function onPlan() {
    setLoading(true)
    setError(null)
    resetPlan()
    try {
      setPlan(await makePlan({
        school: timetable.school,
        slots: sortedSlots(timetable.slots),
        classes: timetable.classes.map((c) => ({ id: c.id, name: c.name, periods: c.days[weekday] ?? [] })),
      }))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  async function onNotice() {
    if (!plan) return
    setWriting(true)
    setNoticeError(null)
    try {
      setNotice(await makeNotice(plan, timetable.school.name))
    } catch (e) {
      setNoticeError(e instanceof Error ? e.message : String(e))
    } finally {
      setWriting(false)
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
        onWeekday={(d) => { setWeekday(d); resetPlan() }}
        onChange={(tt) => { setTimetable(tt); resetPlan() }}
        onLoadSample={() => { setTimetable(structuredClone(sample)); resetPlan() }}
        onStartEmpty={() => { setTimetable(emptyTimetable()); resetPlan() }} />

      {weekday !== tomorrow && (
        <p className="rounded-md bg-sky-50 px-3 py-2 text-sm text-sky-900">
          {t(lang, 'usingDay', {
            tomorrow: weekdayNames[tomorrow]?.[lang] ?? tomorrow,
            day: weekdayNames[weekday]?.[lang] ?? weekday,
          })}
        </p>
      )}
      {issues.length > 0 && (
        <div role="status" className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-medium">{t(lang, 'fixFirst')}</p>
          <ul className="mt-1 list-disc pl-5">
            {issues.map((p, i) => <li key={i}>{t(lang, p.key)}{p.detail ? ` (${p.detail})` : ''}</li>)}
          </ul>
        </div>
      )}
      <button type="button" onClick={onPlan} disabled={loading || issues.length > 0}
        className="w-full rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white disabled:opacity-60">
        {loading ? t(lang, 'planning') : t(lang, 'makePlan')}
      </button>
      {error && (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          {t(lang, 'planError')}: {error}
        </p>
      )}

      {plan && <PlanResult plan={plan} lang={lang} />}
      {plan && !notice && (
        <button type="button" onClick={onNotice} disabled={writing}
          className="w-full rounded-xl border-2 border-emerald-700 bg-white px-4 py-3 font-semibold text-emerald-800 disabled:opacity-60">
          {writing ? t(lang, 'writing') : t(lang, 'makeNotice')}
        </button>
      )}
      {noticeError && (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          {t(lang, 'noticeError')}: {noticeError}
        </p>
      )}
      {notice && <NoticeCard notice={notice} lang={lang} />}
      <NightlyCard lang={lang} timetable={timetable} canSave={issues.length === 0} />
      <Backtest data={backtest} lang={lang} />
      <Sources lang={lang} plan={plan} backtest={backtest} />
    </div>
  )
}
