import { activityNames, t, weekdayNames, type Lang } from '../i18n/strings'
import type { Activity, Period, Timetable } from '../types'
import { OUTDOOR } from '../ui'

interface Props {
  lang: Lang
  timetable: Timetable
  weekday: string
  onWeekday: (day: string) => void
  onChange: (tt: Timetable) => void
}

const input = 'w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm'

export function TimetableForm({ lang, timetable, weekday, onWeekday, onChange }: Props) {
  const school = timetable.school
  const days = Object.keys(timetable.classes[0]?.days ?? {})
  const slotById = Object.fromEntries(timetable.slots.map((s) => [s.id, s]))

  const setSchool = (patch: Partial<typeof school>) =>
    onChange({ ...timetable, school: { ...school, ...patch } })

  const setPeriod = (ci: number, pi: number, patch: Partial<Period>) => {
    const classes = timetable.classes.map((c, i) => {
      if (i !== ci) return c
      const periods = c.days[weekday].map((p, j) => (j === pi ? { ...p, ...patch } : p))
      return { ...c, days: { ...c.days, [weekday]: periods } }
    })
    onChange({ ...timetable, classes })
  }

  return (
    <section className="space-y-4">
      <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
        <h2 className="mb-3 text-lg font-semibold">{t(lang, 'school')}</h2>
        <input className={input} value={school.name} onChange={(e) => setSchool({ name: e.target.value })} />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="text-xs text-stone-600">
            {t(lang, 'latitude')}
            <input className={input} type="number" step="0.0001" value={school.latitude}
              onChange={(e) => setSchool({ latitude: Number(e.target.value) })} />
          </label>
          <label className="text-xs text-stone-600">
            {t(lang, 'longitude')}
            <input className={input} type="number" step="0.0001" value={school.longitude}
              onChange={(e) => setSchool({ longitude: Number(e.target.value) })} />
          </label>
        </div>
      </div>

      <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
        <h2 className="text-lg font-semibold">{t(lang, 'timetable')}</h2>
        {timetable._note && (
          <p className="mt-1 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-900">{t(lang, 'sampleNote')}</p>
        )}
        <label className="mt-3 block text-xs text-stone-600">
          {t(lang, 'dayLabel')}
          <select className={input} value={weekday} onChange={(e) => onWeekday(e.target.value)}>
            {days.map((d) => (
              <option key={d} value={d}>{weekdayNames[d]?.[lang] ?? d}</option>
            ))}
          </select>
        </label>

        {timetable.classes.map((cls, ci) => (
          <div key={cls.id} className="mt-4">
            <h3 className="mb-2 font-medium">{cls.name}</h3>
            <ul className="space-y-2">
              {(cls.days[weekday] ?? []).map((p, pi) => (
                <li key={p.slot} className="rounded-lg border border-stone-200 p-2">
                  <div className="mb-1 flex items-center justify-between text-xs text-stone-500">
                    <span>{slotById[p.slot]?.start}–{slotById[p.slot]?.end}</span>
                    <span className={OUTDOOR.has(p.activity) ? 'text-orange-700' : 'text-stone-500'}>
                      {OUTDOOR.has(p.activity) ? t(lang, 'outdoor') : t(lang, 'indoor')}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input className={input} aria-label={t(lang, 'subject')} value={p.subject}
                      disabled={!p.movable}
                      onChange={(e) => setPeriod(ci, pi, { subject: e.target.value })} />
                    <select className={input} aria-label={t(lang, 'activity')} value={p.activity}
                      disabled={!p.movable}
                      onChange={(e) => {
                        const activity = e.target.value as Activity
                        setPeriod(ci, pi, { activity, place: OUTDOOR.has(activity) ? 'ground' : 'classroom' })
                      }}>
                      {Object.keys(activityNames).map((a) => (
                        <option key={a} value={a}>{activityNames[a][lang]}</option>
                      ))}
                    </select>
                    <input className={input} aria-label={t(lang, 'teacher')} placeholder={t(lang, 'teacher')}
                      value={p.teacher ?? ''} disabled={!p.movable}
                      onChange={(e) => setPeriod(ci, pi, { teacher: e.target.value || null })} />
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={p.movable}
                        onChange={(e) => setPeriod(ci, pi, { movable: e.target.checked })} />
                      {p.movable ? t(lang, 'movable') : t(lang, 'fixed')}
                    </label>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
