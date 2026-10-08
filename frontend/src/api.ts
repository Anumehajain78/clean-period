import type { NoticeResponse, PlanRequest, PlanResponse } from './types'

const BASE = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '')

async function post<T>(path: string, payload: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`)
  return body as T
}

export const makePlan = (req: PlanRequest) => post<PlanResponse>('/plan', req)

export const makeNotice = (plan: PlanResponse, schoolName: string) =>
  post<NoticeResponse>('/notice', { plan, school_name: schoolName })
