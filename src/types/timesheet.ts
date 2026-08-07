import type { IsoDate } from '../utils/dates'

export interface TimeSheetRow {
  date: IsoDate
  morningCheckIn: string
  morningCheckOut: string
  afternoonCheckIn: string
  afternoonCheckOut: string
}

/** Raw OCR output, where `date` is still the 'DD/MM' string the spreadsheet shows. */
export interface OcrRow extends Omit<TimeSheetRow, 'date'> {
  date: string
}

export type TimeField =
  | 'morningCheckIn'
  | 'morningCheckOut'
  | 'afternoonCheckIn'
  | 'afternoonCheckOut'

export type SourceMode = 'image' | 'period' | 'csv'

export type CsvField = 'date' | TimeField

/** Which CSV header feeds each row field; `null` means the field stays blank. */
export type CsvMapping = Record<CsvField, string | null>

export type AppMode = 'recover' | 'cleanup'
