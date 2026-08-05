import { useMemo, useState } from 'react'
import { message } from 'antd'
import { useI18n } from '../i18n/useI18n'
import type { TimeSheetRow } from '../types/timesheet'
import type { DayAudit } from '../utils/cleanup'
import { auditDays, planFix } from '../utils/cleanup'
import type { IsoDate } from '../utils/dates'
import { formatDayMonth } from '../utils/dates'
import type { Routine } from '../utils/routineStorage'
import type { ClockifyVM, RowStatus } from './useClockify'

interface UseCleanupParams {
  rows: TimeSheetRow[] | null
  clockify: ClockifyVM
  routine: Routine
}

export function useCleanup({ rows, clockify, routine }: UseCleanupParams) {
  const { t } = useI18n()
  const [checkOutDraft, setCheckOutDraft] = useState<Map<IsoDate, string>>(new Map())
  const [status, setStatus] = useState<Map<IsoDate, RowStatus>>(new Map())
  const [fixingAll, setFixingAll] = useState(false)

  const { byDay } = clockify.entries

  const audits = useMemo(
    () => (rows ? auditDays(rows, byDay, routine) : []),
    [rows, byDay, routine],
  )
  const flagged = useMemo(() => audits.filter(a => a.verdict !== 'ok'), [audits])

  function checkOutOf(audit: DayAudit): string {
    return checkOutDraft.get(audit.date) ?? audit.expectedCheckOut ?? ''
  }

  function setCheckOut(date: IsoDate, value: string) {
    setCheckOutDraft(prev => new Map(prev).set(date, value))
    setStatus(prev => {
      if (!prev.has(date)) return prev
      const next = new Map(prev)
      next.delete(date)
      return next
    })
  }

  function fixOf(audit: DayAudit) {
    return planFix(audit.date, audit.lastEntry, checkOutOf(audit))
  }

  async function applyFix(audit: DayAudit): Promise<boolean> {
    const fix = fixOf(audit)
    if (!fix) return false

    setStatus(prev => new Map(prev).set(audit.date, 'loading'))
    try {
      await clockify.entries.closeEntry(audit.date, fix.entry, fix.end)
      setStatus(prev => new Map(prev).set(audit.date, 'done'))
      return true
    } catch {
      setStatus(prev => new Map(prev).set(audit.date, 'error'))
      return false
    }
  }

  async function fixDay(audit: DayAudit) {
    const ok = await applyFix(audit)
    if (ok) message.success(t.messages.dayFixed(formatDayMonth(audit.date)))
    else message.error(t.messages.dayFixError(formatDayMonth(audit.date)))
  }

  async function fixAll() {
    const targets = flagged.filter(
      audit => fixOf(audit) !== null && status.get(audit.date) !== 'done',
    )
    if (targets.length === 0) {
      message.warning(t.messages.nothingToFix)
      return
    }

    setFixingAll(true)
    const results = await Promise.all(targets.map(applyFix))
    setFixingAll(false)

    const ok = results.filter(Boolean).length
    if (ok === targets.length) message.success(t.messages.allFixed)
    else message.warning(t.messages.fixSummary(ok, targets.length - ok))
  }

  const pending = flagged.filter(
    audit => fixOf(audit) !== null && status.get(audit.date) !== 'done',
  ).length

  return {
    audits,
    flagged,
    pending,
    status,
    fixingAll,
    checkOutOf,
    setCheckOut,
    fixOf,
    fixDay,
    fixAll,
  }
}

export type CleanupVM = ReturnType<typeof useCleanup>
