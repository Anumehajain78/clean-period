import { useState } from 'react'
import { useLang } from '../i18n/lang'
import { buildDay, type DayShape } from '../lib/format'
import { Button, Field, inputCls } from './ui'

/** Generate a school day's bell times; the teacher then types the subjects. */
export function FillDay({ onFill, onCancel }: { onFill: (shape: DayShape) => void; onCancel: () => void }) {
  const { t } = useLang()
  const [shape, setShape] = useState<DayShape>({ first: '08:00', length: 40, count: 8, breakAfter: 4, breakLength: 20 })
  const set = (k: keyof DayShape, v: string) =>
    setShape((s) => ({ ...s, [k]: k === 'first' ? v : Math.max(0, Math.round(Number(v) || 0)) }))

  const ok = /^\d\d:\d\d$/.test(shape.first) && shape.length >= 5 && shape.length <= 180 && shape.count >= 1 && shape.count <= 16
  const rows = ok ? buildDay(shape) : []

  return (
    <div className="space-y-4 rounded-xl border border-line bg-surface p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label={t('fillFirst')}>
          <input type="time" className={inputCls + ' num'} value={shape.first} onChange={(e) => set('first', e.target.value)} />
        </Field>
        <Field label={t('fillLength')}>
          <input type="number" min={5} max={180} className={inputCls + ' num'} value={shape.length} onChange={(e) => set('length', e.target.value)} />
        </Field>
        <Field label={t('fillCount')}>
          <input type="number" min={1} max={16} className={inputCls + ' num'} value={shape.count} onChange={(e) => set('count', e.target.value)} />
        </Field>
        <Field label={t('fillBreakAfter')}>
          <select className={inputCls} value={shape.breakAfter} onChange={(e) => set('breakAfter', e.target.value)}>
            <option value={0}>{t('fillNoBreak')}</option>
            {Array.from({ length: Math.max(shape.count - 1, 0) }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </Field>
        {shape.breakAfter > 0 && (
          <Field label={t('fillBreakLength')}>
            <input type="number" min={5} max={90} className={inputCls + ' num'} value={shape.breakLength} onChange={(e) => set('breakLength', e.target.value)} />
          </Field>
        )}
      </div>
      {rows.length > 0 && (
        <p className="num text-sm text-muted">
          {t('fillPreview', { from: rows[0].start, to: rows[rows.length - 1].end, n: shape.count })}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" disabled={!ok} onClick={() => onFill(shape)}>
          {t('fillApply')}
        </Button>
        <Button variant="quiet" onClick={onCancel}>
          {t('cancel')}
        </Button>
      </div>
    </div>
  )
}
