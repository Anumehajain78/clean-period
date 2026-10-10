// CPCB National AQI (2014) PM2.5 categories, ug/m3 (24-hour average).
// Applied to hourly values this is an approximation; the Method tab says so.

export type BandKey = 'good' | 'satisfactory' | 'moderate' | 'poor' | 'verypoor' | 'severe'

export interface Band {
  key: BandKey
  max: number // inclusive upper edge
  color: string
}

export const BANDS: Band[] = [
  { key: 'good', max: 30, color: 'var(--color-aqi-good)' },
  { key: 'satisfactory', max: 60, color: 'var(--color-aqi-satisfactory)' },
  { key: 'moderate', max: 90, color: 'var(--color-aqi-moderate)' },
  { key: 'poor', max: 120, color: 'var(--color-aqi-poor)' },
  { key: 'verypoor', max: 250, color: 'var(--color-aqi-verypoor)' },
  { key: 'severe', max: Infinity, color: 'var(--color-aqi-severe)' },
]

/** "All indoors" line: top of Poor (CLAUDE.md, decided 2026-10-08). The plan response does not carry it. */
export const ALL_INDOORS_THRESHOLD = 120

export function bandFor(pm25: number): Band {
  return BANDS.find((b) => pm25 <= b.max) ?? BANDS[BANDS.length - 1]
}
