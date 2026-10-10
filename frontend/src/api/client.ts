import type { NoticeResponse, PlanRequest, RawPlan, SampleFile } from './types'

// In `npm run dev`, calls go to /api on the dev server, which forwards them to
// VITE_API_URL (see vite.config.ts). That avoids the browser CORS block on
// localhost. In a production build the API URL is called directly.
const ENV_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')
const BASE = import.meta.env.DEV ? (ENV_URL ? '/api' : '') : ENV_URL

export class ApiError extends Error {
  constructor(
    message: string,
    public kind: 'no_url' | 'network' | 'http',
    public status?: number,
    public detail?: string,
  ) {
    super(message)
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!BASE) throw new ApiError('VITE_API_URL is not set', 'no_url')
  let res: Response
  try {
    res = await fetch(BASE + path, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    })
  } catch {
    throw new ApiError('Network error', 'network')
  }
  if (!res.ok) {
    let detail: string | undefined
    try {
      const body = (await res.json()) as { error?: string }
      detail = body.error
    } catch {
      /* body was not JSON */
    }
    throw new ApiError(`HTTP ${res.status}`, 'http', res.status, detail)
  }
  return (await res.json()) as T
}

export const api = {
  plan: (body: PlanRequest) =>
    request<RawPlan>('/plan', { method: 'POST', body: JSON.stringify(body) }),
  notice: (plan: RawPlan, schoolName: string) =>
    request<NoticeResponse>('/notice', {
      method: 'POST',
      body: JSON.stringify({ plan, school_name: schoolName, use_ai: true }),
    }),
}

/** Static files published with the site (copied from /data at build time). */
export async function loadStatic<T>(file: string): Promise<T> {
  const res = await fetch('/' + file)
  const type = res.headers.get('content-type') ?? ''
  if (!res.ok || !type.includes('json')) throw new ApiError('Missing ' + file, 'http', res.status)
  return (await res.json()) as T
}

export const loadSample = () => loadStatic<SampleFile>('sample_timetable.json')
