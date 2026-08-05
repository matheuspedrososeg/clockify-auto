const FLAG_KEY = 'remember_api_keys'

export type StoredKeyName = 'gemini_api_key' | 'claude_api_key' | 'clockify_api_key'

const ALL_KEYS: StoredKeyName[] = ['gemini_api_key', 'claude_api_key', 'clockify_api_key']

/** On by default, so opting out has to be stored explicitly rather than as an absent flag. */
export function isRememberEnabled(): boolean {
  return localStorage.getItem(FLAG_KEY) !== '0'
}

/** Opting out wipes whatever was already persisted, not just the flag. */
export function setRememberEnabled(enabled: boolean): void {
  if (enabled) {
    localStorage.setItem(FLAG_KEY, '1')
    return
  }
  localStorage.setItem(FLAG_KEY, '0')
  ALL_KEYS.forEach(name => localStorage.removeItem(name))
}

export function readKey(name: StoredKeyName): string {
  return isRememberEnabled() ? localStorage.getItem(name) ?? '' : ''
}

export function writeKey(name: StoredKeyName, value: string): void {
  if (!isRememberEnabled()) return
  if (value) localStorage.setItem(name, value)
  else localStorage.removeItem(name)
}
