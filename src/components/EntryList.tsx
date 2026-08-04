import { Tag } from 'antd'
import type { ClockifyEntry, ClockifyProject } from '../utils/clockifyApi'
import { entryMinutes } from '../utils/cleanup'
import { formatClock, formatDuration } from '../utils/dates'
import { useI18n } from '../i18n/useI18n'

interface EntryListProps {
  entries: ClockifyEntry[]
  projects: ClockifyProject[]
  highlightId?: string
}

export function EntryList({ entries, projects, highlightId }: EntryListProps) {
  const { t } = useI18n()

  function projectName(projectId: string | null): string {
    if (!projectId) return t.cleanup.entryNoProject
    return projects.find(p => p.id === projectId)?.name ?? t.cleanup.entryNoProject
  }

  return (
    <ul className="entry-list">
      {entries.map(entry => (
        <li key={entry.id} className="entry-item">
          <code className="entry-clock">
            {formatClock(entry.start)} → {entry.end ? formatClock(entry.end) : '--:--'}
          </code>
          <span className="entry-duration">{formatDuration(entryMinutes(entry))}</span>
          <Tag className="entry-project">{projectName(entry.projectId)}</Tag>
          {entry.description && <span className="entry-description">{entry.description}</span>}
          {!entry.end && <Tag className="entry-flag">{t.cleanup.entryRunning}</Tag>}
          {entry.id === highlightId && <Tag className="entry-flag">{t.cleanup.entryTarget}</Tag>}
        </li>
      ))}
    </ul>
  )
}
