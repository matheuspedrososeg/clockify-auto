import { createContext } from 'react'
import type { Dictionary, Lang } from './dictionaries'

export interface I18nContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
  t: Dictionary
}

export const I18nContext = createContext<I18nContextValue | null>(null)
