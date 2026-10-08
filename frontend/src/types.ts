// Shapes from docs/api.md and data/sample_timetable.json.

export type Activity = 'classroom' | 'assembly' | 'recess' | 'pe' | 'indoor_activity'

export interface Slot {
  id: string
  start: string
  end: string
}

export interface Period {
  slot: string
  subject: string
  activity: Activity
  teacher: string | null
  place: 'classroom' | 'ground'
  movable: boolean
}

export interface School {
  name: string
  address?: string
  latitude: number
  longitude: number
  timezone: string
  ground_capacity: number | null
}

export interface TimetableClass {
  id: string
  name: string
  days: Record<string, Period[]>
}

export interface Timetable {
  _note?: string
  school: School
  slots: Slot[]
  classes: TimetableClass[]
}

export interface PlanRequest {
  school: School
  slots: Slot[]
  classes: { id: string; name: string; periods: Period[] }[]
  date?: string
}

export interface PlannedPeriod extends Period {
  start: string
  end: string
  dose_ug: number
  converted_from?: Activity
}

export interface ClassPlan {
  id: string
  name: string
  before: PlannedPeriod[]
  after: PlannedPeriod[]
  before_ug: number
  after_ug: number
  reduction_pct: number
  moves: { subject: string; from_slot: string; to_slot: string }[]
}

export interface PlanResponse {
  date: string
  verdict: 'reorder' | 'all_indoors'
  classes: ClassPlan[]
  total_before_ug: number
  total_after_ug: number
  reduction_pct: number
  air: {
    hours: { hour: number; pm25: number | null; category: string | null }[]
    unit: string
    source: string
    grid_point: { latitude: number; longitude: number }
    fetched_at: string
    cached: boolean
    category_source: string
    category_note: string
  }
  assumptions: string[]
  label: string
}

export interface BacktestResult {
  school: School
  period: { start: string; end: string }
  inputs: { timetable_note: string }
  sources: {
    air_quality: string
    air_quality_note: string
    inhalation_rates: string
    pm25_categories: string
    closures: { reason: string; source: string }[]
  }
  assumptions: string[]
  label: string
  summary: {
    school_days: number
    all_indoors_days: number
    season_reduction_pct: number
    mean_daily_reduction_pct: number
    by_weekday: Record<string, { days: number; mean_reduction_pct: number }>
  }
  hourly_profile: { hour: number; median_pm25: number; days: number }[]
}
