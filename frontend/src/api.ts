import type { PlanRequest, PlanResponse } from './types'

const BASE = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '')

export async function makePlan(req: PlanRequest): Promise<PlanResponse> {
  const res = await fetch(`${BASE}/plan`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(req),
  })
  const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`)
  return body as PlanResponse
}
