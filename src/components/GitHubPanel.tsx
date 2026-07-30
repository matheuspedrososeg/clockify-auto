import { Button, Spin, Tooltip } from 'antd'
import { CopyOutlined, DisconnectOutlined, GithubOutlined, UserOutlined } from '@ant-design/icons'
import type { GitHubVM } from '../hooks/useGitHub'
import { useI18n } from '../i18n/useI18n'
import { Panel } from './Panel'

interface GitHubPanelProps {
  github: GitHubVM
}

export function GitHubPanel({ github }: GitHubPanelProps) {
  const { t } = useI18n()
  const { status, userCode, verificationUri, username, handleConnect, disconnect } = github
  const authenticated = status === 'authenticated'

  const hint = {
    idle: t.github.hintIdle,
    awaiting: t.github.hintAwaiting,
    authenticated: t.github.hintAuthenticated,
  }[status]

  return (
    <Panel index="03" title={t.github.title} info={t.github.info}>
      <div className="config-col">
        <div className="config-field">
          <label>{t.github.account}</label>
          <div className="github-identity">
            <div className="github-avatar">
              {authenticated
                ? <img src={`https://github.com/${username}.png?size=96`} alt={t.github.avatarAlt(username)} />
                : <UserOutlined />}
            </div>
            <div className="github-identity-text">
              <p className={`github-identity-name${authenticated ? '' : ' is-empty'}`}>
                {authenticated ? `@${username}` : t.github.notAuthenticated}
              </p>
            </div>
          </div>
        </div>

        {status === 'awaiting' && (
          <div className="github-awaiting">
            <p className="github-awaiting-hint">
              {t.github.deviceHintBefore} <strong>github.com/login/device</strong> {t.github.deviceHintAfter}
            </p>
            <div className="github-code-row">
              <span className="github-code">{userCode}</span>
              <Tooltip title={t.github.copyCode}>
                <Button
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={() => { navigator.clipboard.writeText(userCode) }}
                />
              </Tooltip>
              <Button size="small" type="primary" href={verificationUri} target="_blank">
                {t.github.openGitHub}
              </Button>
            </div>
            <div className="github-polling">
              <Spin size="small" />
              <span>{t.github.awaitingAuth}</span>
            </div>
          </div>
        )}

        {status === 'idle' && (
          <Button block icon={<GithubOutlined />} onClick={handleConnect}>
            {t.github.connect}
          </Button>
        )}
        {authenticated && (
          <Button block icon={<DisconnectOutlined />} onClick={disconnect}>
            {t.github.disconnect}
          </Button>
        )}

        <p className="panel-hint">{hint}</p>
      </div>
    </Panel>
  )
}
