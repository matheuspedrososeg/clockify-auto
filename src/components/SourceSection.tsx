import { useState } from 'react'
import { Segmented } from 'antd'
import type { ReportVM } from '../hooks/useReport'
import type { GitHubVM } from '../hooks/useGitHub'
import type { AppMode, SourceMode } from '../types/timesheet'
import type { Dictionary } from '../i18n/dictionaries'
import { useI18n } from '../i18n/useI18n'
import { UploadDropzone } from './UploadDropzone'
import { CsvForm } from './CsvForm'
import { PeriodForm, type RangeValue } from './PeriodForm'

function buildSourceOptions(t: Dictionary) {
  return [
    { label: t.source.modeImage, value: 'image' as const },
    { label: t.source.modeCsv, value: 'csv' as const },
    { label: t.source.modePeriod, value: 'period' as const },
  ]
}

function buildAppModeOptions(t: Dictionary) {
  return [
    { label: t.mode.recover, value: 'recover' as const },
    { label: t.mode.cleanup, value: 'cleanup' as const },
  ]
}

interface SourceSectionProps {
  report: ReportVM
  github: GitHubVM
  onBeforeProcess: () => void
}

export function SourceSection({ report, github, onBeforeProcess }: SourceSectionProps) {
  const { t } = useI18n()
  const [period, setPeriod] = useState<RangeValue>(null)

  function handleGenerate() {
    const [start, end] = period ?? []
    if (!start || !end) return
    report.generateRowsForRange(
      start.format('YYYY-MM-DD'),
      end.format('YYYY-MM-DD'),
      onBeforeProcess,
    )
  }

  return (
    <section className="section-block">
      <div className="section-head-row">
        <div className="section-head-col">
          <h2 className="section-head">{t.source.title}</h2>
          <p className="panel-hint mode-hint">
            {report.appMode === 'cleanup' ? t.mode.hintCleanup : t.mode.hintRecover}
          </p>
        </div>
        <div className="head-switches">
          <Segmented
            options={buildAppModeOptions(t)}
            value={report.appMode}
            onChange={value => report.setAppMode(value as AppMode)}
          />
          <Segmented
            options={buildSourceOptions(t)}
            value={report.sourceMode}
            onChange={value => report.setSourceMode(value as SourceMode, onBeforeProcess)}
          />
        </div>
      </div>

      {report.sourceMode === 'image' && (
        <UploadDropzone report={report} onBeforeProcess={onBeforeProcess} />
      )}

      {report.sourceMode === 'csv' && (
        <CsvForm
          report={report}
          onGenerate={() => report.generateRowsFromCsv(onBeforeProcess)}
        />
      )}

      {report.sourceMode === 'period' && (
        <PeriodForm
          value={period}
          onChange={setPeriod}
          onGenerate={handleGenerate}
          loading={github.commitsLoading}
        />
      )}
    </section>
  )
}
