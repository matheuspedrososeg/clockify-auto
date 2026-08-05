import { useState } from 'react'
import { Button } from 'antd'
import { SettingOutlined } from '@ant-design/icons'
import type { ReportVM } from '../hooks/useReport'
import type { ClockifyVM } from '../hooks/useClockify'
import type { AliasesVM } from '../hooks/useAliases'
import type { RoutineVM } from '../hooks/useRoutine'
import { useI18n } from '../i18n/useI18n'
import { SettingsModal } from './SettingsModal'

interface TopNavProps {
  aliases: AliasesVM
  routine: RoutineVM
  report: ReportVM
  clockify: ClockifyVM
}

export function TopNav({ aliases, routine, report, clockify }: TopNavProps) {
  const { t } = useI18n()
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <nav className="top-nav">
      <div className="band-inner top-nav-inner">
        <span className="top-nav-brand">{t.nav.brand}</span>
        <Button icon={<SettingOutlined />} onClick={() => setSettingsOpen(true)}>
          {t.settings.button}
        </Button>
      </div>

      {settingsOpen && (
        <SettingsModal
          onClose={() => setSettingsOpen(false)}
          aliases={aliases}
          routine={routine}
          report={report}
          clockify={clockify}
        />
      )}
    </nav>
  )
}
