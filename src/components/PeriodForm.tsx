import { Button, DatePicker } from 'antd'
import type { RangePickerProps } from 'antd/es/date-picker'
import dayjs from 'dayjs'
import { useI18n } from '../i18n/useI18n'
import { useIsTouch } from '../hooks/useIsTouch'
import { MAX_RANGE_DAYS } from '../utils/dates'

export type RangeValue = RangePickerProps['value']

interface PeriodFormProps {
  value: RangeValue
  onChange: (value: RangeValue) => void
  onGenerate: () => void
  loading: boolean
}

/** `from` (not value[0]) is what caps the range in both directions of selection. */
const disabledDate: NonNullable<RangePickerProps['disabledDate']> = (current, { from }) => {
  if (current.isAfter(dayjs(), 'day')) return true
  if (!from) return false
  return Math.abs(current.diff(from, 'day')) >= MAX_RANGE_DAYS
}

export function PeriodForm({ value, onChange, onGenerate, loading }: PeriodFormProps) {
  const { t } = useI18n()
  const isTouch = useIsTouch()
  const [start, end] = value ?? []
  const dayCount = start && end ? end.diff(start, 'day') + 1 : 0

  return (
    <div className="period-form">
      <div className="config-field period-field">
        <label>{t.source.periodLabel}</label>
        <DatePicker.RangePicker
          value={value}
          onChange={onChange}
          disabledDate={disabledDate}
          format={isTouch ? 'DD/MM/YYYY' : { format: 'DD/MM/YYYY', type: 'mask' }}
          inputReadOnly={isTouch}
          maxDate={dayjs()}
          allowClear
          style={{ width: '100%' }}
        />
      </div>

      <Button
        type="primary"
        loading={loading}
        disabled={dayCount === 0}
        onClick={onGenerate}
      >
        {t.source.generate}
      </Button>

      <p className="period-hint">
        {dayCount > 0 ? t.source.daysSelected(dayCount) : t.source.periodHint(MAX_RANGE_DAYS)}
      </p>
    </div>
  )
}
