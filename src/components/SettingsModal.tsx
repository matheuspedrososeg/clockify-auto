import { useState } from 'react'
import { AutoComplete, Button, Input, Segmented, Tooltip } from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import type { ReportVM } from '../hooks/useReport'
import type { ClockifyVM } from '../hooks/useClockify'
import type { AliasesVM } from '../hooks/useAliases'
import type { ProjectAlias } from '../utils/aliasStorage'
import { useI18n } from '../i18n/useI18n'
import { LANG_OPTIONS, type Lang } from '../i18n/dictionaries'
import { KeyStorageSwitch } from './KeyStorageSwitch'
import { ModalSection, StyledModal } from './StyledModal'

interface SettingsModalProps {
  onClose: () => void
  aliases: AliasesVM
  report: ReportVM
  clockify: ClockifyVM
}

const BLANK: ProjectAlias = { repo: '', target: '' }

export function SettingsModal({ onClose, aliases, report, clockify }: SettingsModalProps) {
  const { lang, setLang, t } = useI18n()
  const [draft, setDraft] = useState<ProjectAlias[]>(() =>
    aliases.aliases.length > 0 ? aliases.aliases : [BLANK],
  )

  function updateRow(index: number, field: keyof ProjectAlias, value: string) {
    setDraft(prev => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)))
  }

  function removeRow(index: number) {
    setDraft(prev => (prev.length === 1 ? [BLANK] : prev.filter((_, i) => i !== index)))
  }

  function handleSave() {
    aliases.save(draft)
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
