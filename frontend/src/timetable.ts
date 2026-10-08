// Pure helpers to edit a timetable. Every function returns a new object.
import type { StringKey } from './i18n/strings'
import type { Period, Slot, Timetable, TimetableClass } from './types'

export const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

export const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
export const fromMin = (n: number) =>
  `${String(Math.floor(n / 60) % 24).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`

export const sortedSlots = (slots: Slot[]) => [...slots].sort((a, b) => toMin(a.start) - toMin(b.start))

function uniqueId(prefix: string, taken: Iterable<string>) {
  const used = new Set(taken)
  let i = 1
  while (used.has(`${prefix}${i}`)) i++
  return `${prefix}${i}`
}

export function schoolDays(tt: Timetable): string[] {
  const days = new Set(tt.classes.flatMap((c) => Object.keys(c.days)))
  const ordered = WEEKDAYS.filter((d) => days.has(d))
  return ordered.length ? ordered : WEEKDAYS.slice(0, 5)
}

// --- slots ------------------------------------------------------------------

export function addSlot(tt: Timetable): Timetable {
  const last = sortedSlots(tt.slots).at(-1)
  const start = last ? last.end : '08:00'
  const slot = { id: uniqueId('s', tt.slots.map((s) => s.id)), start, end: fromMin(toMin(start) + 40) }
  return { ...tt, slots: [...tt.slots, slot] }
}

export function updateSlot(tt: Timetable, id: string, patch: Partial<Omit<Slot, 'id'>>): Timetable {
  return { ...tt, slots: tt.slots.map((s) => (s.id === id ? { ...s, ...patch } : s)) }
}

export function removeSlot(tt: Timetable, id: string): Timetable {
  return {
    ...tt,
    slots: tt.slots.filter((s) => s.id !== id),
    classes: tt.classes.map((c) => ({
      ...c,
      days: Object.fromEntries(Object.entries(c.days).map(([d, ps]) => [d, ps.filter((p) => p.slot !== id)])),
    })),
  }
}

// --- classes ----------------------------------------------------------------

export function addClass(tt: Timetable): Timetable {
  const cls: TimetableClass = {
    id: uniqueId('c', tt.classes.map((c) => c.id)),
    name: '',
    days: Object.fromEntries(schoolDays(tt).map((d) => [d, []])),
  }
  return { ...tt, classes: [...tt.classes, cls] }
}

export function updateClass(tt: Timetable, ci: number, patch: Partial<Pick<TimetableClass, 'name'>>): Timetable {
  return { ...tt, classes: tt.classes.map((c, i) => (i === ci ? { ...c, ...patch } : c)) }
}

export function removeClass(tt: Timetable, ci: number): Timetable {
  return { ...tt, classes: tt.classes.filter((_, i) => i !== ci) }
}

// --- periods ----------------------------------------------------------------

function mapDay(tt: Timetable, ci: number, day: string, fn: (ps: Period[]) => Period[]): Timetable {
  return {
    ...tt,
    classes: tt.classes.map((c, i) => (i === ci ? { ...c, days: { ...c.days, [day]: fn(c.days[day] ?? []) } } : c)),
  }
}

export const newPeriod = (slot: string): Period => ({
  slot, subject: '', activity: 'classroom', teacher: null, place: 'classroom', movable: true,
})

export const addPeriod = (tt: Timetable, ci: number, day: string, slot: string) =>
  mapDay(tt, ci, day, (ps) => [...ps, newPeriod(slot)])

export const updatePeriod = (tt: Timetable, ci: number, day: string, slot: string, patch: Partial<Period>) =>
  mapDay(tt, ci, day, (ps) => ps.map((p) => (p.slot === slot ? { ...p, ...patch } : p)))

export const removePeriod = (tt: Timetable, ci: number, day: string, slot: string) =>
  mapDay(tt, ci, day, (ps) => ps.filter((p) => p.slot !== slot))

// --- checks before planning -------------------------------------------------

export interface Problem {
  key: StringKey
  detail?: string
}

export function problems(tt: Timetable, day: string): Problem[] {
  const out: Problem[] = []
  const { latitude, longitude } = tt.school
  if (latitude === null || longitude === null || Number.isNaN(latitude) || Number.isNaN(longitude)) {
    out.push({ key: 'needLocation' })
  }
  if (tt.classes.length === 0) out.push({ key: 'needClass' })

  const slots = sortedSlots(tt.slots)
  for (const s of slots) {
    if (!s.start || !s.end || toMin(s.end) <= toMin(s.start)) out.push({ key: 'slotEndsBeforeStart', detail: `${s.start}–${s.end}` })
  }
  for (let i = 1; i < slots.length; i++) {
    if (toMin(slots[i].start) < toMin(slots[i - 1].end)) {
      out.push({ key: 'slotsOverlap', detail: `${slots[i - 1].start}–${slots[i - 1].end} / ${slots[i].start}–${slots[i].end}` })
    }
  }

  const byId = Object.fromEntries(tt.slots.map((s) => [s.id, s]))
  tt.classes.forEach((c) => {
    if (!c.name.trim()) out.push({ key: 'needClassName' })
    for (const p of c.days[day] ?? []) {
      if (!p.subject.trim()) out.push({ key: 'needSubject', detail: `${c.name || '?'} ${byId[p.slot]?.start ?? ''}` })
    }
  })
  return out
}

export const emptyTimetable = (): Timetable => ({
  school: { name: '', latitude: null, longitude: null, timezone: 'Asia/Kolkata', ground_capacity: null },
  slots: [],
  classes: [],
})
