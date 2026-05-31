import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { text } from './dictionary'
import { applyLegacyDomLocalization } from './legacy-dom-localization'
import { LanguageContext, type LanguageContextValue } from './language-context'
import { readStoredLanguage, writeStoredLanguage } from './language'
import type { Language } from './types'

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
