import type { Language } from './types'

export const SUPPORTED_LANGUAGES: Language[] = ['zh-CN', 'en-US']
export const DEFAULT_LANGUAGE: Language = 'zh-CN'
export const LANGUAGE_STORAGE_KEY = 'dogfight-language'

export function isLanguage(value: unknown): value is Language {
  return value === 'zh-CN' || value === 'en-US'
}

export function normalizeLanguage(value: unknown): Language {
  return isLanguage(value) ? value : DEFAULT_LANGUAGE
}

export function readStoredLanguage(): Language {
  if (typeof localStorage === 'undefined') return DEFAULT_LANGUAGE
  return normalizeLanguage(localStorage.getItem(LANGUAGE_STORAGE_KEY))
}

export function writeStoredLanguage(language: Language) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
}
