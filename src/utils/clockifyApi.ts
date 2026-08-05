import type { TimeSheetRow } from '../types/timesheet'
import { buildEntries, rowState } from './timesheet'

const BASE_URL = 'https://api.clockify.me/api/v1'
const ENTRIES_PAGE_SIZE = 200
const MAX_ENTRY_PAGES = 10

export interface ClockifyWorkspace {
  id: string
  name: string
}

export interface ClockifyProject {
  id: string
  name: string
}

export interface ClockifyEntry {
  id: string
  projectId: string | null
  description: string
  billable: boolean
  taskId: string | null
  tagIds: string[] | null
  start: string
  /** null while the timer is still running. */
  end: string | null
}

interface RawEntry {
  id: string
  projectId: string | null
  description: string | null
  billable: boolean
  taskId: string | null
  tagIds: string[] | null
  timeInterval: { start: string; end: string | null }
}

function headers(apiKey: string): HeadersInit {
  return { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' }
}

function toEntry(raw: RawEntry): ClockifyEntry {
  return {
    id: raw.id,
    projectId: raw.projectId ?? null,
    description: raw.description ?? '',
    billable: !!raw.billable,
    taskId: raw.taskId ?? null,
    tagIds: raw.tagIds ?? null,
    start: raw.timeInterval.start,
    end: raw.timeInterval.end ?? null,
  }
}

export async function fetchWorkspaces(apiKey: string): Promise<ClockifyWorkspace[]> {
  const res = await fetch(`${BASE_URL}/workspaces`, { headers: headers(apiKey) })
  if (!res.ok) throw new Error('invalid clockify api key')
  return res.json()
}

export async function fetchCurrentUser(apiKey: string): Promise<{ id: string }> {
  const res = await fetch(`${BASE_URL}/user`, { headers: headers(apiKey) })
  if (!res.ok) throw new Error('invalid clockify api key')
  return res.json()
}

export async function fetchProjects(
  apiKey: string,
  workspaceId: string,
): Promise<ClockifyProject[]> {
  const res = await fetch(`${BASE_URL}/workspaces/${workspaceId}/projects?page-size=500`, {
    headers: headers(apiKey),
  })
  if (!res.ok) throw new Error('failed to load projects')
  return res.json()
}

export async function fetchEntries(
  apiKey: string,
  workspaceId: string,
  userId: string,
  start: string,
  end: string,
): Promise<ClockifyEntry[]> {
  const all: ClockifyEntry[] = []

  for (let page = 1; page <= MAX_ENTRY_PAGES; page++) {
    const params = new URLSearchParams({
      start,
      end,
      'page-size': String(ENTRIES_PAGE_SIZE),
      page: String(page),
    })
    const res = await fetch(
      `${BASE_URL}/workspaces/${workspaceId}/user/${userId}/time-entries?${params}`,
      { headers: headers(apiKey) },
    )
    if (!res.ok) throw new Error('failed to load time entries')

    const batch: RawEntry[] = await res.json()
    all.push(...batch.map(toEntry))
    if (batch.length < ENTRIES_PAGE_SIZE) break
  }

  return all
}

export async function postTimeEntry(
  apiKey: string,
  workspaceId: string,
  projectId: string,
  row: TimeSheetRow,
): Promise<void> {
  if (rowState(row) !== 'ready') throw new Error(`row not ready: ${row.date}`)

  await Promise.all(
    buildEntries(row).map((entry) =>
      fetch(`${BASE_URL}/workspaces/${workspaceId}/time-entries`, {
        method: 'POST',
        headers: headers(apiKey),
        body: JSON.stringify({ ...entry, projectId, billable: false }),
      }).then((res) => {
        if (!res.ok) throw new Error(`failed to insert entry of ${row.date}`)
      }),
    ),
  )
}

export async function deleteEntry(
  apiKey: string,
  workspaceId: string,
  entryId: string,
): Promise<void> {
  const res = await fetch(`${BASE_URL}/workspaces/${workspaceId}/time-entries/${entryId}`, {
    method: 'DELETE',
    headers: headers(apiKey),
  })
  if (!res.ok) throw new Error(`failed to delete entry ${entryId}`)
}

/**
 * Clockify's PUT replaces the whole entry, so every field of the original has to be
 * echoed back — omitting one wipes it.
 */
export async function updateEntryEnd(
  apiKey: string,
  workspaceId: string,
  entry: ClockifyEntry,
  end: string,
): Promise<void> {
  const res = await fetch(`${BASE_URL}/workspaces/${workspaceId}/time-entries/${entry.id}`, {
    method: 'PUT',
    headers: headers(apiKey),
    body: JSON.stringify({
      start: entry.start,
      end,
      billable: entry.billable,
      description: entry.description,
      projectId: entry.projectId,
      taskId: entry.taskId,
      tagIds: entry.tagIds,
    }),
  })
  if (!res.ok) throw new Error(`failed to update entry ${entry.id}`)
}
