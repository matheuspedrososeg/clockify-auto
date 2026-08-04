import { useState } from 'react'
import type { Routine } from '../utils/routineStorage'
import { readRoutine, writeRoutine } from '../utils/routineStorage'

export function useRoutine() {
  const [routine, setRoutine] = useState<Routine>(readRoutine)

  function save(next: Routine) {
    writeRoutine(next)
    setRoutine(readRoutine())
  }

  return { routine, save }
}

export type RoutineVM = ReturnType<typeof useRoutine>
