import { useEffect, useMemo, useRef } from 'react'
import type { TimeSheetRow } from '../types/timesheet'
import type { IsoDate } from '../utils/dates'
import type { ProjectSuggestion } from '../utils/projectMatch'
import { suggestProjectsForDates } from '../utils/projectMatch'
import type { ProjectAlias } from '../utils/aliasStorage'
import type { ClockifyProject } from './useClockify'
import type { GitHubCommit } from './useGitHub'

interface UseAutoProjectsParams {
  rows: TimeSheetRow[] | null
  commitsCache: Map<IsoDate, GitHubCommit[]>
  projects: ClockifyProject[]
  aliases: ProjectAlias[]
  applyAutoProjects: (suggestions: Map<number, ProjectSuggestion>) => void
}

export function useAutoProjects({
  rows,
  commitsCache,
  projects,
  aliases,
  applyAutoProjects,
}: UseAutoProjectsParams) {
  const applyRef = useRef(applyAutoProjects)

  const dateKey = rows?.map(row => row.date).join('|') ?? ''

  const suggestions = useMemo(
    () =>
      dateKey
        ? suggestProjectsForDates(dateKey.split('|'), commitsCache, projects, aliases)
        : null,
    [dateKey, commitsCache, projects, aliases],
  )

  useEffect(() => {
    applyRef.current = applyAutoProjects
  })

  useEffect(() => {
    if (!suggestions || suggestions.size === 0) return
    applyRef.current(suggestions)
  }, [suggestions])
}
