export type IsoDate = string

export const MAX_RANGE_DAYS = 30

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function toIsoDate(d: Date): IsoDate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Anchored at local noon so day arithmetic survives daylight saving shifts. */
export function fromIsoDate(iso: IsoDate): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0, 0)
}

export function isValidIsoDate(v: string): boolean {
  if (!ISO_RE.test(v)) return false
  return toIsoDate(fromIsoDate(v)) === v
}

export function addDays(iso: IsoDate, delta: number): IsoDate {
  const d = fromIsoDate(iso)
  d.setDate(d.getDate() + delta)
  return toIsoDate(d)
}

export function daysInclusive(start: IsoDate, end: IsoDate): number {
  const diff = fromIsoDate(end).getTime() - fromIsoDate(start).getTime()
  return Math.round(diff / 86_400_000) + 1
}

export function enumerateDays(start: IsoDate, end: IsoDate): IsoDate[] {
  const days: IsoDate[] = []
  const cursor = fromIsoDate(start)
  const last = fromIsoDate(end)
  while (cursor.getTime() <= last.getTime()) {
    days.push(toIsoDate(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

export function formatDayMonth(iso: IsoDate): string {
  const [, month, day] = iso.split('-')
  return `${day}/${month}`
}

export function isValidTime(hhmm: string): boolean {
  return TIME_RE.test(hhmm)
}

/** '' -> '', '8' -> '08:00', '830' -> '08:30', '1830' -> '18:30', '85' -> null */
export function normalizeTime(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  let hour: number
  let minute: number
  if (digits.length <= 2) {
    hour = Number(digits)
    minute = 0
  } else if (digits.length === 3) {
    hour = Number(digits[0])
    minute = Number(digits.slice(1))
  } else if (digits.length === 4) {
    hour = Number(digits.slice(0, 2))
    minute = Number(digits.slice(2))
  } else {
    return null
  }
  if (hour > 23 || minute > 59) return null
  return `${pad(hour)}:${pad(minute)}`
}

export function toUtcInstant(iso: IsoDate, hhmm: string): string {
  if (!isValidIsoDate(iso)) throw new RangeError(`invalid date: ${iso}`)
  if (!isValidTime(hhmm)) throw new RangeError(`invalid time: ${hhmm}`)
  const [y, m, d] = iso.split('-').map(Number)
  const [hour, minute] = hhmm.split(':').map(Number)
  return new Date(y, m - 1, d, hour, minute, 0, 0).toISOString()
}

/**
 * Timesheets are retrospective and only carry DD/MM, so a December sheet imported
 * in January must land in the previous year rather than the current one.
 */
export function inferYear(day: number, month: number, ref = new Date()): number {
  const GRACE_MS = 7 * 86_400_000
  const limit = ref.getTime() + GRACE_MS
  const base = ref.getFullYear()
  for (const year of [base, base - 1]) {
    const candidate = new Date(year, month - 1, day, 12)
    if (candidate.getMonth() !== month - 1) continue
    if (candidate.getTime() <= limit) return year
  }
  return base - 1
}

export function dayMonthToIso(raw: string, ref = new Date()): IsoDate | null {
  const parts = raw.trim().split(/[/\-.]/)
  if (parts.length < 2 || parts.length > 3) return null

  const day = Number(parts[0])
  const month = Number(parts[1])
  if (!Number.isInteger(day) || !Number.isInteger(month)) return null
  if (day < 1 || day > 31 || month < 1 || month > 12) return null

  let year: number
  if (parts.length === 3 && parts[2] !== '') {
    const explicit = Number(parts[2])
    if (!Number.isInteger(explicit)) return null
    year = parts[2].length <= 2 ? 2000 + explicit : explicit
  } else {
    year = inferYear(day, month, ref)
  }

  const iso = `${year}-${pad(month)}-${pad(day)}`
  return isValidIsoDate(iso) ? iso : null
}

/**
 * Git author dates keep the committer's own UTC offset, so the date portion already
 * is the author's local day. A normalized 'Z' timestamp has no offset to trust.
 */
export function commitDayKey(authorDate: string): IsoDate {
  if (/[+-]\d{2}:\d{2}$/.test(authorDate)) return authorDate.slice(0, 10)
  return toIsoDate(new Date(authorDate))
}
