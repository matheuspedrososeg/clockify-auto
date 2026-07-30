import { useEffect } from 'react'
import { Spin } from 'antd'
import { useReport } from './hooks/useReport'
import { useClockify } from './hooks/useClockify'
import { useGitHub } from './hooks/useGitHub'
import { useAutoProjects } from './hooks/useAutoProjects'
import { TopNav } from './components/TopNav'
import { HeroBand } from './components/HeroBand'
import { AiModelPanel } from './components/AiModelPanel'
import { ClockifyPanel } from './components/ClockifyPanel'
import { GitHubPanel } from './components/GitHubPanel'
import { SourceSection } from './components/SourceSection'
import { BulkBar } from './components/BulkBar'
import { KeyStorageSwitch } from './components/KeyStorageSwitch'
import { TimeSheetTable } from './components/TimeSheetTable'
import { InsertAllBand } from './components/InsertAllBand'
import './App.css'

function App() {
  const report = useReport()
  const clockify = useClockify()
  const github = useGitHub()

  const rows = report.rows
  const firstDate = rows?.[0]?.date
  const lastDate = rows?.[rows.length - 1]?.date

  useEffect(() => {
    if (github.status !== 'authenticated' || !firstDate || !lastDate) return
    github.loadCommitsForRange(firstDate, lastDate)
  }, [github, firstDate, lastDate])

  useAutoProjects({
    rows,
    commitsCache: github.commitsCache,
    projects: clockify.projects,
    applyAutoProjects: clockify.applyAutoProjects,
  })

  return (
    <div className="page">
      <TopNav />
      <HeroBand />

      <main className="content-band">
        <div className="band-inner">
          <div className="panel-grid">
            <AiModelPanel report={report} />
            <ClockifyPanel clockify={clockify} />
            <GitHubPanel github={github} />
          </div>

          <KeyStorageSwitch report={report} clockify={clockify} />

          <BulkBar clockify={clockify} />

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

          {rows && (
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
        <InsertAllBand rows={rows} clockify={clockify} />
      )}

    </div>
  )
}

export default App
