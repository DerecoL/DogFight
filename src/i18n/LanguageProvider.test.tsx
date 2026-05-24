import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const main = readFileSync(new URL('../main.tsx', import.meta.url), 'utf8')
const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8')

describe('language provider wiring', () => {
  it('wraps the app in LanguageProvider', () => {
    expect(main).toContain('LanguageProvider')
    expect(main).toContain('<LanguageProvider>')
  })

  it('renders a language selector using the persisted language key', () => {
    expect(app).toContain('function LanguageSelector')
    expect(app).toContain('dogfight-language')
    expect(app).toContain('setLanguage')
  })
})
