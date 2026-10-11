import type {
  Activity,
  BadDayChoice,
  NoMoveReason,
  ClassTimetable,
  PlanRequest,
  PlanVM,
  RawPeriod,
  RawPlan,
  RowVM,
  School,
} from './types'
import { isIndoors, minutesBetween, placeOf } from '../lib/format'

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

/** Why a plan moved nothing: the first rule that stopped the outdoor periods. */
export function noMoveReason(req: PlanRequest): NoMoveReason {
  const len = new Map(req.slots.map((s) => [s.id, minutesBetween(s.start, s.end)]))
  let outdoor = 0
  let movableOutdoor = 0
  for (const c of req.classes) {
    for (const p of c.periods.filter((x) => x.activity === 'pe')) {
      outdoor++
      if (!p.movable) continue
      movableOutdoor++
      const partner = c.periods.some(
        (q) => q !== p && q.movable && q.activity !== p.activity && len.get(q.slot) === len.get(p.slot),
      )
      if (partner) return 'alreadyBest'
    }
  }
  if (outdoor === 0) return 'noOutdoor'
  if (movableOutdoor === 0) return 'outdoorFixed'
  return 'noPartner'
}

/** The plan as the school chose it: on all-indoors days, optionally cancel outdoor activity. */
export function applyChoice(raw: RawPlan, choice: BadDayChoice): RawPlan {
  const alt = raw.alternatives?.cancel
  if (raw.verdict !== 'all_indoors' || !alt || choice !== 'cancel') return { ...raw, choice: 'indoors' }
  const byId = new Map(alt.classes.map((c) => [c.id, c]))
  return {
    ...raw,
    classes: raw.classes.map((c) => {
      const a = byId.get(c.id)
      return a ? { ...c, after: a.after, after_ug: a.after_ug, reduction_pct: a.reduction_pct } : c
    }),
    total_after_ug: alt.total_after_ug,
    reduction_pct: alt.reduction_pct,
    choice: 'cancel',
  }
}

export function toPlanVM(raw: RawPlan, req: PlanRequest, indoorsPct?: number): PlanVM {
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
        madeIndoor: (converted && !p.cancelled) || undefined,
        cancelled: p.cancelled || undefined,
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
    noMoveReason: raw.verdict === 'reorder' && movedCount === 0 ? noMoveReason(req) : undefined,
    badDay:
      raw.verdict === 'all_indoors' && raw.alternatives
        ? { choice: raw.choice ?? 'indoors', indoorsPct: indoorsPct ?? raw.reduction_pct, cancelPct: raw.alternatives.cancel.reduction_pct }
        : undefined,
  }
}
