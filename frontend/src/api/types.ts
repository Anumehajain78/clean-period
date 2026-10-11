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
  place?: string // town picked in the search, shown instead of raw coordinates
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
  cancelled?: boolean
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
  /** Only on all-indoors days: cancel the outdoor activity instead of moving it indoors. */
  alternatives?: {
    cancel: {
      classes: { id: string; after: RawPeriod[]; after_ug: number; reduction_pct: number }[]
      total_after_ug: number
      reduction_pct: number
    }
  }
  /** Set by the site when the school picks the cancel option. */
  choice?: BadDayChoice
}

export type BadDayChoice = 'indoors' | 'cancel'

export type NoMoveReason = 'noOutdoor' | 'outdoorFixed' | 'noPartner' | 'alreadyBest'

// ---- POST /notice ---------------------------------------------------------

export interface NoticeResponse {
  en: string
  hi: string
  source: 'ai' | 'template'
  model?: string
  fallback_reason?: string
  label?: string
}

// ---- POST /extract ----------------------------------------------------------

export interface ExtractedPeriod {
  start: string
  end: string
  subject: string
  activity: Activity
  teacher: string
}

export interface ExtractResponse {
  class_name: string
  days: Record<string, ExtractedPeriod[]>
  dropped: number
  note: string
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
  cancelled?: boolean
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
  /** Why nothing moved, when nothing did. */
  noMoveReason?: NoMoveReason
  /** All-indoors days only: both options' estimated cuts and the one shown. */
  badDay?: { choice: BadDayChoice; indoorsPct: number; cancelPct: number }
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

// ---- POST /outlook and POST /backtest ---------------------------------------

export interface OutlookDay {
  date: string
  weekday: string
  status: 'planned' | 'no_forecast'
  verdict?: 'reorder' | 'all_indoors'
  reduction_pct?: number
  moved?: number
  school_mean_pm25?: number
  school_max_pm25?: number
  category?: string
  hours?: { hour: number; pm25: number }[]
  cleanest?: boolean
}

export interface OutlookResponse {
  days: OutlookDay[]
  source: string
  category_note?: string
  label: string
  label_hi: string
}

export interface WinterResponse {
  summary: { school_days: number; all_indoors_days: number; season_reduction_pct: number; mean_daily_reduction_pct: number }
  days: { date: string; reduction_pct: number; verdict: string }[]
  skipped: number
  period: { start: string; end: string }
  source: string
  grid_point: { latitude: number; longitude: number }
  assumptions: string[]
  assumptions_hi: string[]
  label: string
  label_hi: string
}
