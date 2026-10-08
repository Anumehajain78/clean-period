import { t, weekdayNames, type Lang } from '../i18n/strings'
import { addClass, schoolDays } from '../timetable'
import type { Timetable } from '../types'
import { input } from '../ui'
import { ClassEditor } from './ClassEditor'
import { SchoolCard } from './SchoolCard'
import { SlotsEditor } from './SlotsEditor'

interface Props {
  lang: Lang
  timetable: Timetable
  weekday: string
  onWeekday: (day: string) => void
  onChange: (tt: Timetable) => void
  onLoadSample: () => void
  onStartEmpty: () => void
}

export function TimetableForm({ lang, timetable, weekday, onWeekday, onChange, onLoadSample, onStartEmpty }: Props) {
  const confirmThen = (fn: () => void) => () => {
    if (window.confirm(t(lang, 'confirmReplace'))) fn()
  }

  return (
    <section className="space-y-4">
      <SchoolCard lang={lang} school={timetable.school}
        onChange={(patch) => onChange({ ...timetable, school: { ...timetable.school, ...patch } })} />

      <SlotsEditor lang={lang} timetable={timetable} onChange={onChange} />

      <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
        <h2 className="text-lg font-semibold">{t(lang, 'timetable')}</h2>
        {timetable._note && (
          <p className="mt-1 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-900">{t(lang, 'sampleNote')}</p>
        )}
        <label className="mt-3 block text-xs text-stone-600">
          {t(lang, 'dayLabel')}
          <select className={input} value={weekday} onChange={(e) => onWeekday(e.target.value)}>
            {schoolDays(timetable).map((d) => (
              <option key={d} value={d}>{weekdayNames[d]?.[lang] ?? d}</option>
            ))}
          </select>
        </label>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <button type="button" className="text-stone-600 underline" onClick={confirmThen(onLoadSample)}>
            {t(lang, 'resetSample')}
          </button>
          <button type="button" className="text-stone-600 underline" onClick={confirmThen(onStartEmpty)}>
            {t(lang, 'startEmpty')}
          </button>
          <span className="text-stone-500">{t(lang, 'savedLocally')}</span>
        </div>
      </div>

      <h2 className="px-1 text-lg font-semibold">{t(lang, 'classes')}</h2>
      {timetable.classes.map((c, ci) => (
        <ClassEditor key={c.id} lang={lang} timetable={timetable} ci={ci} day={weekday} onChange={onChange} />
      ))}
      <button type="button" onClick={() => onChange(addClass(timetable))}
        className="w-full rounded-xl border border-dashed border-stone-400 bg-white px-4 py-2 text-sm font-medium text-emerald-800">
        {t(lang, 'addClass')}
      </button>
    </section>
  )
}
