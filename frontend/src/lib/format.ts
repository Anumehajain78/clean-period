import type { Activity, Place } from '../api/types'

export const FIXED_ACTIVITIES: Activity[] = ['assembly', 'recess']
export const ACTIVITIES: Activity[] = ['classroom', 'pe', 'indoor_activity', 'assembly', 'recess']

export function placeOf(a: Activity): Place {
  return a === 'classroom' || a === 'indoor_activity' ? 'classroom' : 'ground'
}

export function isIndoors(a: Activity): boolean {
  return a === 'classroom' || a === 'indoor_activity'
}

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function minutesBetween(a: string, b: string): number {
  return toMin(b) - toMin(a)
}

export function addMinutes(hhmm: string, minutes: number): string {
  const total = toMin(hhmm) + minutes
  const hh = Math.floor(total / 60) % 24
  return `${String(hh).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export function hourOf(hhmm: string): number {
  return Number(hhmm.split(':')[0])
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

const loc = (lang: 'en' | 'hi') => (lang === 'hi' ? 'hi-IN' : 'en-IN')

export function tomorrow(lang: 'en' | 'hi'): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toLocaleDateString(loc(lang), {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Kolkata',
  })
}

export function formatDate(iso: string, lang: 'en' | 'hi'): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString(loc(lang), { weekday: 'long', day: 'numeric', month: 'short' })
}

export const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

/** Weekday name (lowercase English) of tomorrow in India. */
export function tomorrowWeekday(): string {
  const name = new Date(Date.now() + 86400000)
    .toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Asia/Kolkata' })
    .toLowerCase()
  return name
}

export function weekdayLabel(day: string, lang: 'en' | 'hi'): string {
  const i = WEEKDAYS.indexOf(day)
  if (i < 0) return day
  // 2026-10-04 is a Sunday
  const d = new Date(Date.UTC(2026, 9, 4 + i))
  return d.toLocaleDateString(loc(lang), { weekday: 'long', timeZone: 'UTC' })
}

export function fmtNum(n: number, digits = 0): string {
  return n.toLocaleString('en-IN', { maximumFractionDigits: digits, minimumFractionDigits: digits })
}
