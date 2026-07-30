export interface ProjectAlias {
  repo: string
  target: string
}

const ALIASES_KEY = 'project_aliases'

export function readAliases(): ProjectAlias[] {
  try {
    const raw = localStorage.getItem(ALIASES_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(item => ({
        repo: String((item as ProjectAlias)?.repo ?? '').trim(),
        target: String((item as ProjectAlias)?.target ?? '').trim(),
      }))
      .filter(alias => alias.repo && alias.target)
  } catch {
    return []
  }
}

export function writeAliases(aliases: ProjectAlias[]): void {
  const clean = aliases
    .map(alias => ({ repo: alias.repo.trim(), target: alias.target.trim() }))
    .filter(alias => alias.repo && alias.target)
  if (clean.length === 0) {
    localStorage.removeItem(ALIASES_KEY)
    return
  }
  localStorage.setItem(ALIASES_KEY, JSON.stringify(clean))
}
