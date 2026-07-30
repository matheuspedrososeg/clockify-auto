import { useEffect, useMemo, useRef } from 'react'
import type { TimeSheetRow } from '../types/timesheet'
import type { IsoDate } from '../utils/dates'
import type { ProjectSuggestion } from '../utils/projectMatch'
import { suggestProjectsForDates } from '../utils/projectMatch'
import type { ClockifyProject } from './useClockify'
import type { GitHubCommit } from './useGitHub'

interface UseAutoProjectsParams {
  rows: TimeSheetRow[] | null
  commitsCache: Map<IsoDate, GitHubCommit[]>
  projects: ClockifyProject[]
  applyAutoProjects: (suggestions: Map<number, ProjectSuggestion>) => void
}

export function useAutoProjects({
  rows,
  commitsCache,
  projects,
  applyAutoProjects,
}: UseAutoProjectsParams) {
  const applyRef = useRef(applyAutoProjects)

  // Keyed by the dates alone: editing a time replaces the rows array, and re-matching
  // every commit on each keystroke is far more expensive than the render itself.
  const dateKey = rows?.map(row => row.date).join('|') ?? ''

  const suggestions = useMemo(
    () => (dateKey ? suggestProjectsForDates(dateKey.split('|'), commitsCache, projects) : null),
    [dateKey, commitsCache, projects],
  )

  useEffect(() => {
    applyRef.current = applyAutoProjects
  })

  useEffect(() => {
    if (!suggestions || suggestions.size === 0) return
    applyRef.current(suggestions)
  }, [suggestions])
}
