import { useState } from 'react'
import { Button } from 'antd'
import type { TimeSheetRow } from '../types/timesheet'
import type { ClockifyVM } from '../hooks/useClockify'
import { useI18n } from '../i18n/useI18n'
import { countRowStates, rowState } from '../utils/timesheet'
import { ReplaceConfirmModal } from './ReplaceConfirmModal'

interface InsertAllBandProps {
  rows: TimeSheetRow[]
  clockify: ClockifyVM
}

export function InsertAllBand({ rows, clockify }: InsertAllBandProps) {
  const { t } = useI18n()
  const [confirming, setConfirming] = useState(false)
  const { ready, empty } = countRowStates(rows)
  const targets = rows.filter(
    (row, i) => rowState(row) === 'ready' && !!clockify.resolveProject(i),
  )
  const insertable = targets.length

  const conflictDates = targets
    .map(row => row.date)
    .filter(date => (clockify.entries.byDay.get(date)?.length ?? 0) > 0)

  const status =
    insertable > 0 ? t.cta.subtitle(insertable)
    : ready > 0 ? t.cta.missingProject
    : t.cta.nothingToSend

  function handleClick() {
    if (conflictDates.length === 0) {
      clockify.handleInsertAll(rows)
      return
    }
    setConfirming(true)
  }

  function confirmReplace() {
    setConfirming(false)
    clockify.handleInsertAll(rows, new Set(conflictDates))
  }

  return (
    <section className="cta-band">
      <div className="band-inner">
        <div className="cta-card">
          <div>
            <h2>{t.cta.title}</h2>
            <p>{status}</p>
            {insertable > 0 && empty > 0 && <p>{t.cta.skipped(empty)}</p>}
          </div>
          <Button
            type="primary"
            loading={clockify.insertingAll}
            disabled={insertable === 0}
            onClick={handleClick}
          >
            {t.cta.button}
          </Button>
        </div>
      </div>

      {confirming && (
        <ReplaceConfirmModal
          dates={conflictDates}
          onConfirm={confirmReplace}
          onCancel={() => setConfirming(false)}
        />
      )}
    </section>
  )
}
