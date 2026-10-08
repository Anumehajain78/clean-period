import { activityNames, t, type Lang } from '../i18n/strings'
import { addPeriod, removeClass, removePeriod, sortedSlots, updateClass, updatePeriod } from '../timetable'
import type { Activity, Timetable } from '../types'
import { OUTDOOR, input } from '../ui'

export function ClassEditor({ lang, timetable, ci, day, onChange }: {
  lang: Lang
  timetable: Timetable
  ci: number
  day: string
  onChange: (tt: Timetable) => void
}) {
  const cls = timetable.classes[ci]
  const bySlot = Object.fromEntries((cls.days[day] ?? []).map((p) => [p.slot, p]))

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
      <div className="mb-3 flex items-end gap-2">
        <label className="flex-1 text-xs text-stone-600">
          {t(lang, 'className')}
          <input className={`${input} font-medium`} value={cls.name} placeholder="VI-B"
            onChange={(e) => onChange(updateClass(timetable, ci, { name: e.target.value }))} />
        </label>
        <button type="button" onClick={() => onChange(removeClass(timetable, ci))}
          className="mb-0.5 rounded-md px-2 py-1.5 text-xs text-red-700 hover:bg-red-50">
          {t(lang, 'removeClass')}
        </button>
      </div>

      <ul className="space-y-2">
        {sortedSlots(timetable.slots).map((s) => {
          const p = bySlot[s.id]
          if (!p) {
            return (
              <li key={s.id} className="flex items-center justify-between rounded-lg border border-dashed border-stone-300 px-2 py-1.5 text-xs text-stone-500">
                <span>{s.start}–{s.end} · {t(lang, 'emptySlot')}</span>
                <button type="button" className="font-medium text-emerald-800"
                  onClick={() => onChange(addPeriod(timetable, ci, day, s.id))}>
                  {t(lang, 'addPeriod')}
                </button>
              </li>
            )
          }
          const outdoor = OUTDOOR.has(p.activity)
          const set = (patch: Parameters<typeof updatePeriod>[4]) => onChange(updatePeriod(timetable, ci, day, s.id, patch))
          return (
            <li key={s.id} className="rounded-lg border border-stone-200 p-2">
              <div className="mb-1 flex items-center justify-between text-xs text-stone-500">
                <span>{s.start}–{s.end}</span>
                <span className="flex items-center gap-2">
                  <span className={outdoor ? 'text-orange-700' : ''}>{outdoor ? t(lang, 'outdoor') : t(lang, 'indoor')}</span>
                  <button type="button" aria-label={`${t(lang, 'remove')} ${p.subject}`}
                    onClick={() => onChange(removePeriod(timetable, ci, day, s.id))}
                    className="rounded px-1 text-red-700 hover:bg-red-50">✕</button>
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input className={`${input} ${p.subject.trim() ? '' : 'border-red-400'}`} aria-label={t(lang, 'subject')}
                  placeholder={t(lang, 'subject')} value={p.subject}
                  onChange={(e) => set({ subject: e.target.value })} />
                <select className={input} aria-label={t(lang, 'activity')} value={p.activity}
                  onChange={(e) => {
                    const activity = e.target.value as Activity
                    set({ activity, place: OUTDOOR.has(activity) ? 'ground' : 'classroom' })
                  }}>
                  {Object.keys(activityNames).map((a) => (
                    <option key={a} value={a}>{activityNames[a][lang]}</option>
                  ))}
                </select>
                <input className={input} aria-label={t(lang, 'teacher')} placeholder={t(lang, 'teacher')}
                  value={p.teacher ?? ''} onChange={(e) => set({ teacher: e.target.value || null })} />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={p.movable} onChange={(e) => set({ movable: e.target.checked })} />
                  {p.movable ? t(lang, 'movable') : t(lang, 'fixed')}
                </label>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
