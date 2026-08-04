import { useState } from 'react'
import { AutoComplete, Button, Checkbox, Input, Segmented, Tooltip } from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import type { ReportVM } from '../hooks/useReport'
import type { ClockifyVM } from '../hooks/useClockify'
import type { AliasesVM } from '../hooks/useAliases'
import type { RoutineVM } from '../hooks/useRoutine'
import type { ProjectAlias } from '../utils/aliasStorage'
import type { Routine } from '../utils/routineStorage'
import { routineWorkloadMinutes } from '../utils/routineStorage'
import { formatDuration } from '../utils/dates'
import { useI18n } from '../i18n/useI18n'
import { LANG_OPTIONS, type Lang } from '../i18n/dictionaries'
import { KeyStorageSwitch } from './KeyStorageSwitch'
import { ModalSection, StyledModal } from './StyledModal'
import { TimeCell } from './TimeCell'

interface SettingsModalProps {
  onClose: () => void
  aliases: AliasesVM
  routine: RoutineVM
  report: ReportVM
  clockify: ClockifyVM
}

const BLANK: ProjectAlias = { repo: '', target: '' }

const ROUTINE_FIELDS: Array<{ field: keyof Omit<Routine, 'workDays'>; label: keyof RoutineDict }> = [
  { field: 'checkIn', label: 'checkIn' },
  { field: 'lunchOut', label: 'lunchOut' },
  { field: 'lunchIn', label: 'lunchIn' },
  { field: 'checkOut', label: 'checkOut' },
]

/** Monday first: the work week reads better than the raw 0..6 order. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]

type RoutineDict = ReturnType<typeof useI18n>['t']['routine']

export function SettingsModal({
  onClose,
  aliases,
  routine,
  report,
  clockify,
}: SettingsModalProps) {
  const { lang, setLang, t } = useI18n()
  const [draft, setDraft] = useState<ProjectAlias[]>(() =>
    aliases.aliases.length > 0 ? aliases.aliases : [BLANK],
  )
  const [routineDraft, setRoutineDraft] = useState<Routine>(() => routine.routine)

  function updateRow(index: number, field: keyof ProjectAlias, value: string) {
    setDraft(prev => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)))
  }

  function removeRow(index: number) {
    setDraft(prev => (prev.length === 1 ? [BLANK] : prev.filter((_, i) => i !== index)))
  }

  function handleSave() {
    aliases.save(draft)
    routine.save(routineDraft)
    onClose()
  }

  const targetOptions = clockify.projects.map(p => ({ value: p.name }))

  return (
    <StyledModal
      title={t.settings.title}
      okText={t.settings.save}
      cancelText={t.settings.cancel}
      onOk={handleSave}
      onCancel={onClose}
    >
      <ModalSection title={t.settings.aliasesSection}>
        <p className="panel-hint">{t.settings.aliasHint}</p>

        <div className="alias-rows">
          <div className="alias-row alias-row-head">
            <span>{t.settings.repoLabel}</span>
            <span>{t.settings.targetLabel}</span>
            <span />
          </div>

          {draft.map((row, index) => (
            <div className="alias-row" key={index}>
              <Input
                value={row.repo}
                placeholder={t.settings.repoPlaceholder}
                onChange={e => updateRow(index, 'repo', e.target.value)}
              />
              <AutoComplete
                value={row.target}
                options={targetOptions}
                placeholder={t.settings.targetPlaceholder}
                filterOption={(input, option) =>
                  (option?.value ?? '').toLowerCase().includes(input.toLowerCase())
                }
                onChange={value => updateRow(index, 'target', value)}
              />
              <Tooltip title={t.settings.remove}>
                <Button
                  type="text"
                  className="alias-remove"
                  icon={<DeleteOutlined />}
                  aria-label={t.settings.remove}
                  onClick={() => removeRow(index)}
                />
              </Tooltip>
            </div>
          ))}
        </div>

        <Button
          type="dashed"
          icon={<PlusOutlined />}
          onClick={() => setDraft(prev => [...prev, BLANK])}
          block
        >
          {t.settings.addAlias}
        </Button>
      </ModalSection>

      <ModalSection title={t.routine.section}>
        <p className="panel-hint">{t.routine.hint}</p>

        <div className="routine-grid">
          {ROUTINE_FIELDS.map(({ field, label }) => (
            <div className="config-field" key={field}>
              <label>{t.routine[label] as string}</label>
              <TimeCell
                value={routineDraft[field]}
                onCommit={value => setRoutineDraft(prev => ({ ...prev, [field]: value }))}
              />
            </div>
          ))}
        </div>

        <div className="config-field routine-days">
          <label>{t.routine.workDays}</label>
          <Checkbox.Group
            value={routineDraft.workDays}
            options={WEEK_ORDER.map(day => ({ label: t.routine.days[day], value: day }))}
            onChange={days =>
              setRoutineDraft(prev => ({ ...prev, workDays: (days as number[]).slice().sort() }))
            }
          />
        </div>

        <p className="panel-hint routine-workload">
          {t.routine.workload(formatDuration(routineWorkloadMinutes(routineDraft)))}
        </p>
      </ModalSection>

      <ModalSection title={t.settings.preferencesSection}>
        <div className="config-field">
          <label>{t.settings.language}</label>
          <Segmented
            options={LANG_OPTIONS}
            value={lang}
            onChange={v => setLang(v as Lang)}
            block
          />
        </div>
        <KeyStorageSwitch report={report} clockify={clockify} />
      </ModalSection>
    </StyledModal>
  )
}
