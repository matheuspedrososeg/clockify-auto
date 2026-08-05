import { useMemo, useState } from 'react'
import { Button, Select, Table, Tag, Tooltip } from 'antd'
import { CheckOutlined } from '@ant-design/icons'
import type { TableColumnsType } from 'antd'
import type { TimeField, TimeSheetRow } from '../types/timesheet'
import type { ClockifyVM } from '../hooks/useClockify'
import type { GitHubVM } from '../hooks/useGitHub'
import type { Dictionary } from '../i18n/dictionaries'
import { useI18n } from '../i18n/useI18n'
import { formatDayMonth, formatDuration } from '../utils/dates'
import { loggedMinutes } from '../utils/cleanup'
import { countRowStates, rowState } from '../utils/timesheet'
import { CommitList } from './CommitList'
import { EntryList } from './EntryList'
import { ReplaceConfirmModal } from './ReplaceConfirmModal'
import { TimeCell } from './TimeCell'

type TimeSheetTableRow = TimeSheetRow & { key: number }
type Columns = TableColumnsType<TimeSheetTableRow>
type TimeChangeHandler = (index: number, field: TimeField, value: string) => void
type InsertHandler = (index: number, row: TimeSheetRow) => void
type ProjectOption = { value: string; label: string }

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

function buildExistingColumn(clockify: ClockifyVM, t: Dictionary): Columns {
  return [
    {
      title: t.existing.column,
      key: 'existing',
      align: 'center',
      width: 150,
      render: (_, record) => {
        const entries = clockify.entries.byDay.get(record.date) ?? []
        if (entries.length === 0) return <span className="existing-none">{t.existing.none}</span>
        return (
          <Tooltip
            rootClassName="entry-tooltip"
            title={
              <>
                <p className="existing-tooltip-text">{t.existing.tooltip(entries.length)}</p>
                <EntryList entries={entries} projects={clockify.projects} />
              </>
            }
          >
            <Tag className="existing-tag">{t.existing.tag(formatDuration(loggedMinutes(entries)))}</Tag>
          </Tooltip>
        )
      },
    },
  ]
}

function buildClockifyColumns(
  clockify: ClockifyVM,
  t: Dictionary,
  projectOptions: ProjectOption[],
  onInsert: InsertHandler,
): Columns {
  const {
    rowStatus, rowProject, autoProject, insertingAll,
    resolveProject, setRowProjectOverride,
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
            options={projectOptions}
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
              onClick={() => onInsert(record.key, record)}
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
  const [pendingRow, setPendingRow] = useState<{ index: number; row: TimeSheetRow } | null>(null)

  function handleTimeChange(index: number, field: TimeField, value: string) {
    onTimeChange(index, field, value)
    clockify.clearRowStatus(index)
  }

  function handleInsert(index: number, row: TimeSheetRow) {
    const existing = clockify.entries.byDay.get(row.date) ?? []
    if (existing.length === 0) {
      clockify.handleInsertRow(index, row)
      return
    }
    setPendingRow({ index, row })
  }

  function confirmReplace() {
    if (pendingRow) clockify.handleInsertRow(pendingRow.index, pendingRow.row, true)
    setPendingRow(null)
  }

  const projectOptions = useMemo(
    () => clockify.projects.map(p => ({ value: p.id, label: p.name })),
    [clockify.projects],
  )

  const columns = clockify.clockifyConnected
    ? [
        ...buildBaseColumns(t, handleTimeChange),
        ...(clockify.entries.loaded ? buildExistingColumn(clockify, t) : []),
        ...buildClockifyColumns(clockify, t, projectOptions, handleInsert),
      ]
    : buildBaseColumns(t, handleTimeChange)

  const dataSource: TimeSheetTableRow[] = useMemo(
    () => rows.map((row, i) => ({ ...row, key: i })),
    [rows],
  )
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

      {pendingRow && (
        <ReplaceConfirmModal
          dates={[pendingRow.row.date]}
          onConfirm={confirmReplace}
          onCancel={() => setPendingRow(null)}
        />
      )}
    </section>
  )
}
