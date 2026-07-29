import { Button, Input } from 'antd'
import { DisconnectOutlined } from '@ant-design/icons'
import type { ClockifyVM } from '../hooks/useClockify'
import { useI18n } from '../i18n/useI18n'
import { Panel } from './Panel'

interface ClockifyPanelProps {
  clockify: ClockifyVM
}

export function ClockifyPanel({ clockify }: ClockifyPanelProps) {
  const { t } = useI18n()
  const {
    apiKey, setApiKey, workspaces, loadingWorkspaces, handleConnect, disconnect,
  } = clockify
  const connected = workspaces.length > 0

  return (
    <Panel index="02" title={t.clockify.title}>
      <div className="config-col">
        <div className="config-field">
          <label>{t.clockify.apiKey}</label>
          <Input.Password
            placeholder={t.clockify.apiKeyPlaceholder}
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            onPressEnter={handleConnect}
            disabled={connected}
          />
        </div>

        {connected ? (
          <Button block icon={<DisconnectOutlined />} onClick={disconnect}>
            {t.clockify.disconnect}
          </Button>
        ) : (
          <Button
            type="primary"
            block
            loading={loadingWorkspaces}
            onClick={handleConnect}
            disabled={!apiKey.trim()}
          >
            {t.clockify.connect}
          </Button>
        )}

        <p className="panel-hint">
          {connected ? t.clockify.hintConnected : t.clockify.hintIdle}
        </p>
      </div>
    </Panel>
  )
}
