// Shapes follow docs/api.md. Fields api.md does not spell out are optional here
// and handled in adapt.ts.

export type Activity = 'classroom' | 'assembly' | 'recess' | 'pe' | 'indoor_activity'
export type Place = 'classroom' | 'ground'

// ---- What the person edits ------------------------------------------------

export interface Period {
  id: string
  start: string // "HH:MM"
  end: string // "HH:MM"
  subject: string
  activity: Activity
  teacher: string
  movable: boolean
}

export interface ClassTimetable {
  id: string
  name: string
  periods: Period[]
}

export interface School {
  name: string
  lat: string // text while typing
  lng: string
  timezone: string
  groundCapacity: string // blank = no limit
}

// ---- POST /plan request ---------------------------------------------------

export interface PlanRequest {
  school: { latitude: number; longitude: number; timezone: string; ground_capacity: number | null }
  slots: { id: string; start: string; end: string }[]
  classes: {
    id: string
    name: string
    periods: {
      slot: string
      subject: string
      activity: Activity
      teacher: string | null
      place: Place
      movable: boolean
    }[]
  }[]
  date?: string
}

// ---- POST /plan response (raw) -------------------------------------------

export interface RawPeriod {
  slot?: string
  subject?: string
  activity?: Activity
  teacher?: string | null
  place?: Place
  start: string
  end: string
  dose_ug: number
  converted_from?: unknown
}

export interface RawClassPlan {
  id: string
  name: string
  before: RawPeriod[]
  after: RawPeriod[]
  before_ug: number
  after_ug: number
  reduction_pct: number
  moves?: { subject: string; from_slot: string; to_slot: string }[]
}

export interface RawPlan {
  date: string
  verdict: 'reorder' | 'all_indoors'
  classes: RawClassPlan[]
  total_before_ug: number
  total_after_ug: number
  reduction_pct: number
  air: {
    hours: { hour: number; pm25: number | null; category?: string }[]
    unit?: string
    source?: string
    category_source?: string
    category_note?: string
  }
  assumptions?: string[]
  label?: string
}

// ---- POST /notice ---------------------------------------------------------

export interface NoticeResponse {
  en: string
  hi: string
  source: 'ai' | 'template'
  model?: string
  fallback_reason?: string
  label?: string
}

// ---- Static data files ----------------------------------------------------

export interface SampleFile {
  school: {
    name: string
    latitude: number
    longitude: number
    timezone?: string
    ground_capacity?: number | null
  }
  slots: { id: string; start: string; end: string }[]
  classes: {
    id: string
    name: string
    days: Record<
      string,
      {
        slot: string
        subject: string
        activity: Activity
        teacher: string | null
        place: Place
        movable: boolean
      }[]
    >
  }[]
}

// ---- What the screens use -------------------------------------------------

export interface RowVM {
  start: string
  end: string
  subject: string
  activity: Activity
  indoors: boolean
  pm25: number | null
  dose: number
  movedFrom?: string
  madeIndoor?: boolean
}

export interface ClassVM {
  name: string
  before: RowVM[]
  after: RowVM[]
  doseBefore: number
  doseAfter: number
  cutPct: number
}

export interface PlanVM {
  date: string
  verdict: 'reorder' | 'all_indoors'
  movedCount: number
  classes: ClassVM[]
  totalCutPct: number
  hours: { hour: number; pm25: number }[]
  airSource: string
  categoryNote?: string
  assumptions: string[]
  label: string
  raw: RawPlan
}

export interface BacktestVM {
  seasonCutPct: number
  meanDailyCutPct: number | null
  schoolDays: number | null
  from: string | null
  to: string | null
  days: { date: string; cutPct: number }[]
  label?: string
  assumptions: string[]
}
