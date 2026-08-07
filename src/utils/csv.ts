import Papa from 'papaparse'
import type { CsvField, CsvMapping, OcrRow } from '../types/timesheet'
import { normalizeTime } from './dates'

export interface CsvTable {
  headers: string[]
  rows: Record<string, string>[]
}

export const CSV_FIELDS: CsvField[] = [
  'date',
  'morningCheckIn',
  'morningCheckOut',
  'afternoonCheckIn',
  'afternoonCheckOut',
]

export const EMPTY_CSV_MAPPING: CsvMapping = {
  date: null,
  morningCheckIn: null,
  morningCheckOut: null,
  afternoonCheckIn: null,
  afternoonCheckOut: null,
}

const KEYWORDS: Record<CsvField, string[]> = {
  date: ['data', 'date', 'dia'],
  morningCheckIn: ['entrada', 'entrada1', 'checkin', 'inicio', 'start'],
  morningCheckOut: ['saidaalmoco', 'almoco', 'intervalo', 'saida1', 'lunchout', 'breakstart'],
  afternoonCheckIn: ['voltaalmoco', 'retorno', 'volta', 'entrada2', 'lunchin', 'breakend'],
  afternoonCheckOut: ['saida', 'saida2', 'fim', 'checkout', 'end'],
}

const WITH_SECONDS_RE = /^\d{1,2}:\d{2}:\d{2}$/

function normalizeHeader(header: string): string {
  return header
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

export function parseCsvFile(file: File): Promise<CsvTable> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: header => header.trim(),
      complete: result => {
        const headers = (result.meta.fields ?? []).filter(header => header !== '')
        if (headers.length === 0 || result.data.length === 0) {
          reject(new Error('empty csv'))
          return
        }
        resolve({ headers, rows: result.data })
      },
      error: reject,
    })
  })
}

/**
 * Keyword match first, each header claimed at most once. A sheet with opaque headers
 * ('col1', 'col2') matches nothing, so fall back to position rather than leaving the
 * whole form blank — the user can still fix any field in the selects.
 */
export function guessMapping(headers: string[]): CsvMapping {
  const mapping = { ...EMPTY_CSV_MAPPING }
  const taken = new Set<string>()

  for (const field of CSV_FIELDS) {
    const match = headers.find(
      header => !taken.has(header) && KEYWORDS[field].includes(normalizeHeader(header)),
    )
    if (!match) continue
    mapping[field] = match
    taken.add(match)
  }

  if (taken.size > 0) return mapping

  CSV_FIELDS.forEach((field, index) => {
    mapping[field] = headers[index] ?? null
  })
  return mapping
}

/**
 * An unparseable cell is kept verbatim instead of blanked, so rowState flags the day as
 * invalid and the user sees what the file actually said.
 */
function parseCsvTime(raw: string): string {
  const value = raw.trim()
  const withoutSeconds = WITH_SECONDS_RE.test(value) ? value.slice(0, -3) : value
  return normalizeTime(withoutSeconds) ?? value
}

export function mapCsvRows(table: CsvTable, mapping: CsvMapping): OcrRow[] {
  function cell(row: Record<string, string>, field: CsvField): string {
    const header = mapping[field]
    return header ? (row[header] ?? '') : ''
  }

  return table.rows.map(row => ({
    date: cell(row, 'date').trim(),
    morningCheckIn: parseCsvTime(cell(row, 'morningCheckIn')),
    morningCheckOut: parseCsvTime(cell(row, 'morningCheckOut')),
    afternoonCheckIn: parseCsvTime(cell(row, 'afternoonCheckIn')),
    afternoonCheckOut: parseCsvTime(cell(row, 'afternoonCheckOut')),
  }))
}
