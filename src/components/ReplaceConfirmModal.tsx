import type { IsoDate } from '../utils/dates'
import { formatDayMonth } from '../utils/dates'
import { useI18n } from '../i18n/useI18n'
import { StyledModal } from './StyledModal'

interface ReplaceConfirmModalProps {
  dates: IsoDate[]
  onConfirm: () => void
  onCancel: () => void
}

export function ReplaceConfirmModal({ dates, onConfirm, onCancel }: ReplaceConfirmModalProps) {
  const { t } = useI18n()

  return (
    <StyledModal
      title={t.replace.title}
      okText={t.replace.ok}
      cancelText={t.replace.cancel}
      onOk={onConfirm}
      onCancel={onCancel}
      okDanger
      width={480}
    >
      <p className="modal-text">{t.replace.content(dates.length)}</p>
      <p className="modal-text replace-days">
        <strong>{t.replace.daysLabel}:</strong> {dates.map(formatDayMonth).join(', ')}
      </p>
    </StyledModal>
  )
}
