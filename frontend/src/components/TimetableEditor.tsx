import type { Activity, ClassTimetable, Period } from '../api/types'
import { useLang } from '../i18n/lang'
import type { Key } from '../i18n/strings'
import { ACTIVITIES, FIXED_ACTIVITIES, addMinutes, minutesBetween } from '../lib/format'
import { newPeriod } from '../state/usePlanner'
import { Button, inputCls } from './ui'

export const ACTIVITY_KEY: Record<Activity, Key> = {
  classroom: 'actClassroom',
  pe: 'actPe',
  indoor_activity: 'actIndoor',
  assembly: 'actAssembly',
  recess: 'actRecess',
}

const COLS = 'md:grid-cols-[92px_92px_minmax(0,1.2fr)_150px_minmax(0,1fr)_64px_32px]'

export function TimetableEditor({
  cls,
  onChange,
  onLoadSample,
}: {
  cls: ClassTimetable
  onChange: (fn: (c: ClassTimetable) => ClassTimetable) => void
  onLoadSample: () => void
}) {
  const { t } = useLang()

  const patch = (id: string, p: Partial<Period>) =>
    onChange((c) => ({
      ...c,
      periods: c.periods.map((x) => {
        if (x.id !== id) return x
        const next = { ...x, ...p }
        if (p.activity && FIXED_ACTIVITIES.includes(p.activity)) next.movable = false
        return next
      }),
    }))

  const remove = (id: string) => onChange((c) => ({ ...c, periods: c.periods.filter((x) => x.id !== id) }))

  const add = () =>
    onChange((c) => {
      const last = c.periods[c.periods.length - 1]
      const start = last?.end ?? ''
      const len = last && last.start && last.end && last.end > last.start ? minutesBetween(last.start, last.end) : 40
      const end = start ? addMinutes(start, len) : ''
      return { ...c, periods: [...c.periods, newPeriod(start, end)] }
    })

  if (cls.periods.length === 0) {
    return (
      <div className="flex h-full min-h-48 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="max-w-sm text-muted">{t('emptyTimetable')}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="primary" onClick={add}>
            {t('addPeriod')}
          </Button>
          <Button onClick={onLoadSample}>{t('loadSample')}</Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div
        className={
          'hidden grid-cols-1 gap-2 border-b border-line px-4 py-2 text-[13px] font-medium text-muted md:grid ' + COLS
        }
      >
        <span>{t('start')}</span>
        <span>{t('end')}</span>
        <span>{t('subject')}</span>
        <span>{t('activity')}</span>
        <span>{t('teacher')}</span>
        <span title={t('fixedHelp')}>{t('fixed')}</span>
        <span />
      </div>
      <ul>
        {cls.periods.map((p) => {
          const forcedFixed = FIXED_ACTIVITIES.includes(p.activity)
          const fixed = forcedFixed || !p.movable
          const badEnd = !!p.start && !!p.end && p.end <= p.start
          return (
            <li
              key={p.id}
              className={'grid grid-cols-6 gap-2 border-b border-line px-4 py-3 md:items-center md:py-2 ' + COLS}
            >
              <input
                aria-label={t('start')}
                type="time"
                value={p.start}
                onChange={(e) => patch(p.id, { start: e.target.value })}
                className={inputCls + ' num col-span-2 md:order-1 md:col-span-1'}
              />
              <input
                aria-label={t('end')}
                type="time"
                value={p.end}
                aria-invalid={badEnd}
                onChange={(e) => patch(p.id, { end: e.target.value })}
                className={
                  inputCls + ' num col-span-2 md:order-2 md:col-span-1 ' + (badEnd ? 'border-bad ring-1 ring-bad' : '')
                }
              />
              <select
                aria-label={t('activity')}
                value={p.activity}
                onChange={(e) => patch(p.id, { activity: e.target.value as Activity })}
                className={inputCls + ' col-span-2 md:order-4 md:col-span-1'}
              >
                {ACTIVITIES.map((a) => (
                  <option key={a} value={a}>
                    {t(ACTIVITY_KEY[a])}
                  </option>
                ))}
              </select>
              <input
                aria-label={t('subject')}
                placeholder={t('subject')}
                value={p.subject}
                onChange={(e) => patch(p.id, { subject: e.target.value })}
                className={inputCls + ' col-span-3 md:order-3 md:col-span-1'}
              />
              <input
                aria-label={t('teacher')}
                placeholder={t('teacher')}
                value={p.teacher}
                onChange={(e) => patch(p.id, { teacher: e.target.value })}
                className={inputCls + ' col-span-3 md:order-5 md:col-span-1'}
              />
              <label
                title={t('fixedHelp')}
                className="col-span-5 flex items-center gap-2 text-sm text-muted md:order-6 md:col-span-1"
              >
                <input
                  type="checkbox"
                  checked={fixed}
                  disabled={forcedFixed}
                  onChange={(e) => patch(p.id, { movable: !e.target.checked })}
                  className="h-4 w-4 accent-[var(--color-accent)]"
                />
                <span className="md:sr-only">{t('fixed')}</span>
              </label>
              <button
                type="button"
                aria-label={t('removePeriod')}
                title={t('removePeriod')}
                onClick={() => remove(p.id)}
                className="col-span-1 flex h-9 w-8 items-center justify-center justify-self-end rounded-[4px] text-xl leading-none text-muted hover:bg-wash hover:text-bad md:order-7"
              >
                ×
              </button>
            </li>
          )
        })}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <Button small onClick={add}>
          + {t('addPeriod')}
        </Button>
        <span className="text-xs text-muted">{t('fixedHelp')}</span>
      </div>
    </div>
  )
}
