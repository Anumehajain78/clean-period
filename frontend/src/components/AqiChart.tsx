interface HourPm {
  hour: number
  pm25: number
}
import { useLang } from '../i18n/lang'
import { bandFor } from '../lib/aqi'

/** Hourly PM2.5 bars coloured by CPCB band, with the all-indoors line. */
export function AqiChart({
  hourly,
  fromHour,
  toHour,
  threshold,
}: {
  hourly: HourPm[]
  fromHour: number
  toHour: number
  threshold: number
}) {
  const { t } = useLang()
  const rows = hourly.filter((h) => h.hour >= fromHour && h.hour <= toHour)
  if (rows.length === 0) return null

  const W = 360
  const H = 112
  const padL = 4
  const padR = 4
  const padT = 14
  const padB = 18
  const max = Math.max(threshold * 1.15, ...rows.map((r) => r.pm25))
  const bw = (W - padL - padR) / rows.length
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / max)

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={t('hourlyPm')}
      className="block w-full"
      style={{ maxHeight: 130 }}
    >
      {rows.map((r, i) => {
        const x = padL + i * bw
        const top = y(r.pm25)
        return (
          <g key={r.hour}>
            <rect x={x + 1.5} y={top} width={Math.max(bw - 3, 1)} height={H - padB - top} fill={bandFor(r.pm25).color}>
              <title>{`${String(r.hour).padStart(2, '0')}:00 · ${Math.round(r.pm25)} µg/m³`}</title>
            </rect>
            {(i % 2 === 0 || rows.length < 9) && (
              <text x={x + bw / 2} y={H - 5} textAnchor="middle" fontSize="9" fill="var(--color-muted)" className="num">
                {r.hour}
              </text>
            )}
          </g>
        )
      })}
      <line
        x1={padL}
        x2={W - padR}
        y1={y(threshold)}
        y2={y(threshold)}
        stroke="var(--color-ink)"
        strokeWidth="1"
        strokeDasharray="4 3"
      />
      <text x={W - padR} y={y(threshold) - 3} textAnchor="end" fontSize="9" fill="var(--color-ink)">
        {t('thresholdLabel', { n: threshold })}
      </text>
    </svg>
  )
}
