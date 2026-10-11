import { useState } from 'react'
import type { Activity, ClassTimetable, ExtractedPeriod, Period } from '../api/types'
import { useLang } from '../i18n/lang'
import type { Key } from '../i18n/strings'
import { ACTIVITIES, FIXED_ACTIVITIES, addMinutes, isIndoors, minutesBetween, type DayShape } from '../lib/format'
import { newPeriod } from '../state/usePlanner'
import { DayStrip, stripRange } from './DayStrip'
import { FillDay } from './FillDay'
import { PhotoImport } from './PhotoImport'
import { Button, inputCls } from './ui'

export const ACTIVITY_KEY: Record<Activity, Key> = {
  classroom: 'actClassroom',
  pe: 'actPe',
  indoor_activity: 'actIndoor',
  assembly: 'actAssembly',
  recess: 'actRecess',
}

const COLS = '@3xl:grid-cols-[88px_88px_minmax(0,1.3fr)_150px_minmax(0,1fr)_84px_36px]'

type Mode = 'rows' | 'fill' | 'photo'

function StartOption({ title, body, onClick, primary }: { title: string; body: string; onClick: () => void; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'flex flex-col items-start gap-1 rounded-xl border p-4 text-left transition-colors ' +
        (primary ? 'border-accent bg-accent-wash hover:bg-accent-wash/70' : 'border-line bg-surface hover:border-muted/50')
      }
    >
      <span className="display text-[16px] font-semibold text-ink">{title}</span>
      <span className="text-sm text-muted">{body}</span>
    </button>
  )
}

export function TimetableEditor({
  cls,
  onChange,
  onFill,
  onReading,
}: {
  cls: ClassTimetable
  onChange: (fn: (c: ClassTimetable) => ClassTimetable) => void
  onFill: (shape: DayShape) => void
  onReading: (rows: ExtractedPeriod[], className: string) => void
}) {
  const { t } = useLang()
  const [mode, setMode] = useState<Mode>('rows')

  const patch = (id: string, p: Partial<Period>) =>
    onChange((c) => ({
      ...c,
      periods: c.periods.map((x) => {
        if (x.id !== id) return x
        const next = { ...x, ...p }
        if (p.activity) next.movable = !FIXED_ACTIVITIES.includes(p.activity)
        return next
      }),
    }))

  const remove = (id: string) => onChange((c) => ({ ...c, periods: c.periods.filter((x) => x.id !== id) }))

  const add = () =>
    onChange((c) => {
      const last = c.periods[c.periods.length - 1]
      const start = last?.end ?? '08:00'
      const len = last && last.start && last.end && last.end > last.start ? minutesBetween(last.start, last.end) : 40
      return { ...c, periods: [...c.periods, newPeriod(start, addMinutes(start, len))] }
    })

  const sortByTime = () =>
    onChange((c) => ({ ...c, periods: [...c.periods].sort((a, b) => (a.start || '99').localeCompare(b.start || '99')) }))

  const replaceOk = () => cls.periods.length === 0 || window.confirm(t('replaceConfirm'))

  const strip = cls.periods.map((p) => ({
    start: p.start,
    end: p.end,
    subject: p.subject,
    outdoor: !isIndoors(p.activity),
  }))
  const range = stripRange([strip])
  const outOfOrder = cls.periods.some((p, i) => i > 0 && p.start && cls.periods[i - 1].start && p.start < cls.periods[i - 1].start)

  return (
    <div className="mx-auto max-w-5xl px-4 pb-10 pt-5">
      <label className="block">
        <span className="sr-only">{t('className')}</span>
        <input
          value={cls.name}
          onChange={(e) => onChange((c) => ({ ...c, name: e.target.value }))}
          placeholder={t('classNamePlaceholder')}
          className="display w-full border-b border-transparent bg-transparent pb-1 text-2xl font-semibold text-ink placeholder:font-normal placeholder:text-muted/60 hover:border-line focus:border-accent focus:outline-none"
        />
      </label>
      <p className="mt-1 text-sm text-muted">{t('timetableFor')}</p>

      {range && (
        <div className="mt-5">
          <DayStrip periods={strip} range={range} tall />
          <div className="mt-1.5 flex gap-4 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-outdoor" /> {t('outdoors')}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm border border-line bg-surface" /> {t('indoors')}
            </span>
          </div>
        </div>
      )}

      {mode === 'fill' && (
        <div className="mt-5">
          <FillDay
            onCancel={() => setMode('rows')}
            onFill={(shape) => {
              if (!replaceOk()) return
              onFill(shape)
              setMode('rows')
            }}
          />
        </div>
      )}
      {mode === 'photo' && (
        <div className="mt-5">
          <PhotoImport
            onCancel={() => setMode('rows')}
            onUse={(rows, name) => {
              if (!replaceOk()) return
              onReading(rows, name)
              setMode('rows')
            }}
          />
        </div>
      )}

      {mode === 'rows' && cls.periods.length === 0 && (
        <div className="mt-6">
          <h3 className="display text-lg font-semibold">{t('emptyTitle')}</h3>
          <p className="mt-1 text-[15px] text-muted">{t('emptyBody')}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <StartOption primary title={t('optFillTitle')} body={t('optFillBody')} onClick={() => setMode('fill')} />
            <StartOption title={t('optPhotoTitle')} body={t('optPhotoBody')} onClick={() => setMode('photo')} />
            <StartOption title={t('optOneTitle')} body={t('optOneBody')} onClick={add} />
          </div>
        </div>
      )}

      {mode === 'rows' && cls.periods.length > 0 && (
        <div className="@container mt-6 overflow-hidden rounded-xl border border-line bg-surface">
          <div className={'hidden gap-2 border-b border-line bg-wash/60 px-3 py-2 text-[13px] font-medium text-muted @3xl:grid ' + COLS}>
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
              const outdoor = !isIndoors(p.activity)
              return (
                <li
                  key={p.id}
                  className={
                    'grid grid-cols-6 gap-2 border-b border-l-[3px] border-b-line px-3 py-3 last:border-b-0 @3xl:items-center @3xl:py-2 ' +
                    COLS +
                    (outdoor ? ' border-l-outdoor bg-outdoor-wash/40' : ' border-l-transparent')
                  }
                >
                  <input
                    aria-label={t('start')}
                    type="time"
                    value={p.start}
                    onChange={(e) => patch(p.id, { start: e.target.value })}
                    className={inputCls + ' num col-span-2 @3xl:col-span-1'}
                  />
                  <input
                    aria-label={t('end')}
                    type="time"
                    value={p.end}
                    aria-invalid={badEnd}
                    onChange={(e) => patch(p.id, { end: e.target.value })}
                    className={inputCls + ' num col-span-2 @3xl:col-span-1 ' + (badEnd ? 'border-bad ring-1 ring-bad' : '')}
                  />
                  <button
                    type="button"
                    aria-label={t('removePeriod')}
                    title={t('removePeriod')}
                    onClick={() => remove(p.id)}
                    className="col-span-2 flex h-9 items-center justify-end justify-self-end rounded-md px-2 text-xl leading-none text-muted hover:bg-wash hover:text-bad @3xl:order-last @3xl:col-span-1 @3xl:w-9 @3xl:justify-center"
                  >
                    ×
                  </button>
                  <input
                    aria-label={t('subject')}
                    placeholder={t('subject')}
                    value={p.subject}
                    aria-invalid={!p.subject.trim()}
                    onChange={(e) => patch(p.id, { subject: e.target.value })}
                    className={inputCls + ' col-span-6 font-medium @3xl:col-span-1'}
                  />
                  <select
                    aria-label={t('activity')}
                    value={p.activity}
                    onChange={(e) => patch(p.id, { activity: e.target.value as Activity })}
                    className={inputCls + ' col-span-3 @3xl:col-span-1'}
                  >
                    {ACTIVITIES.map((a) => (
                      <option key={a} value={a}>
                        {t(ACTIVITY_KEY[a])}
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label={t('teacher')}
                    placeholder={t('teacherPlaceholder')}
                    value={p.teacher}
                    onChange={(e) => patch(p.id, { teacher: e.target.value })}
                    className={inputCls + ' col-span-3 @3xl:col-span-1'}
                  />
                  <label title={t('fixedHelp')} className="col-span-6 flex items-center gap-2 text-sm text-muted @3xl:col-span-1">
                    <input
                      type="checkbox"
                      checked={fixed}
                      disabled={forcedFixed}
                      onChange={(e) => patch(p.id, { movable: !e.target.checked })}
                      className="h-4 w-4 accent-[var(--color-accent)]"
                    />
                    <span>{fixed ? t('fixed') : t('canMove')}</span>
                  </label>
                </li>
              )
            })}
          </ul>
          <div className="flex flex-wrap items-center gap-2 border-t border-line bg-wash/40 px-3 py-2.5">
            <Button small onClick={add}>
              + {t('addPeriod')}
            </Button>
            {outOfOrder && (
              <Button small variant="quiet" onClick={sortByTime}>
                {t('sortByTime')}
              </Button>
            )}
            <span className="flex-1" />
            <Button small variant="quiet" onClick={() => setMode('fill')}>
              {t('optFillTitle')}
            </Button>
            <Button small variant="quiet" onClick={() => setMode('photo')}>
              {t('optPhotoTitle')}
            </Button>
          </div>
        </div>
      )}
      {mode === 'rows' && cls.periods.length > 0 && <p className="mt-2 text-xs text-muted">{t('fixedHelp')}</p>}
    </div>
  )
}
