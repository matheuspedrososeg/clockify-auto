import { useState } from 'react'
import { Input, Tooltip } from 'antd'
import { useI18n } from '../i18n/useI18n'
import { normalizeTime } from '../utils/dates'

interface TimeCellProps {
  value: string
  disabled?: boolean
  onCommit: (value: string) => void
}

export function TimeCell({ value, disabled, onCommit }: TimeCellProps) {
  const { t } = useI18n()
  const [draft, setDraft] = useState(value)
  const [invalid, setInvalid] = useState(false)
  const [syncedValue, setSyncedValue] = useState(value)

  // Rows are replaced wholesale on regenerate/re-upload while React keeps this
  // component mounted at the same position, so the draft has to follow the prop.
  if (value !== syncedValue) {
    setSyncedValue(value)
    setDraft(value)
    setInvalid(false)
  }

  function handleBlur() {
    const next = normalizeTime(draft)
    if (next === null) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    setDraft(next)
    if (next !== value) onCommit(next)
  }

  return (
    <Tooltip title={invalid ? t.table.timeInvalid : ''}>
      <Input
        size="small"
        className={`time-cell${invalid ? ' is-invalid' : ''}`}
        value={draft}
        placeholder={t.table.timePlaceholder}
        maxLength={5}
        inputMode="numeric"
        autoComplete="off"
        disabled={disabled}
        onChange={e => {
          setDraft(e.target.value)
          setInvalid(false)
        }}
        onBlur={handleBlur}
        onPressEnter={e => e.currentTarget.blur()}
      />
    </Tooltip>
  )
}
