// Keeps the teacher's timetable in this browser only. Storage can be missing or blocked.
import type { SavedSchool, Timetable } from './types'

const KEY = 'clean-period:timetable:v1'

export function loadTimetable(): Timetable | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const tt = JSON.parse(raw)
    if (tt && typeof tt.school === 'object' && Array.isArray(tt.slots) && Array.isArray(tt.classes)) return tt
  } catch {
    // ignore: start from the sample
  }
  return null
}

export function saveTimetable(tt: Timetable) {
  try {
    localStorage.setItem(KEY, JSON.stringify(tt))
  } catch {
    // ignore: the app works without saving
  }
}

const SAVED_KEY = 'clean-period:saved-school:v1'

export function loadSaved(): SavedSchool | null {
  try {
    const s = JSON.parse(localStorage.getItem(SAVED_KEY) ?? 'null')
    return s && typeof s.id === 'string' && typeof s.edit_key === 'string' ? s : null
  } catch {
    return null
  }
}

export function storeSaved(saved: SavedSchool | null) {
  try {
    if (saved) localStorage.setItem(SAVED_KEY, JSON.stringify(saved))
    else localStorage.removeItem(SAVED_KEY)
  } catch {
    // ignore
  }
}
