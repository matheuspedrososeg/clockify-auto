import { Button, Spin, Table, Tag, Tooltip } from 'antd'
import { CheckOutlined } from '@ant-design/icons'
import type { TableColumnsType } from 'antd'
import type { ClockifyVM } from '../hooks/useClockify'
import type { CleanupVM } from '../hooks/useCleanup'
import type { AuditVerdict, DayAudit, ExpectedSource } from '../utils/cleanup'
import { formatDayMonth, formatDuration } from '../utils/dates'
import type { Dictionary } from '../i18n/dictionaries'
import { useI18n } from '../i18n/useI18n'
import { EntryList } from './EntryList'
import { TimeCell } from './TimeCell'

type AuditRow = DayAudit & { key: string }

function sourceLabel(t: Dictionary, source: ExpectedSource): string {
  if (source === 'sheet') return t.cleanup.sourceSheet
  if (source === 'routine') return t.cleanup.sourceRoutine
  return t.cleanup.sourceNone
}

function verdictClass(verdict: AuditVerdict): string {
  return verdict === 'over' ? 'cleanup-over' : 'cleanup-under'
}

function signedDuration(minutes: number): string {
  return `${minutes >= 0 ? '+' : '−'}${formatDuration(Math.abs(minutes))}`
}

interface CleanupTableProps {
  clockify: ClockifyVM
  cleanup: CleanupVM
}

export function CleanupTable({ clockify, cleanup }: CleanupTableProps) {
  const { t } = useI18n()
  const { entries } = clockify

  if (!clockify.clockifyConnected) {
    return (
      <section className="section-block">
        <p className="panel-hint">{t.cleanup.needsConnection}</p>
      </section>
    )
  }

  if (entries.error) {
    return (
      <section className="section-block">
        <p className="panel-hint cleanup-status">{t.cleanup.error}</p>
        <Button onClick={() => entries.reloadRange()}>{t.cleanup.retryLoad}</Button>
      </section>
    )
  }

  // Not-yet-loaded must not read as "nothing to fix".
  if (entries.loading || !entries.loaded) {
    return (
      <section className="section-block">
        <div className="spin-wrapper">
          <Spin size="large" />
        </div>
        <p className="panel-hint cleanup-status">{t.cleanup.loading}</p>
      </section>
    )
  }

  const columns: TableColumnsType<AuditRow> = [
    {
      title: t.table.date,
      key: 'date',
      align: 'center',
      width: 90,
      render: (_, record) => formatDayMonth(record.date),
    },
    {
      title: t.cleanup.logged,
      key: 'logged',
      align: 'center',
      width: 110,
      render: (_, record) => (
        <span className="cleanup-logged">{formatDuration(record.loggedMinutes)}</span>
      ),
    },
    {
      title: t.cleanup.expected,
      key: 'expected',
      align: 'center',
      width: 170,
      render: (_, record) => (
        <div className="cleanup-expected">
          <span>{formatDuration(record.expectedMinutes)}</span>
          <Tag className="project-auto-tag">{sourceLabel(t, record.expectedSource)}</Tag>
        </div>
      ),
    },
    {
      title: t.cleanup.difference,
      key: 'difference',
      align: 'center',
      width: 160,
      render: (_, record) => (
        <div className="cleanup-difference">
          <span className={verdictClass(record.verdict)}>
            {signedDuration(record.loggedMinutes - record.expectedMinutes)}
          </span>
          {record.verdict === 'missing' && (
            <Tag className="project-auto-tag">{t.cleanup.statusMissing}</Tag>
          )}
        </div>
      ),
    },
    {
      title: t.cleanup.newEnd,
      key: 'newEnd',
      align: 'center',
      width: 104,
      render: (_, record) => (
        <TimeCell
          value={cleanup.checkOutOf(record)}
          disabled={
            !record.lastEntry || cleanup.status.get(record.date) === 'done' || cleanup.fixingAll
          }
          onCommit={value => cleanup.setCheckOut(record.date, value)}
        />
      ),
    },
    {
      title: '',
      key: 'action',
      align: 'center',
      width: 170,
      render: (_, record) => {
        const status = cleanup.status.get(record.date)
        const fixable = cleanup.fixOf(record) !== null
        const hint = fixable ? ''
          : record.lastEntry ? t.cleanup.notFixable
          : t.cleanup.notFixableMissing
        return (
          <Tooltip title={hint}>
            <Button
              size="small"
              type={status === 'done' || status === 'error' ? 'default' : 'primary'}
              danger={status === 'error'}
              loading={status === 'loading'}
              disabled={!fixable || status === 'done' || status === 'queued' || cleanup.fixingAll}
              onClick={() => cleanup.fixDay(record)}
              icon={status === 'done' ? <CheckOutlined /> : undefined}
            >
              {status === 'done' ? t.cleanup.fixed
                : status === 'error' ? t.cleanup.retry
                : status === 'queued' ? t.cleanup.queued
                : t.cleanup.fix}
            </Button>
          </Tooltip>
        )
      },
    },
  ]

  const dataSource: AuditRow[] = cleanup.flagged.map(audit => ({ ...audit, key: audit.date }))

  return (
    <section className="section-block">
      <p className="result-header">
        {t.cleanup.header(cleanup.flagged.length, cleanup.audits.length)}
      </p>

      {dataSource.length === 0 ? (
        <p className="panel-hint">{t.cleanup.empty}</p>
      ) : (
        <Table
          columns={columns}
          dataSource={dataSource}
          pagination={false}
          bordered
          size="middle"
          scroll={{ x: 'max-content' }}
          sticky
          expandable={{
            expandedRowRender: record => (
              <EntryList
                entries={record.entries}
                projects={clockify.projects}
                highlightId={cleanup.fixOf(record)?.entry.id}
              />
            ),
          }}
        />
      )}
    </section>
  )
}
