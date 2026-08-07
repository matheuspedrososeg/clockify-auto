import { useEffect } from 'react'
import { Spin } from 'antd'
import { useReport } from './hooks/useReport'
import { useClockify } from './hooks/useClockify'
import { useGitHub } from './hooks/useGitHub'
import { useAutoProjects } from './hooks/useAutoProjects'
import { useAliases } from './hooks/useAliases'
import { useRoutine } from './hooks/useRoutine'
import { useCleanup } from './hooks/useCleanup'
import { TopNav } from './components/TopNav'
import { HeroBand } from './components/HeroBand'
import { AiModelPanel } from './components/AiModelPanel'
import { ClockifyPanel } from './components/ClockifyPanel'
import { GitHubPanel } from './components/GitHubPanel'
import { SourceSection } from './components/SourceSection'
import { BulkBar } from './components/BulkBar'
import { TimeSheetTable } from './components/TimeSheetTable'
import { InsertAllBand } from './components/InsertAllBand'
import { CleanupTable } from './components/CleanupTable'
import { CleanupBand } from './components/CleanupBand'
import './App.css'

function App() {
  const report = useReport()
  const clockify = useClockify()
  const github = useGitHub()
  const aliases = useAliases()
  const routine = useRoutine()

  const rows = report.rows
  const firstDate = rows?.[0]?.date
  const lastDate = rows?.[rows.length - 1]?.date
  const cleanupMode = report.appMode === 'cleanup'

  useEffect(() => {
    if (github.status !== 'authenticated' || !firstDate || !lastDate) return
    github.loadCommitsForRange(firstDate, lastDate)
  }, [github, firstDate, lastDate])

  useEffect(() => {
    if (!clockify.clockifyConnected || !firstDate || !lastDate) return
    clockify.entries.loadRange(firstDate, lastDate)
  }, [clockify, firstDate, lastDate])

  useAutoProjects({
    rows,
    rowsVersion: report.rowsVersion,
    commitsCache: github.commitsCache,
    projects: clockify.projects,
    aliases: aliases.aliases,
    applyAutoProjects: clockify.applyAutoProjects,
  })

  const cleanup = useCleanup({ rows, clockify, routine: routine.routine })

  return (
    <div className="page">
      <TopNav aliases={aliases} routine={routine} report={report} clockify={clockify} />
      <HeroBand />

      <main className="content-band">
        <div className="band-inner">
          <div className="panel-grid">
            <AiModelPanel report={report} />
            <ClockifyPanel clockify={clockify} />
            <GitHubPanel github={github} />
          </div>

          <BulkBar clockify={clockify} appMode={report.appMode} />

          <SourceSection
            report={report}
            github={github}
            onBeforeProcess={clockify.resetInsertionState}
          />

          {report.loading && (
            <div className="spin-wrapper">
              <Spin size="large" />
            </div>
          )}

          {rows && cleanupMode && <CleanupTable clockify={clockify} cleanup={cleanup} />}

          {rows && !cleanupMode && (
            <TimeSheetTable
              rows={rows}
              clockify={clockify}
              github={github}
              onTimeChange={report.updateRowTime}
            />
          )}
        </div>
      </main>

      {rows && clockify.clockifyConnected && (
        cleanupMode
          ? <CleanupBand cleanup={cleanup} />
          : <InsertAllBand rows={rows} clockify={clockify} />
      )}

    </div>
  )
}

export default App
