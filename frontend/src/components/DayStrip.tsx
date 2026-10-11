import { bandFor } from '../lib/aqi'
import { hourOf } from '../lib/format'

export interface StripPeriod {
  start: string
  end: string
  subject: string
  outdoor: boolean
  /** Moved or made indoor: drawn with a ring. */
  highlight?: boolean
  /** The slot a moved period left: drawn dashed. */
  ghost?: boolean
}

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))

export function stripRange(groups: StripPeriod[][]): { from: number; to: number } | null {
  const all = groups.flat().filter((p) => /^\d\d:\d\d$/.test(p.start) && /^\d\d:\d\d$/.test(p.end) && p.end > p.start)
  if (!all.length) return null
  return {
    from: Math.min(...all.map((p) => hourOf(p.start))) * 60,
    to: Math.ceil(Math.max(...all.map((p) => toMin(p.end))) / 60) * 60,
  }
}

/** The school day as blocks on a time line. Outdoor periods are ochre. */
export function DayStrip({
  periods,
  range,
  label,
  tall,
}: {
  periods: StripPeriod[]
  range: { from: number; to: number }
  label?: string
  tall?: boolean
}) {
  const span = range.to - range.from
  const valid = periods.filter((p) => /^\d\d:\d\d$/.test(p.start) && /^\d\d:\d\d$/.test(p.end) && p.end > p.start)
  return (
    <div className="flex items-center gap-3">
      {label && <span className="w-14 shrink-0 text-right text-xs font-semibold uppercase tracking-wide text-muted">{label}</span>}
      <div className={'relative min-w-0 flex-1 rounded-md bg-wash ' + (tall ? 'h-12' : 'h-9')}>
        {valid.map((p, i) => {
          const left = ((toMin(p.start) - range.from) / span) * 100
          const width = ((toMin(p.end) - toMin(p.start)) / span) * 100
          return (
            <div
              key={i}
              title={`${p.start}–${p.end} · ${p.subject || '—'}`}
              className={
                'absolute inset-y-1 flex items-center overflow-hidden rounded-[5px] px-1 text-[11px] font-medium leading-none ' +
                (p.ghost
                  ? 'border border-dashed border-outdoor/70 bg-transparent text-outdoor/80 '
                  : p.outdoor
                    ? 'bg-outdoor text-white '
                    : 'border border-line bg-surface text-ink ') +
                (p.highlight ? 'ring-2 ring-accent ring-offset-1 ring-offset-wash' : '')
              }
              style={{ left: `calc(${left}% + 1px)`, width: `calc(${width}% - 2px)` }}
            >
              <span className="truncate">{p.subject}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Hour cells coloured by CPCB band, aligned with DayStrip. */
export function AirRow({
  hours,
  range,
  label,
}: {
  hours: { hour: number; pm25: number }[]
  range: { from: number; to: number }
  label?: string
}) {
  const span = range.to - range.from
  const cells = hours.filter((h) => h.hour * 60 >= range.from && h.hour * 60 < range.to)
  return (
    <div className="flex items-end gap-3">
      {label && <span className="w-14 shrink-0 text-right text-xs font-semibold uppercase tracking-wide text-muted">{label}</span>}
      <div className="relative h-11 min-w-0 flex-1">
        {cells.map((h) => {
          const left = ((h.hour * 60 - range.from) / span) * 100
          const width = (60 / span) * 100
          return (
            <div
              key={h.hour}
              className="absolute inset-y-0 flex flex-col justify-end"
              style={{ left: `${left}%`, width: `${width}%` }}
            >
              <span className="num pb-0.5 text-center text-[11px] text-muted">{Math.round(h.pm25)}</span>
              <span className="mx-px block h-2.5 rounded-sm" style={{ background: bandFor(h.pm25).color }} />
              <span className="num absolute -bottom-4 left-0 text-[10px] text-muted">{String(h.hour).padStart(2, '0')}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
