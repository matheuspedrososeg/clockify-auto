import { useState } from 'react'
import { Switch } from 'antd'
import type { ReportVM } from '../hooks/useReport'
import type { ClockifyVM } from '../hooks/useClockify'
import { useI18n } from '../i18n/useI18n'
import { isRememberEnabled, setRememberEnabled, writeKey } from '../utils/keyStorage'

const LABEL_ID = 'key-storage-label'

interface KeyStorageSwitchProps {
  report: ReportVM
  clockify: ClockifyVM
}

export function KeyStorageSwitch({ report, clockify }: KeyStorageSwitchProps) {
  const { t } = useI18n()
  const [enabled, setEnabled] = useState(isRememberEnabled)

  function handleChange(next: boolean) {
    setRememberEnabled(next)
    setEnabled(next)
    if (!next) return
    // writeKey no-ops while opted out, so the flag has to flip first.
    writeKey('gemini_api_key', report.geminiApiKey)
    writeKey('claude_api_key', report.claudeApiKey)
    writeKey('clockify_api_key', clockify.apiKey)
  }

  return (
    <div className="key-storage">
      <Switch checked={enabled} onChange={handleChange} aria-labelledby={LABEL_ID} />
      <div>
        <p className="key-storage-label" id={LABEL_ID}>{t.storage.rememberKeys}</p>
        <p className="panel-hint">{t.storage.rememberHint}</p>
      </div>
    </div>
  )
}
