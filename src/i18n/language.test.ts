import { describe, expect, it, vi } from 'vitest'
import {
  LANGUAGE_STORAGE_KEY,
  isLanguage,
  normalizeLanguage,
  readStoredLanguage,
  writeStoredLanguage,
} from './language'

describe('language utilities', () => {
  it('accepts only supported languages', () => {
    expect(isLanguage('zh-CN')).toBe(true)
    expect(isLanguage('en-US')).toBe(true)
    expect(isLanguage('fr-FR')).toBe(false)
  })

  it('falls back to Chinese for invalid values', () => {
    expect(normalizeLanguage('en-US')).toBe('en-US')
    expect(normalizeLanguage('bad-value')).toBe('zh-CN')
    expect(normalizeLanguage(null)).toBe('zh-CN')
  })

  it('reads and writes language selection from localStorage', () => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      clear: () => store.clear(),
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
    })
    localStorage.clear()

    expect(LANGUAGE_STORAGE_KEY).toBe('dogfight-language')
    expect(readStoredLanguage()).toBe('zh-CN')

    writeStoredLanguage('en-US')

    expect(localStorage.getItem('dogfight-language')).toBe('en-US')
    expect(readStoredLanguage()).toBe('en-US')
  })
})
