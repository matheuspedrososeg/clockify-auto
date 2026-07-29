import { Select } from 'antd'
import type { ClockifyVM } from '../hooks/useClockify'
import { useI18n } from '../i18n/useI18n'

interface BulkBarProps {
  clockify: ClockifyVM
}

export function BulkBar({ clockify }: BulkBarProps) {
  const { t } = useI18n()
  const {
    workspaces, selectedWorkspace, handleWorkspaceChange,
    projects, selectedProject, setBulkProject,
    loadingProjects, insertingAll,
  } = clockify

  if (workspaces.length === 0) return null

  return (
    <section className="section-block bulk-bar">
      <div className="bulk-bar-fields">
        <div className="config-field bulk-field">
          <label>{t.clockify.workspace}</label>
          <Select
            style={{ width: '100%' }}
            placeholder={t.clockify.workspacePlaceholder}
            value={selectedWorkspace}
            onChange={handleWorkspaceChange}
            options={workspaces.map(w => ({ value: w.id, label: w.name }))}
            disabled={insertingAll}
          />
        </div>
        <div className="config-field bulk-field">
          <label>{t.table.bulkProject}</label>
          <Select
            style={{ width: '100%' }}
            placeholder={t.clockify.projectPlaceholder}
            value={selectedProject}
            onChange={setBulkProject}
            loading={loadingProjects}
            disabled={!selectedWorkspace || insertingAll}
            options={projects.map(p => ({ value: p.id, label: p.name }))}
          />
        </div>
      </div>
    </section>
  )
}
