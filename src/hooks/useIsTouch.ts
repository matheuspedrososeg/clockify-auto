import { useSyncExternalStore } from 'react'

const QUERY = '(hover: none) and (pointer: coarse)'

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener('change', onChange)
  return () => mql.removeEventListener('change', onChange)
}

function getSnapshot(): boolean {
  return window.matchMedia(QUERY).matches
}

export function useIsTouch(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
