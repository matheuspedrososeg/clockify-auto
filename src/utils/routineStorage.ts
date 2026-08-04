import { isValidTime, minutesBetween } from './dates'

export interface Routine {
  checkIn: string
  lunchOut: string
  lunchIn: string
  checkOut: string
  /** 0 = Sunday ... 6 = Saturday */
  workDays: number[]
}

const ROUTINE_KEY = 'work_routine'

const TIME_FIELDS = ['checkIn', 'lunchOut', 'lunchIn', 'checkOut'] as const

export const DEFAULT_ROUTINE: Routine = {
  checkIn: '08:00',
  lunchOut: '12:00',
  lunchIn: '13:00',
  checkOut: '17:00',
  workDays: [1, 2, 3, 4, 5],
}

function cleanRoutine(raw: Partial<Routine> | null | undefined): Routine {
  const clean = { ...DEFAULT_ROUTINE }

  for (const field of TIME_FIELDS) {
    const value = String(raw?.[field] ?? '')
    if (isValidTime(value)) clean[field] = value
  }

  if (Array.isArray(raw?.workDays)) {
    const days = [...new Set(raw.workDays.map(Number))]
      .filter(day => Number.isInteger(day) && day >= 0 && day <= 6)
      .sort((a, b) => a - b)
    clean.workDays = days
  }

  return clean
}

export function readRoutine(): Routine {
  try {
    const raw = localStorage.getItem(ROUTINE_KEY)
    if (!raw) return { ...DEFAULT_ROUTINE }
    return cleanRoutine(JSON.parse(raw) as Partial<Routine>)
  } catch {
    return { ...DEFAULT_ROUTINE }
  }
}

export function writeRoutine(routine: Routine): void {
  localStorage.setItem(ROUTINE_KEY, JSON.stringify(cleanRoutine(routine)))
}

export function routineWorkloadMinutes(routine: Routine): number {
  const morning = minutesBetween(routine.checkIn, routine.lunchOut)
  const afternoon = minutesBetween(routine.lunchIn, routine.checkOut)
  return Math.max(0, morning) + Math.max(0, afternoon)
}
