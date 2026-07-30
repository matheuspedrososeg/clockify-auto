import { useEffect, useMemo, useRef } from 'react'
import type { TimeSheetRow } from '../types/timesheet'
import type { IsoDate } from '../utils/dates'
import type { ProjectSuggestion } from '../utils/projectMatch'
import { suggestProjectsForRows } from '../utils/projectMatch'
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

  const suggestions = useMemo(
    () => (rows ? suggestProjectsForRows(rows, commitsCache, projects) : null),
    [rows, commitsCache, projects],
  )

  useEffect(() => {
    applyRef.current = applyAutoProjects
  })

  useEffect(() => {
    if (!suggestions || suggestions.size === 0) return
    applyRef.current(suggestions)
  }, [suggestions])
}
