import type { TimeSheetRow } from '../types/timesheet'
import type { ClockifyEntry } from './clockifyApi'
import type { IsoDate } from './dates'
import { toIsoDate, toUtcInstant, weekDay } from './dates'
import { rowCheckOut, rowState, rowWorkedMinutes } from './timesheet'
import type { Routine } from './routineStorage'
import { routineWorkloadMinutes } from './routineStorage'

export const WORKLOAD_TOLERANCE = 0.1

export type ExpectedSource = 'sheet' | 'routine' | 'none'

/** 'missing' is a day that owed hours and has nothing logged at all. */
export type AuditVerdict = 'ok' | 'over' | 'under' | 'missing'

export interface EntryFix {
  entry: ClockifyEntry
  end: string
}

export interface DayAudit {
  date: IsoDate
  entries: ClockifyEntry[]
  loggedMinutes: number
  expectedMinutes: number
  expectedSource: ExpectedSource
  expectedCheckOut: string | null
  lastEntry: ClockifyEntry | null
  verdict: AuditVerdict
  fixable: boolean
}

export function groupEntriesByDay(entries: ClockifyEntry[]): Map<IsoDate, ClockifyEntry[]> {
  const byDay = new Map<IsoDate, ClockifyEntry[]>()

  for (const entry of entries) {
    const day = toIsoDate(new Date(entry.start))
    const list = byDay.get(day)
    if (list) list.push(entry)
    else byDay.set(day, [entry])
  }

  for (const list of byDay.values()) {
    list.sort((a, b) => a.start.localeCompare(b.start))
  }

  return byDay
}

export function entryMinutes(entry: ClockifyEntry, now = Date.now()): number {
  const start = Date.parse(entry.start)
  const end = entry.end ? Date.parse(entry.end) : now
  return Math.max(0, (end - start) / 60_000)
}

export function loggedMinutes(entries: ClockifyEntry[], now = Date.now()): number {
  return entries.reduce((total, entry) => total + entryMinutes(entry, now), 0)
}

/**
 * Moves the end of the day's last entry to the clock out time — shortening it when the
 * day overran, extending it when the day fell short. Impossible when the clock out lands
 * before that entry even started, or when it is already exactly there.
 */
export function planFix(
  date: IsoDate,
  lastEntry: ClockifyEntry | null,
  checkOut: string,
): EntryFix | null {
  if (!lastEntry || !checkOut) return null

  let end: string
  try {
    end = toUtcInstant(date, checkOut)
  } catch {
    return null
  }

  const target = Date.parse(end)
  if (target <= Date.parse(lastEntry.start)) return null
  if (lastEntry.end && target === Date.parse(lastEntry.end)) return null
  return { entry: lastEntry, end }
}

function verdictOf(expectedMinutes: number, logged: number, hasEntries: boolean): AuditVerdict {
  if (expectedMinutes > 0 && !hasEntries) return 'missing'
  if (logged > expectedMinutes * (1 + WORKLOAD_TOLERANCE)) return 'over'
  if (expectedMinutes > 0 && logged < expectedMinutes * (1 - WORKLOAD_TOLERANCE)) return 'under'
  return 'ok'
}

export function auditDays(
  rows: TimeSheetRow[],
  byDay: Map<IsoDate, ClockifyEntry[]>,
  routine: Routine,
  now = Date.now(),
): DayAudit[] {
  const workload = routineWorkloadMinutes(routine)

  return rows.map(row => {
    const entries = byDay.get(row.date) ?? []
    const lastEntry = entries.length > 0 ? entries[entries.length - 1] : null

    let expectedMinutes = 0
    let expectedSource: ExpectedSource = 'none'
    let expectedCheckOut: string | null = null

    if (rowState(row) === 'ready') {
      expectedMinutes = rowWorkedMinutes(row)
      expectedCheckOut = rowCheckOut(row)
      expectedSource = 'sheet'
    } else if (routine.workDays.includes(weekDay(row.date))) {
      expectedMinutes = workload
      expectedCheckOut = routine.checkOut
      expectedSource = 'routine'
    }

    const logged = loggedMinutes(entries, now)

    return {
      date: row.date,
      entries,
      loggedMinutes: logged,
      expectedMinutes,
      expectedSource,
      expectedCheckOut,
      lastEntry,
      verdict: verdictOf(expectedMinutes, logged, entries.length > 0),
      fixable: planFix(row.date, lastEntry, expectedCheckOut ?? '') !== null,
    }
  })
}
