import { t, type Lang } from '../i18n/strings'
import { addSlot, removeSlot, sortedSlots, updateSlot } from '../timetable'
import type { Timetable } from '../types'
import { input } from '../ui'

export function SlotsEditor({ lang, timetable, onChange }: {
  lang: Lang
  timetable: Timetable
  onChange: (tt: Timetable) => void
}) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
      <h2 className="text-lg font-semibold">{t(lang, 'slots')}</h2>
      <p className="mb-3 text-xs text-stone-500">{t(lang, 'slotsHelp')}</p>
      {timetable.slots.length > 0 && (
        <div aria-hidden="true" className="mb-1 flex gap-2 pr-9 text-xs text-stone-600">
          <span className="flex-1">{t(lang, 'start')}</span>
          <span className="flex-1">{t(lang, 'end')}</span>
        </div>
      )}
      <ul className="space-y-2">
        {sortedSlots(timetable.slots).map((s) => (
          <li key={s.id} className="flex items-center gap-2">
            <input className={`${input} flex-1`} type="time" value={s.start} aria-label={t(lang, 'start')}
              onChange={(e) => onChange(updateSlot(timetable, s.id, { start: e.target.value }))} />
            <input className={`${input} flex-1`} type="time" value={s.end} aria-label={t(lang, 'end')}
              onChange={(e) => onChange(updateSlot(timetable, s.id, { end: e.target.value }))} />
            <button type="button" aria-label={`${t(lang, 'remove')} ${s.start}`}
              onClick={() => onChange(removeSlot(timetable, s.id))}
              className="w-7 shrink-0 rounded-md py-1.5 text-sm text-red-700 hover:bg-red-50">
              ✕
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => onChange(addSlot(timetable))}
        className="mt-3 text-sm font-medium text-emerald-800">
        {t(lang, 'addSlot')}
      </button>
    </div>
  )
}
