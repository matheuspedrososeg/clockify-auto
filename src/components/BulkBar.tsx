import { useState } from 'react'
import { Select } from 'antd'
import type { AppMode } from '../types/timesheet'
import type { ClockifyVM } from '../hooks/useClockify'
import { useI18n } from '../i18n/useI18n'
import { StyledModal } from './StyledModal'

interface BulkBarProps {
  clockify: ClockifyVM
  appMode: AppMode
}

/**
 * Always mounted, even before Clockify is connected: letting the two selects appear
 * only after connecting shifted everything below them down the page.
 */
export function BulkBar({ clockify, appMode }: BulkBarProps) {
  const { t } = useI18n()
  const [pendingProject, setPendingProject] = useState<string | null>(null)
  const {
    workspaces, selectedWorkspace, handleWorkspaceChange,
    projects, selectedProject, setBulkProject, autoProject,
    loadingWorkspaces, loadingProjects, insertingAll,
  } = clockify

  // Cleanup never posts anything, so a bulk project has nothing to apply to.
  const projectDisabled = appMode === 'cleanup' || !selectedWorkspace || insertingAll

  function handleProjectPick(projectId: string) {
    if (autoProject.size === 0) {
      setBulkProject(projectId)
      return
    }
    setPendingProject(projectId)
  }

  function confirmOverwrite() {
    if (pendingProject) setBulkProject(pendingProject)
    setPendingProject(null)
  }

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
            loading={loadingWorkspaces}
            disabled={workspaces.length === 0 || insertingAll}
          />
        </div>
        <div className="config-field bulk-field">
          <label>{t.table.bulkProject}</label>
          <Select
            style={{ width: '100%' }}
            placeholder={t.clockify.projectPlaceholder}
            value={selectedProject}
            onChange={handleProjectPick}
            loading={loadingProjects}
            disabled={projectDisabled}
            options={projects.map(p => ({ value: p.id, label: p.name }))}
          />
        </div>
      </div>

      {pendingProject && (
        <StyledModal
          title={t.clockify.bulkOverwriteTitle}
          okText={t.clockify.bulkOverwriteOk}
          cancelText={t.clockify.bulkOverwriteCancel}
          onOk={confirmOverwrite}
          onCancel={() => setPendingProject(null)}
          okDanger
          width={480}
        >
          <p className="modal-text">{t.clockify.bulkOverwriteContent(autoProject.size)}</p>
        </StyledModal>
      )}
    </section>
  )
}
