import type { Activity } from './types'

export const OUTDOOR: ReadonlySet<Activity> = new Set(['assembly', 'recess', 'pe'])

// CPCB AQI category colours.
export const categoryClass: Record<string, string> = {
  Good: 'bg-green-700 text-white',
  Satisfactory: 'bg-lime-400 text-stone-900',
  Moderate: 'bg-yellow-300 text-stone-900',
  Poor: 'bg-orange-500 text-white',
  'Very Poor': 'bg-red-600 text-white',
  Severe: 'bg-red-900 text-white',
}

export const pct = (n: number) => `${n.toFixed(1)}%`
export const ug = (n: number) => `${n.toFixed(0)} µg`
export const hh = (h: number) => `${String(h).padStart(2, '0')}:00`

export function tomorrowWeekday(now = new Date()): string {
  const d = new Date(now)
  d.setDate(d.getDate() + 1)
  return d.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
}
