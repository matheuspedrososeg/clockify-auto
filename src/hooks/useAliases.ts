import { useState } from 'react'
import type { ProjectAlias } from '../utils/aliasStorage'
import { readAliases, writeAliases } from '../utils/aliasStorage'

export function useAliases() {
  const [aliases, setAliases] = useState<ProjectAlias[]>(readAliases)

  function save(next: ProjectAlias[]) {
    const clean = next
      .map(alias => ({ repo: alias.repo.trim(), target: alias.target.trim() }))
      .filter(alias => alias.repo && alias.target)
    writeAliases(clean)
    setAliases(clean)
  }

  return { aliases, save }
}

export type AliasesVM = ReturnType<typeof useAliases>
