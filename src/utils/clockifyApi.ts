import type { TimeSheetRow } from '../types/timesheet'
import { penalize, schedule, sleep } from './rateLimit'
import { buildEntries, rowState } from './timesheet'

const BASE_URL = 'https://api.clockify.me/api/v1'
const ENTRIES_PAGE_SIZE = 200
const MAX_ENTRY_PAGES = 10
const MAX_ATTEMPTS = 4
const BASE_BACKOFF_MS = 800
const MAX_JITTER_MS = 250

export class ClockifyError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ClockifyError'
    this.status = status
  }
}

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

/**
 * Retry-After is only readable if Clockify exposes it through CORS, so the exponential
 * fallback is the path that actually runs in the browser most of the time.
 */
function backoffMs(res: Response, attempt: number): number {
  const header = res.headers.get('Retry-After')
  if (header) {
    const seconds = Number(header)
    if (Number.isFinite(seconds)) return seconds * 1000
    const date = Date.parse(header)
    if (!Number.isNaN(date)) return Math.max(0, date - Date.now())
  }
  return BASE_BACKOFF_MS * 2 ** (attempt - 1) + Math.random() * MAX_JITTER_MS
}

async function request(url: string, init: RequestInit, failure: string): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    const res = await schedule(() => fetch(url, init))
    if (res.ok) return res
    if (res.status !== 429 || attempt === MAX_ATTEMPTS) throw new ClockifyError(failure, res.status)

    const wait = backoffMs(res, attempt)
    penalize(wait)
    await sleep(wait)
  }
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
  const res = await request(
    `${BASE_URL}/workspaces`,
    { headers: headers(apiKey) },
    'invalid clockify api key',
  )
  return res.json()
}

export async function fetchCurrentUser(apiKey: string): Promise<{ id: string }> {
  const res = await request(
    `${BASE_URL}/user`,
    { headers: headers(apiKey) },
    'invalid clockify api key',
  )
  return res.json()
}

export async function fetchProjects(
  apiKey: string,
  workspaceId: string,
): Promise<ClockifyProject[]> {
  const res = await request(
    `${BASE_URL}/workspaces/${workspaceId}/projects?page-size=500`,
    { headers: headers(apiKey) },
    'failed to load projects',
  )
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
    const res = await request(
      `${BASE_URL}/workspaces/${workspaceId}/user/${userId}/time-entries?${params}`,
      { headers: headers(apiKey) },
      'failed to load time entries',
    )

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

  // Sequential so a failure on the second interval does not leave the first one orphaned
  // in Clockify while the row is reported as failed.
  for (const entry of buildEntries(row)) {
    await request(
      `${BASE_URL}/workspaces/${workspaceId}/time-entries`,
      {
        method: 'POST',
        headers: headers(apiKey),
        body: JSON.stringify({ ...entry, projectId, billable: false }),
      },
      `failed to insert entry of ${row.date}`,
    )
  }
}

export async function deleteEntry(
  apiKey: string,
  workspaceId: string,
  entryId: string,
): Promise<void> {
  await request(
    `${BASE_URL}/workspaces/${workspaceId}/time-entries/${entryId}`,
    { method: 'DELETE', headers: headers(apiKey) },
    `failed to delete entry ${entryId}`,
  )
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
  await request(
    `${BASE_URL}/workspaces/${workspaceId}/time-entries/${entry.id}`,
    {
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
    },
    `failed to update entry ${entry.id}`,
  )
}
