import { useRef, useState } from 'react'
import { api, ApiError } from '../api/client'
import type { ExtractResponse, ExtractedPeriod } from '../api/types'
import { useLang } from '../i18n/lang'
import { photoToJpegBase64 } from '../lib/image'
import { tomorrowWeekday, weekdayLabel } from '../lib/format'
import { Button, Notice, Spinner } from './ui'

type State = { kind: 'idle' } | { kind: 'reading' } | { kind: 'review'; data: ExtractResponse } | { kind: 'error'; msg: string }

/** Read a timetable photo with AI, then let the teacher pick the day and check the rows. */
export function PhotoImport({
  onUse,
  onCancel,
}: {
  onUse: (rows: ExtractedPeriod[], className: string) => void
  onCancel: () => void
}) {
  const { t, lang } = useLang()
  const input = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<State>({ kind: 'idle' })
  const [day, setDay] = useState<string>('')

  const read = async (file: File) => {
    setState({ kind: 'reading' })
    try {
      const image = await photoToJpegBase64(file)
      const data = await api.extract(image, 'image/jpeg')
      const days = Object.keys(data.days)
      setDay(days.includes(tomorrowWeekday()) ? tomorrowWeekday() : days[0])
      setState({ kind: 'review', data })
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.status === 413
            ? t('photoTooBig')
            : e.status === 422
              ? t('photoNothing')
              : e.kind === 'network'
                ? t('errNetwork')
                : t('photoFailed', { reason: e.detail ?? e.message })
          : t('photoNotImage')
      setState({ kind: 'error', msg })
    }
  }

  const choose = () => input.current?.click()

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) void read(f)
        }}
      />

      {state.kind === 'idle' && (
        <div className="space-y-3">
          <p className="text-[15px]">{t('photoHint')}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={choose}>
              {t('photoChoose')}
            </Button>
            <Button variant="quiet" onClick={onCancel}>
              {t('cancel')}
            </Button>
          </div>
        </div>
      )}

      {state.kind === 'reading' && (
        <div className="flex items-center gap-3 py-2 text-[15px]" role="status">
          <Spinner /> {t('photoReading')}
        </div>
      )}

      {state.kind === 'error' && (
        <div className="space-y-3">
          <Notice tone="bad">{state.msg}</Notice>
          <div className="flex flex-wrap gap-2">
            <Button onClick={choose}>{t('photoAnother')}</Button>
            <Button variant="quiet" onClick={onCancel}>
              {t('cancel')}
            </Button>
          </div>
        </div>
      )}

      {state.kind === 'review' && (
        <div className="space-y-3">
          <Notice tone="warn">{t('photoCheck')}</Notice>
          <div>
            <p className="mb-1.5 text-[13px] font-medium text-muted">{t('photoDay')}</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.keys(state.data.days).map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={d === day}
                  onClick={() => setDay(d)}
                  className={
                    'h-8 rounded-full border px-3 text-sm ' +
                    (d === day ? 'border-accent bg-accent text-white' : 'border-line hover:bg-wash')
                  }
                >
                  {weekdayLabel(d, lang)}
                  {d === tomorrowWeekday() && <span className="ml-1 opacity-80">· {t('tomorrow')}</span>}
                </button>
              ))}
            </div>
          </div>

          <ul className="max-h-72 divide-y divide-line overflow-y-auto rounded-lg border border-line">
            {(state.data.days[day] ?? []).map((r, i) => (
              <li key={i} className="flex items-center gap-3 px-3 py-1.5 text-sm">
                <span className="num w-24 shrink-0 text-muted">
                  {r.start}–{r.end}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">{r.subject}</span>
                {(r.activity === 'pe' || r.activity === 'assembly' || r.activity === 'recess') && (
                  <span className="shrink-0 rounded-full bg-outdoor-wash px-2 text-xs text-outdoor">{t('outdoorTag')}</span>
                )}
              </li>
            ))}
          </ul>
          {state.data.dropped > 0 && <p className="text-xs text-warn">{t('photoDropped', { n: state.data.dropped })}</p>}

          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => onUse(state.data.days[day] ?? [], state.data.class_name)}>
              {t('photoUse', { n: (state.data.days[day] ?? []).length })}
            </Button>
            <Button onClick={choose}>{t('photoAnother')}</Button>
            <Button variant="quiet" onClick={onCancel}>
              {t('cancel')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
