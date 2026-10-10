import { useCallback, useEffect, useMemo, useState } from 'react'
import { buildRequest, pickSampleDay, sampleToDraft, toPlanVM } from '../api/adapt'
import { api, ApiError, loadSample } from '../api/client'
import type { ClassTimetable, NoticeResponse, Period, PlanRequest, PlanVM, School } from '../api/types'
import type { Key } from '../i18n/strings'
import { FIXED_ACTIVITIES, uid } from '../lib/format'

const STORE = 'cp.draft.v2'

const emptySchool: School = { name: '', lat: '', lng: '', timezone: 'Asia/Kolkata', groundCapacity: '' }

export function newPeriod(start = '', end = '', activity: Period['activity'] = 'classroom'): Period {
  return { id: uid(), start, end, subject: '', activity, teacher: '', movable: true }
}

function newClass(n: number): ClassTimetable {
  return { id: uid(), name: `Class ${n}`, periods: [] }
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
  return { school: emptySchool, classes: [newClass(1)] }
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
  const [sampleDay, setSampleDay] = useState<string | null>(null)

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
    setSampleDay(null)
  }, [])

  const updateClass = useCallback((id: string, fn: (c: ClassTimetable) => ClassTimetable) => {
    setDraft((d) => ({ ...d, classes: d.classes.map((c) => (c.id === id ? fn(c) : c)) }))
    setSampleDay(null)
  }, [])

  const addClass = useCallback(() => {
    const c = newClass(draft.classes.length + 1)
    setDraft((d) => ({ ...d, classes: [...d.classes, c] }))
    setActiveId(c.id)
  }, [draft.classes.length])

  const removeClass = useCallback(
    (id: string) => {
      setDraft((d) => {
        if (d.classes.length < 2) return d
        const rest = d.classes.filter((c) => c.id !== id)
        if (id === activeId) setActiveId(rest[0].id)
        return { ...d, classes: rest }
      })
    },
    [activeId],
  )

  const loadSampleData = useCallback(async (): Promise<boolean> => {
    try {
      const s = await loadSample()
      const day = pickSampleDay(s)
      if (!day) return false
      const next = sampleToDraft(s, day)
      if (!next.classes.length) return false
      next.classes.forEach((c) =>
        c.periods.forEach((p) => {
          if (FIXED_ACTIVITIES.includes(p.activity)) p.movable = false
        }),
      )
      setDraft(next)
      setActiveId(next.classes[0].id)
      setPlan(null)
      setNotice(null)
      setSampleDay(day)
      return true
    } catch {
      return false
    }
  }, [])

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
    loadSampleData,
    sampleDay,
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
