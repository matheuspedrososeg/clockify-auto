import type { OcrRow, TimeSheetRow } from '../types/timesheet'
import { dayMonthToIso, isValidTime, toUtcInstant } from './dates'

export type RowState = 'empty' | 'invalid' | 'ready'

export interface TimeEntry {
  start: string
  end: string
}

const PAIRS: Array<[keyof TimeSheetRow, keyof TimeSheetRow]> = [
  ['morningCheckIn', 'morningCheckOut'],
  ['afternoonCheckIn', 'afternoonCheckOut'],
]

const TIME_FIELDS = PAIRS.flat()

export function rowState(row: TimeSheetRow): RowState {
  const filled = TIME_FIELDS.filter(field => row[field] !== '')
  if (filled.length === 0) return 'empty'
  if (filled.some(field => !isValidTime(row[field]))) return 'invalid'

  for (const [from, to] of PAIRS) {
    const start = row[from]
    const end = row[to]
    if (!start && !end) continue
    if (!start || !end) return 'invalid'
    if (end <= start) return 'invalid'
  }
  return 'ready'
}

export function buildEntries(row: TimeSheetRow): TimeEntry[] {
  return PAIRS.filter(([from, to]) => row[from] && row[to]).map(([from, to]) => ({
    start: toUtcInstant(row.date, row[from]),
    end: toUtcInstant(row.date, row[to]),
  }))
}

export function countRowStates(rows: TimeSheetRow[]) {
  let ready = 0
  let invalid = 0
  let empty = 0
  for (const row of rows) {
    const state = rowState(row)
    if (state === 'ready') ready++
    else if (state === 'invalid') invalid++
    else empty++
  }
  return { ready, invalid, empty }
}

export function normalizeOcrRows(raw: OcrRow[], ref = new Date()): TimeSheetRow[] {
  const seen = new Set<string>()
  const rows: TimeSheetRow[] = []

  for (const item of raw) {
    const date = dayMonthToIso(String(item?.date ?? ''), ref)
    if (!date || seen.has(date)) continue
    seen.add(date)
    rows.push({
      date,
      morningCheckIn: String(item.morningCheckIn ?? ''),
      morningCheckOut: String(item.morningCheckOut ?? ''),
      afternoonCheckIn: String(item.afternoonCheckIn ?? ''),
      afternoonCheckOut: String(item.afternoonCheckOut ?? ''),
    })
  }

  return rows.sort((a, b) => a.date.localeCompare(b.date))
}
