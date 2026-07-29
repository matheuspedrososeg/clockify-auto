import { Button } from 'antd'
import type { TimeSheetRow } from '../types/timesheet'
import type { ClockifyVM } from '../hooks/useClockify'
import { useI18n } from '../i18n/useI18n'
import { countRowStates, rowState } from '../utils/timesheet'

interface InsertAllBandProps {
  rows: TimeSheetRow[]
  clockify: ClockifyVM
}

export function InsertAllBand({ rows, clockify }: InsertAllBandProps) {
  const { t } = useI18n()
  const { ready, empty } = countRowStates(rows)
  const insertable = rows.filter(
    (row, i) => rowState(row) === 'ready' && !!clockify.resolveProject(i),
  ).length

  const status =
    insertable > 0 ? t.cta.subtitle(insertable)
    : ready > 0 ? t.cta.missingProject
    : t.cta.nothingToSend

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
            onClick={() => clockify.handleInsertAll(rows)}
          >
            {t.cta.button}
          </Button>
        </div>
      </div>
    </section>
  )
}
