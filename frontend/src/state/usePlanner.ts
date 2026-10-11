import { useCallback, useEffect, useMemo, useState } from 'react'
import { buildRequest, toPlanVM } from '../api/adapt'
import { api, ApiError } from '../api/client'
import type { ClassTimetable, ExtractedPeriod, NoticeResponse, Period, PlanRequest, PlanVM, School } from '../api/types'
import type { Key } from '../i18n/strings'
import { FIXED_ACTIVITIES, buildDay, type DayShape, uid } from '../lib/format'

// v3: drafts from the sample-timetable era are not reused.
const STORE = 'cp.draft.v3'

const emptySchool: School = { name: '', place: '', lat: '', lng: '', timezone: 'Asia/Kolkata', groundCapacity: '' }

export function newPeriod(start = '', end = '', activity: Period['activity'] = 'classroom'): Period {
  return { id: uid(), start, end, subject: '', activity, teacher: '', movable: !FIXED_ACTIVITIES.includes(activity) }
}

function newClass(): ClassTimetable {
  return { id: uid(), name: '', periods: [] }
}

interface Draft {
  school: School
  classes: ClassTimetable[]
}

function readDraft(): Draft {
  try {
    const raw = localStorage.getItem(STORE)
    if (raw) {
      const d = JSON.parse(raw) as Draft
      if (d.school && Array.isArray(d.classes) && d.classes.length) return d
    }
  } catch {
    /* ignore */
  }
  return { school: emptySchool, classes: [newClass()] }
}

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))

/** True when two periods of the same class share any minute. */
function overlaps(periods: Period[]): boolean {
  const ok = periods.filter((p) => p.start && p.end && p.end > p.start).sort((a, b) => a.start.localeCompare(b.start))
  return ok.some((p, i) => i > 0 && toMin(p.start) < toMin(ok[i - 1].end))
}

export interface PlanError {
  key: Key
  detail?: string
}

export function usePlanner() {
  const [draft, setDraft] = useState<Draft>(readDraft)
  const [activeId, setActiveId] = useState<string>(() => draft.classes[0].id)
  const [plan, setPlan] = useState<PlanVM | null>(null)
  const [planning, setPlanning] = useState(false)
  const [error, setError] = useState<PlanError | null>(null)
  const [notice, setNotice] = useState<NoticeResponse | null>(null)
  const [noticeState, setNoticeState] = useState<'idle' | 'loading' | 'error'>('idle')

  const { school, classes } = draft

  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify(draft))
    } catch {
      /* ignore */
    }
  }, [draft])

  const active = classes.find((c) => c.id === activeId) ?? classes[0]

  const setSchool = useCallback((patch: Partial<School>) => {
    setDraft((d) => ({ ...d, school: { ...d.school, ...patch } }))
  }, [])

  const updateClass = useCallback((id: string, fn: (c: ClassTimetable) => ClassTimetable) => {
    setDraft((d) => ({ ...d, classes: d.classes.map((c) => (c.id === id ? fn(c) : c)) }))
  }, [])

  /** New class with the same bell times as the first class that has periods; subjects left blank. */
  const addClass = useCallback(() => {
    const c = newClass()
    setDraft((d) => {
      const template = d.classes.find((x) => x.periods.length)
      if (template)
        c.periods = template.periods.map((p) =>
          FIXED_ACTIVITIES.includes(p.activity)
            ? { ...newPeriod(p.start, p.end, p.activity), subject: p.subject }
            : newPeriod(p.start, p.end),
        )
      return { ...d, classes: [...d.classes, c] }
    })
    setActiveId(c.id)
  }, [])

  const removeClass = useCallback(
    (id: string) => {
      setDraft((d) => {
        if (d.classes.length < 2) return { ...d, classes: [newClass()] }
        const rest = d.classes.filter((c) => c.id !== id)
        if (id === activeId) setActiveId(rest[0].id)
        return { ...d, classes: rest }
      })
    },
    [activeId],
  )

  /** Replace a class's periods with a generated school day. */
  const fillDay = useCallback(
    (id: string, shape: DayShape) =>
      updateClass(id, (c) => ({
        ...c,
        periods: buildDay(shape).map((r) =>
          r.isBreak ? { ...newPeriod(r.start, r.end, 'recess'), subject: 'Recess' } : newPeriod(r.start, r.end),
        ),
      })),
    [updateClass],
  )

  /** Use rows read from a photo for a class. */
  const applyReading = useCallback(
    (id: string, rows: ExtractedPeriod[], className: string) =>
      updateClass(id, (c) => ({
        ...c,
        name: c.name.trim() || className,
        periods: rows.map((r) => ({
          id: uid(),
          start: r.start,
          end: r.end,
          subject: r.subject,
          activity: r.activity,
          teacher: r.teacher,
          movable: !FIXED_ACTIVITIES.includes(r.activity),
        })),
      })),
    [updateClass],
  )

  const lat = Number(school.lat)
  const lng = Number(school.lng)
  const cap = school.groundCapacity.trim()

  /** First problem that blocks planning, as a string key, or null. */
  const blocker: Key | null = useMemo(() => {
    if (school.lat.trim() === '' || school.lng.trim() === '' || !(Math.abs(lat) <= 90) || !(Math.abs(lng) <= 180))
      return 'needLocation'
    if (cap !== '' && !(Number(cap) >= 1 && Number.isInteger(Number(cap)))) return 'needCapacity'
    const all = classes.flatMap((c) => c.periods)
    if (all.length === 0) return 'needPeriods'
    if (all.some((p) => !p.start || !p.end || p.end <= p.start || !p.subject.trim())) return 'needPeriodFields'
    if (classes.some((c) => overlaps(c.periods))) return 'needNoOverlap'
    return null
  }, [school, classes, lat, lng, cap])

  const [lastReq, setLastReq] = useState<PlanRequest | null>(null)

  const makePlan = useCallback(async (): Promise<boolean> => {
    if (blocker) return false
    setPlanning(true)
    setError(null)
    setNotice(null)
    setNoticeState('idle')
    const req = buildRequest(school, classes)
    try {
      const raw = await api.plan(req)
      setLastReq(req)
      setPlan(toPlanVM(raw, req))
      return true
    } catch (e) {
      if (e instanceof ApiError) {
        setError({
          key: e.kind === 'no_url' ? 'errNoUrl' : e.kind === 'network' ? 'errNetwork' : 'errHttp',
          detail: e.detail,
        })
      } else {
        setError({ key: 'errHttp' }) // response did not have the expected shape
      }
      return false
    } finally {
      setPlanning(false)
    }
  }, [blocker, school, classes])

  const loadNotice = useCallback(async () => {
    if (!plan || noticeState === 'loading') return
    setNoticeState('loading')
    try {
      setNotice(await api.notice(plan.raw, school.name.trim()))
      setNoticeState('idle')
    } catch {
      setNoticeState('error')
    }
  }, [plan, noticeState, school.name])

  return {
    school,
    classes,
    active,
    setActiveId,
    setSchool,
    updateClass,
    addClass,
    removeClass,
    fillDay,
    applyReading,
    blocker,
    plan,
    lastReq,
    planning,
    error,
    makePlan,
    notice,
    noticeState,
    loadNotice,
  }
}

export type Planner = ReturnType<typeof usePlanner>
