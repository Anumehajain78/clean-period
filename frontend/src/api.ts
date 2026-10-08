import type { NightlyResult, NoticeResponse, PlanRequest, PlanResponse, SavedSchool, Timetable } from './types'

const BASE = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '')

async function call<T>(method: string, path: string, payload?: unknown, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: payload === undefined ? headers : { 'content-type': 'application/json', ...headers },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  })
  const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`)
  return body as T
}

const post = <T>(path: string, payload: unknown) => call<T>('POST', path, payload)

export const makePlan = (req: PlanRequest) => post<PlanResponse>('/plan', req)

export const makeNotice = (plan: PlanResponse, schoolName: string) =>
  post<NoticeResponse>('/notice', { plan, school_name: schoolName })

export const saveSchool = (timetable: Timetable) => post<SavedSchool>('/schools', { timetable })

export const updateSchool = (saved: SavedSchool, timetable: Timetable) =>
  call<{ id: string }>('PUT', `/schools/${encodeURIComponent(saved.id)}`, { timetable }, { 'x-edit-key': saved.edit_key })

export const latestNightly = (id: string) =>
  call<NightlyResult>('GET', `/schools/${encodeURIComponent(id)}/plans/latest`)
