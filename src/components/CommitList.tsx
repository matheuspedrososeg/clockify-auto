import { Button, Spin, Tag } from 'antd'
import type { GitHubCommit } from '../hooks/useGitHub'
import { useI18n } from '../i18n/useI18n'

interface CommitListProps {
  commits: GitHubCommit[] | undefined
  loading: boolean
  error: boolean
  onRetry: () => void
}

export function CommitList({ commits, loading, error, onRetry }: CommitListProps) {
  const { t } = useI18n()

  if (loading) {
    return (
      <div className="commits-loading">
        <Spin size="small" />
        <span>{t.commits.loading}</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="commits-loading">
        <span>{t.commits.error}</span>
        <Button size="small" onClick={onRetry}>{t.commits.retry}</Button>
      </div>
    )
  }

  if (!commits || commits.length === 0) {
    return <p className="commits-empty">{t.commits.empty}</p>
  }

  return (
    <ul className="commit-list">
      {commits.map(c => (
        <li key={c.sha} className="commit-item">
          <code className="commit-sha">{c.sha}</code>
          <Tag className="commit-repo">{c.repo}</Tag>
          <a className="commit-message" href={c.url} target="_blank" rel="noreferrer">
            {c.message}
          </a>
        </li>
      ))}
    </ul>
  )
}
