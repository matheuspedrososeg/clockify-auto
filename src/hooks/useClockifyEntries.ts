import { useRef, useState } from 'react'
import { message } from 'antd'
import { useI18n } from '../i18n/useI18n'
import type { ClockifyEntry } from '../utils/clockifyApi'
import { deleteEntry, fetchEntries, updateEntryEnd } from '../utils/clockifyApi'
import { groupEntriesByDay } from '../utils/cleanup'
import type { IsoDate } from '../utils/dates'
import { addDays, toUtcDayStart } from '../utils/dates'

interface UseClockifyEntriesParams {
  apiKey: string
  workspaceId: string | undefined
  userId: string | undefined
}

export function useClockifyEntries({ apiKey, workspaceId, userId }: UseClockifyEntriesParams) {
  const { t } = useI18n()
  const [byDay, setByDay] = useState<Map<IsoDate, ClockifyEntry[]>>(new Map())
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  // Mutations run inside async handlers that also read the cache, so the ref keeps
  // reads fresh between two awaits of the same batch.
  const byDayRef = useRef(byDay)
  const rangeRef = useRef<{ start: IsoDate; end: IsoDate } | null>(null)
  const fetchedRef = useRef('')

  function commit(next: Map<IsoDate, ClockifyEntry[]>) {
    byDayRef.current = next
    setByDay(next)
  }

  async function fetchRange(start: IsoDate, end: IsoDate) {
    if (!workspaceId || !userId) return
    setLoading(true)
    setError(false)
    try {
      const entries = await fetchEntries(
        apiKey,
        workspaceId,
        userId,
        toUtcDayStart(start),
        toUtcDayStart(addDays(end, 1)),
      )
      commit(groupEntriesByDay(entries))
      setLoaded(true)
    } catch {
      setError(true)
      message.error(t.messages.entriesRangeError)
    } finally {
      setLoading(false)
    }
  }

  async function loadRange(start: IsoDate, end: IsoDate) {
    if (!workspaceId || !userId) return
    const key = `${workspaceId}:${start}..${end}`
    if (fetchedRef.current === key) return
    fetchedRef.current = key
    rangeRef.current = { start, end }
    await fetchRange(start, end)
  }

  async function reloadRange() {
    const range = rangeRef.current
    if (!range) return
    await fetchRange(range.start, range.end)
  }

  function reset() {
    fetchedRef.current = ''
    rangeRef.current = null
    setLoaded(false)
    setError(false)
    commit(new Map())
  }

  async function deleteDay(date: IsoDate) {
    if (!workspaceId) throw new Error('no workspace selected')
    const list = byDayRef.current.get(date) ?? []
    if (list.length === 0) return

    await Promise.all(list.map(entry => deleteEntry(apiKey, workspaceId, entry.id)))

    const next = new Map(byDayRef.current)
    next.delete(date)
    commit(next)
  }

  async function closeEntry(date: IsoDate, entry: ClockifyEntry, end: string) {
    if (!workspaceId) throw new Error('no workspace selected')
    await updateEntryEnd(apiKey, workspaceId, entry, end)

    const list = byDayRef.current.get(date)
    if (!list) return
    const next = new Map(byDayRef.current)
    next.set(date, list.map(item => (item.id === entry.id ? { ...item, end } : item)))
    commit(next)
  }

  return {
    byDay,
    loading,
    loaded,
    error,
    loadRange,
    reloadRange,
    reset,
    deleteDay,
    closeEntry,
  }
}

export type ClockifyEntriesVM = ReturnType<typeof useClockifyEntries>
