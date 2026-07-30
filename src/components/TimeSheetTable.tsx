import { Button, Select, Table, Tag, Tooltip } from 'antd'
import { CheckOutlined } from '@ant-design/icons'
import type { TableColumnsType } from 'antd'
import type { TimeField, TimeSheetRow } from '../types/timesheet'
import type { ClockifyVM } from '../hooks/useClockify'
import type { GitHubVM } from '../hooks/useGitHub'
import type { Dictionary } from '../i18n/dictionaries'
import { useI18n } from '../i18n/useI18n'
import { formatDayMonth } from '../utils/dates'
import { countRowStates, rowState } from '../utils/timesheet'
import { CommitList } from './CommitList'
import { TimeCell } from './TimeCell'

type TimeSheetTableRow = TimeSheetRow & { key: number }
type Columns = TableColumnsType<TimeSheetTableRow>
type TimeChangeHandler = (index: number, field: TimeField, value: string) => void

const TIME_COLUMNS: Array<{ field: TimeField; title: keyof Dictionary['table'] }> = [
  { field: 'morningCheckIn', title: 'checkIn' },
  { field: 'morningCheckOut', title: 'lunchOut' },
  { field: 'afternoonCheckIn', title: 'lunchIn' },
  { field: 'afternoonCheckOut', title: 'checkOut' },
]

function buildBaseColumns(t: Dictionary, onTimeChange: TimeChangeHandler): Columns {
  return [
    {
      title: t.table.date,
      key: 'date',
      align: 'center',
      width: 90,
      render: (_, record) => formatDayMonth(record.date),
    },
    ...TIME_COLUMNS.map(({ field, title }) => ({
      title: t.table[title] as string,
      key: field,
      align: 'center' as const,
      width: 104,
      render: (_: unknown, record: TimeSheetTableRow) => (
        <TimeCell
          value={record[field]}
          onCommit={value => onTimeChange(record.key, field, value)}
        />
      ),
    })),
  ]
}

function buildClockifyColumns(clockify: ClockifyVM, t: Dictionary): Columns {
  const {
    projects, rowStatus, rowProject, autoProject, insertingAll,
    resolveProject, setRowProjectOverride, handleInsertRow,
  } = clockify

  return [
    {
      title: t.table.project,
      key: 'project',
      align: 'center',
      width: 220,
      render: (_, record) => {
        const suggestion = rowProject.has(record.key) ? undefined : autoProject.get(record.key)
        const select = (
          <Select
            size="small"
            style={{ width: '100%' }}
            placeholder={t.clockify.projectPlaceholder}
            value={resolveProject(record.key)}
            onChange={val => setRowProjectOverride(record.key, val)}
            options={projects.map(p => ({ value: p.id, label: p.name }))}
            disabled={rowStatus.get(record.key) === 'done' || insertingAll}
          />
        )
        if (!suggestion) return select
        return (
          <Tooltip
            title={t.table.autoProjectHint(
              suggestion.commits,
              suggestion.total,
              suggestion.topRepo,
            )}
          >
            <div className="project-cell">
              {select}
              <Tag className="project-auto-tag">{t.table.autoProjectTag}</Tag>
            </div>
          </Tooltip>
        )
      },
    },
    {
      title: '',
      key: 'action',
      align: 'center',
      width: 160,
      render: (_, record) => {
        const status = rowStatus.get(record.key)
        const state = rowState(record)
        const hasProject = !!resolveProject(record.key)
        const hint =
          state === 'empty' ? t.table.rowEmptyHint
          : state === 'invalid' ? t.table.rowInvalidHint
          : !hasProject ? t.table.rowNoProjectHint
          : ''
        return (
          <Tooltip title={hint}>
            <Button
              size="small"
              type={status === 'done' || status === 'error' ? 'default' : 'primary'}
              danger={status === 'error'}
              loading={status === 'loading'}
              disabled={state !== 'ready' || !hasProject || status === 'done' || insertingAll}
              onClick={() => handleInsertRow(record.key, record)}
              icon={status === 'done' ? <CheckOutlined /> : undefined}
            >
              {status === 'done' ? t.table.inserted : status === 'error' ? t.table.retry : t.table.insert}
            </Button>
          </Tooltip>
        )
      },
    },
  ]
}

interface TimeSheetTableProps {
  rows: TimeSheetRow[]
  clockify: ClockifyVM
  github: GitHubVM
  onTimeChange: TimeChangeHandler
}

export function TimeSheetTable({ rows, clockify, github, onTimeChange }: TimeSheetTableProps) {
  const { t } = useI18n()

  function handleTimeChange(index: number, field: TimeField, value: string) {
    onTimeChange(index, field, value)
    clockify.clearRowStatus(index)
  }

  const columns = clockify.clockifyConnected
    ? [...buildBaseColumns(t, handleTimeChange), ...buildClockifyColumns(clockify, t)]
    : buildBaseColumns(t, handleTimeChange)

  const dataSource: TimeSheetTableRow[] = rows.map((row, i) => ({ ...row, key: i }))
  const { ready } = countRowStates(rows)

  const retryCommits = () =>
    github.loadCommitsForRange(rows[0].date, rows[rows.length - 1].date)

  const expandable = github.status === 'authenticated'
    ? {
        expandedRowRender: (record: TimeSheetTableRow) => (
          <CommitList
            commits={github.commitsCache.get(record.date)}
            loading={github.isDayLoading(record.date)}
            error={github.commitsError && !github.commitsCache.has(record.date)}
            onRetry={retryCommits}
          />
        ),
      }
    : undefined

  return (
    <section className="section-block">
      <p className="result-header">{t.table.recordsFound(ready, rows.length)}</p>
      <Table
        columns={columns}
        dataSource={dataSource}
        pagination={false}
        bordered
        size="middle"
        scroll={{ x: 'max-content' }}
        sticky
        expandable={expandable}
      />
    </section>
  )
}
