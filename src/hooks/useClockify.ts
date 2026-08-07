import { useEffect, useRef, useState } from 'react'
import { message } from 'antd'
import type { TimeSheetRow } from '../types/timesheet'
import { useI18n } from '../i18n/useI18n'
import type { IsoDate } from '../utils/dates'
import { formatDayMonth } from '../utils/dates'
import { rowState } from '../utils/timesheet'
import type { ProjectSuggestion } from '../utils/projectMatch'
import { readKey, writeKey } from '../utils/keyStorage'
import type { ClockifyProject, ClockifyWorkspace } from '../utils/clockifyApi'
import {
  ClockifyError,
  fetchCurrentUser,
  fetchProjects,
  fetchWorkspaces,
  postTimeEntry,
} from '../utils/clockifyApi'
import { ROW_CONCURRENCY, mapLimited } from '../utils/rateLimit'
import { useClockifyEntries } from './useClockifyEntries'

export type { ClockifyProject, ClockifyWorkspace } from '../utils/clockifyApi'

export type RowStatus = 'queued' | 'loading' | 'done' | 'error'

export interface InsertProgress {
  done: number
  total: number
}

function isRateLimit(err: unknown): boolean {
  return err instanceof ClockifyError && err.status === 429
}

export function useClockify() {
  const { t } = useI18n()
  const [apiKey, setApiKeyState] = useState(() => readKey('clockify_api_key'))
  const [userId, setUserId] = useState<string | undefined>()
  const [workspaces, setWorkspaces] = useState<ClockifyWorkspace[]>([])
  const [selectedWorkspace, setSelectedWorkspace] = useState<string | undefined>()
  const [projects, setProjects] = useState<ClockifyProject[]>([])
  const [selectedProject, setSelectedProject] = useState<string | undefined>()
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false)
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [insertingAll, setInsertingAll] = useState(false)
  const [insertProgress, setInsertProgress] = useState<InsertProgress | null>(null)
  const [rowStatus, setRowStatus] = useState<Map<number, RowStatus>>(new Map())
  const [rowProject, setRowProject] = useState<Map<number, string>>(new Map())
  const [autoProject, setAutoProject] = useState<Map<number, ProjectSuggestion>>(new Map())

  const entries = useClockifyEntries({ apiKey, workspaceId: selectedWorkspace, userId })

  const clockifyConnected = !!(apiKey && selectedWorkspace && projects.length > 0)

  function setApiKey(value: string) {
    setApiKeyState(value)
    writeKey('clockify_api_key', value)
  }

  function setRowSt(idx: number, status: RowStatus) {
    setRowStatus(prev => new Map(prev).set(idx, status))
  }

  function setRowProjectOverride(idx: number, projectId: string) {
    setRowProject(prev => new Map(prev).set(idx, projectId))
    setAutoProject(prev => {
      if (!prev.has(idx)) return prev
      const next = new Map(prev)
      next.delete(idx)
      return next
    })
  }

  function resolveProject(idx: number): string | undefined {
    return rowProject.get(idx) ?? autoProject.get(idx)?.projectId ?? selectedProject
  }

  function setBulkProject(projectId: string) {
    setSelectedProject(projectId)
    setRowProject(new Map())
    setAutoProject(new Map())
  }

  function applyAutoProjects(suggestions: Map<number, ProjectSuggestion>) {
    setAutoProject(prev => {
      const next = new Map<number, ProjectSuggestion>()
      for (const [idx, suggestion] of suggestions) {
        const locked = rowProject.has(idx) || rowStatus.get(idx) === 'done'
        const kept = locked ? prev.get(idx) : suggestion
        if (kept) next.set(idx, kept)
      }
      if (next.size === prev.size) {
        let same = true
        for (const [idx, suggestion] of next) {
          if (prev.get(idx)?.projectId !== suggestion.projectId) {
            same = false
            break
          }
        }
        if (same) return prev
      }
      return next
    })
  }

  function resetInsertionState() {
    setRowStatus(new Map())
    setRowProject(new Map())
    setAutoProject(new Map())
    setInsertProgress(null)
  }

  /** Editing one row must not wipe the other rows' inserted badges. */
  function clearRowStatus(idx: number) {
    setRowStatus(prev => {
      if (!prev.has(idx)) return prev
      const next = new Map(prev)
      next.delete(idx)
      return next
    })
  }

  async function handleWorkspaceChange(wsId: string) {
    setSelectedWorkspace(wsId)
    setSelectedProject(undefined)
    setProjects([])
    entries.reset()
    setLoadingProjects(true)
    try {
      const ps = await fetchProjects(apiKey, wsId)
      setProjects(ps)
    } catch {
      message.error(t.messages.projectsError)
    } finally {
      setLoadingProjects(false)
    }
  }

  function disconnect() {
    setApiKey('')
    setUserId(undefined)
    setWorkspaces([])
    setSelectedWorkspace(undefined)
    setProjects([])
    setSelectedProject(undefined)
    entries.reset()
    resetInsertionState()
  }

  async function handleConnect() {
    if (!apiKey.trim()) return
    setLoadingWorkspaces(true)
    setWorkspaces([])
    setSelectedWorkspace(undefined)
    setProjects([])
    setSelectedProject(undefined)
    setUserId(undefined)
    entries.reset()
    try {
      const [ws, user] = await Promise.all([
        fetchWorkspaces(apiKey.trim()),
        fetchCurrentUser(apiKey.trim()),
      ])
      setUserId(user.id)
      setWorkspaces(ws)
      if (ws.length === 1) {
        await handleWorkspaceChange(ws[0].id)
      }
    } catch {
      message.error(t.messages.invalidClockifyKey)
    } finally {
      setLoadingWorkspaces(false)
    }
  }

  const bootConnectRef = useRef(handleConnect)
  const bootedRef = useRef(false)

  useEffect(() => {
    if (bootedRef.current) return
    bootedRef.current = true
    bootConnectRef.current()
  }, [])

  async function handleInsertRow(idx: number, row: TimeSheetRow, replace = false) {
    const projectId = resolveProject(idx)
    if (!projectId) {
      message.error(t.messages.missingProject)
      return
    }

    const state = rowState(row)
    if (state === 'empty') {
      message.info(t.messages.rowEmpty(formatDayMonth(row.date)))
      return
    }
    if (state === 'invalid') {
      setRowSt(idx, 'error')
      message.error(t.messages.rowInvalid(formatDayMonth(row.date)))
      return
    }

    setRowSt(idx, 'loading')
    try {
      if (replace) await entries.deleteDay(row.date)
      await postTimeEntry(apiKey, selectedWorkspace!, projectId, row)
      setRowSt(idx, 'done')
      message.success(t.messages.dayInserted(formatDayMonth(row.date)))
    } catch (err) {
      setRowSt(idx, 'error')
      message.error(
        isRateLimit(err) ? t.messages.rateLimited : t.messages.dayError(formatDayMonth(row.date)),
      )
    }
    void entries.reloadRange()
  }

  /**
   * Receives the full array on purpose: rowStatus/rowProject are keyed by index and
   * must stay aligned with the table's row keys, so filtering happens inside.
   */
  async function handleInsertAll(rows: TimeSheetRow[], replaceDates?: Set<IsoDate>) {
    const planned = rows.map((row, i) => ({
      i,
      row,
      state: rowState(row),
      projectId: resolveProject(i),
    }))
    const invalid = planned.filter(p => p.state === 'invalid')
    const skipped = planned.filter(p => p.state === 'empty').length
    const targets = planned.filter(p => p.state === 'ready' && p.projectId)

    invalid.forEach(p => setRowSt(p.i, 'error'))

    if (targets.length === 0) {
      const readyWithoutProject = planned.some(p => p.state === 'ready' && !p.projectId)
      message.warning(readyWithoutProject ? t.messages.missingProject : t.messages.nothingToInsert)
      return
    }

    setInsertingAll(true)
    setInsertProgress({ done: 0, total: targets.length })
    targets.forEach(p => setRowSt(p.i, 'queued'))

    let failed = 0
    let rateLimited = false
    await mapLimited(targets, ROW_CONCURRENCY, async ({ i, row, projectId }) => {
      setRowSt(i, 'loading')
      try {
        if (replaceDates?.has(row.date)) await entries.deleteDay(row.date)
        await postTimeEntry(apiKey, selectedWorkspace!, projectId!, row)
        setRowSt(i, 'done')
      } catch (err) {
        setRowSt(i, 'error')
        failed++
        if (isRateLimit(err)) rateLimited = true
      }
      setInsertProgress(prev => (prev ? { ...prev, done: prev.done + 1 } : prev))
    })

    await entries.reloadRange()
    setInsertingAll(false)
    setInsertProgress(null)

    const errored = failed + invalid.length
    if (errored === 0 && skipped === 0) message.success(t.messages.allInserted)
    else message.warning(t.messages.insertSummary(targets.length - failed, errored, skipped))
    if (rateLimited) message.error(t.messages.rateLimited)
  }

  return {
    apiKey,
    setApiKey,
    userId,
    entries,
    workspaces,
    selectedWorkspace,
    projects,
    selectedProject,
    setBulkProject,
    loadingWorkspaces,
    loadingProjects,
    insertingAll,
    insertProgress,
    rowStatus,
    rowProject,
    autoProject,
    clockifyConnected,
    resolveProject,
    applyAutoProjects,
    handleConnect,
    disconnect,
    handleWorkspaceChange,
    handleInsertRow,
    handleInsertAll,
    setRowProjectOverride,
    resetInsertionState,
    clearRowStatus,
  }
}

export type ClockifyVM = ReturnType<typeof useClockify>
