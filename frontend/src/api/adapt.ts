import type {
  Activity,
  BacktestVM,
  ClassTimetable,
  PlanRequest,
  PlanVM,
  RawPeriod,
  RawPlan,
  RowVM,
  SampleFile,
  School,
} from './types'
import { WEEKDAYS, isIndoors, placeOf, tomorrowWeekday, uid } from '../lib/format'

// ---------------------------------------------------------------- request

export function buildRequest(school: School, classes: ClassTimetable[]): PlanRequest {
  const used = classes.filter((c) => c.periods.length)
  const keys = new Map<string, { id: string; start: string; end: string }>()
  for (const c of used)
    for (const p of c.periods) {
      const k = p.start + '-' + p.end
      if (!keys.has(k)) keys.set(k, { id: '', start: p.start, end: p.end })
    }
  const slots = [...keys.values()]
    .sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end))
    .map((s, i) => ({ ...s, id: 's' + (i + 1) }))
  const slotId = (start: string, end: string) => slots.find((s) => s.start === start && s.end === end)!.id

  const cap = school.groundCapacity.trim()
  return {
    school: {
      latitude: Number(school.lat),
      longitude: Number(school.lng),
      timezone: school.timezone || 'Asia/Kolkata',
      ground_capacity: cap === '' ? null : Number(cap),
    },
    slots,
    classes: used.map((c) => ({
      id: c.id,
      name: c.name.trim() || 'Class',
      periods: c.periods.map((p) => ({
        slot: slotId(p.start, p.end),
        subject: p.subject.trim(),
        activity: p.activity,
        teacher: p.teacher.trim() || null,
        place: placeOf(p.activity),
        movable: p.movable && p.activity !== 'assembly' && p.activity !== 'recess',
      })),
    })),
  }
}

// --------------------------------------------------------------- response

export function toPlanVM(raw: RawPlan, req: PlanRequest): PlanVM {
  const pmByHour = new Map<number, number>()
  for (const h of raw.air?.hours ?? []) if (typeof h.pm25 === 'number') pmByHour.set(h.hour, h.pm25)
  const slotStart = new Map(req.slots.map((s) => [s.id, s.start]))

  let movedCount = 0
  const classes = raw.classes.map((c) => {
    const reqClass = req.classes.find((x) => x.id === c.id)
    const subjectFor = (p: RawPeriod) =>
      p.subject ?? reqClass?.periods.find((q) => q.slot === p.slot)?.subject ?? ''

    const row = (p: RawPeriod): RowVM => {
      const activity = (p.activity ?? reqClass?.periods.find((q) => q.slot === p.slot)?.activity ?? 'classroom') as Activity
      const converted = p.converted_from != null && p.converted_from !== false
      const hour = Number(p.start.split(':')[0])
      return {
        start: p.start,
        end: p.end,
        subject: subjectFor(p),
        activity,
        indoors: converted || isIndoors(activity),
        pm25: pmByHour.get(hour) ?? null,
        dose: p.dose_ug,
        madeIndoor: converted || undefined,
      }
    }

    const before = c.before.map(row)
    const after = c.after.map(row)
    for (const m of c.moves ?? []) {
      const toStart = slotStart.get(m.to_slot)
      const fromStart = slotStart.get(m.from_slot)
      const hit = after.find((r) => r.subject === m.subject && (toStart ? r.start === toStart : true) && !r.movedFrom)
      if (hit && fromStart) {
        hit.movedFrom = fromStart
        movedCount++
      }
    }
    return {
      name: c.name,
      before,
      after,
      doseBefore: c.before_ug,
      doseAfter: c.after_ug,
      cutPct: c.reduction_pct,
    }
  })

  return {
    date: raw.date,
    verdict: raw.verdict,
    movedCount,
    classes,
    totalCutPct: raw.reduction_pct,
    hours: [...pmByHour.entries()].map(([hour, pm25]) => ({ hour, pm25 })).sort((a, b) => a.hour - b.hour),
    airSource: raw.air?.source ?? '',
    categoryNote: raw.air?.category_note,
    assumptions: raw.assumptions ?? [],
    label: raw.label ?? '',
    raw,
  }
}

// ----------------------------------------------------------------- sample

/** Pick tomorrow's weekday if the sample has it, else the next weekday that has lessons. */
export function pickSampleDay(s: SampleFile): string | null {
  const have = new Set(s.classes.flatMap((c) => Object.keys(c.days)))
  const start = WEEKDAYS.indexOf(tomorrowWeekday())
  for (let i = 0; i < 7; i++) {
    const d = WEEKDAYS[(start + i) % 7]
    if (have.has(d)) return d
  }
  return null
}

export function sampleToDraft(s: SampleFile, day: string): { school: School; classes: ClassTimetable[] } {
  const slot = new Map(s.slots.map((x) => [x.id, x]))
  const classes: ClassTimetable[] = s.classes
    .map((c) => ({
      id: c.id || uid(),
      name: c.name,
      periods: (c.days[day] ?? []).flatMap((p) => {
        const sl = slot.get(p.slot)
        if (!sl) return []
        return [
          {
            id: uid(),
            start: sl.start,
            end: sl.end,
            subject: p.subject,
            activity: p.activity,
            teacher: p.teacher ?? '',
            movable: p.movable,
          },
        ]
      }),
    }))
    .filter((c) => c.periods.length)
  return {
    school: {
      name: s.school.name,
      lat: String(s.school.latitude),
      lng: String(s.school.longitude),
      timezone: s.school.timezone ?? 'Asia/Kolkata',
      groundCapacity: s.school.ground_capacity == null ? '' : String(s.school.ground_capacity),
    },
    classes,
  }
}

// --------------------------------------------------------------- backtest
// api.md only names the top-level keys of data/backtest_result.json
// (summary, days, skipped, hourly_profile, sources, assumptions, label), not
// the fields inside. These helpers look the numbers up by key name; if a key
// is not found the screen says so instead of showing a wrong number.

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)

function findNum(o: unknown, test: (key: string) => boolean): number | null {
  if (!isObj(o)) return null
  for (const [k, v] of Object.entries(o)) if (test(k.toLowerCase()) && typeof v === 'number') return v
  return null
}
const isCut = (k: string) => /(cut|reduction|saving|saved)/.test(k)
const isPct = (k: string) => /(pct|percent)/.test(k)

export function normalizeBacktest(raw: unknown): BacktestVM | null {
  if (!isObj(raw)) return null
  const summary = isObj(raw.summary) ? raw.summary : raw
  const season =
    findNum(summary, (k) => /season|total|overall|headline/.test(k) && isCut(k) && isPct(k)) ??
    findNum(summary, (k) => /season|total|overall|headline/.test(k) && isCut(k))
  if (season == null) return null
  const mean = findNum(summary, (k) => /(mean|average|avg)/.test(k) && isCut(k))
  const schoolDays = findNum(summary, (k) => /(school_days|n_days|num_days|days_count|^days$)/.test(k))

  const daysRaw = Array.isArray(raw.days) ? raw.days : []
  const days = daysRaw.flatMap((d) => {
    if (!isObj(d) || typeof d.date !== 'string') return []
    const cut =
      findNum(d, (k) => isCut(k) && isPct(k)) ?? findNum(d, (k) => isCut(k)) ?? findNum(d, (k) => k === 'pct')
    return cut == null ? [] : [{ date: d.date, cutPct: cut }]
  })
  const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
  return {
    seasonCutPct: season,
    meanDailyCutPct: mean,
    schoolDays: schoolDays ?? (days.length || null),
    from: days[0]?.date ?? null,
    to: days[days.length - 1]?.date ?? null,
    days,
    label: typeof raw.label === 'string' ? raw.label : undefined,
    assumptions: strings(raw.assumptions),
  }
}
