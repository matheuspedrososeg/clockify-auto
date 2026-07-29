import { useState } from 'react'
import { Segmented } from 'antd'
import type { ReportVM } from '../hooks/useReport'
import type { GitHubVM } from '../hooks/useGitHub'
import type { SourceMode } from '../types/timesheet'
import type { Dictionary } from '../i18n/dictionaries'
import { useI18n } from '../i18n/useI18n'
import { UploadDropzone } from './UploadDropzone'
import { PeriodForm, type RangeValue } from './PeriodForm'

function buildModeOptions(t: Dictionary) {
  return [
    { label: t.source.modeImage, value: 'image' as const },
    { label: t.source.modePeriod, value: 'period' as const },
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
        <h2 className="section-head">{t.source.title}</h2>
        <Segmented
          options={buildModeOptions(t)}
          value={report.sourceMode}
          onChange={value => report.setSourceMode(value as SourceMode, onBeforeProcess)}
        />
      </div>

      {report.sourceMode === 'image' ? (
        <UploadDropzone report={report} onBeforeProcess={onBeforeProcess} />
      ) : (
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
