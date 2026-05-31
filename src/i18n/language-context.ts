import { createContext } from 'react'
import type { uiText } from './dictionary'
import type { Language } from './types'

export type TranslationKey = keyof typeof uiText

export type LanguageContextValue = {
  language: Language
  setLanguage: (language: Language) => void
  t: (key: TranslationKey) => string
}

export const LanguageContext = createContext<LanguageContextValue | null>(null)
