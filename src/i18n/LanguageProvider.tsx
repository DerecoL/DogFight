import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { text, type uiText } from './dictionary'
import { applyLegacyDomLocalization } from './legacy-dom-localization'
import { readStoredLanguage, writeStoredLanguage } from './language'
import type { Language } from './types'

type TranslationKey = keyof typeof uiText

type LanguageContextValue = {
  language: Language
  setLanguage: (language: Language) => void
  t: (key: TranslationKey) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => readStoredLanguage())

  useEffect(() => applyLegacyDomLocalization(language), [language])

  const value = useMemo<LanguageContextValue>(() => {
    const setLanguage = (nextLanguage: Language) => {
      writeStoredLanguage(nextLanguage)
      setLanguageState(nextLanguage)
    }

    return {
      language,
      setLanguage,
      t: (key) => text(key, language),
    }
  }, [language])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const value = useContext(LanguageContext)
  if (!value) throw new Error('useLanguage must be used within LanguageProvider')
  return value
}
