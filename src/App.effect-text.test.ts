import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')

describe('item card effect text', () => {
  it('labels shield utility equipment as shield instead of damage', () => {
    expect(app).toContain("def.effect.type === 'UTILITY'")
    expect(app).toContain("def.tags.includes('shield')")
    expect(app).toContain("'护盾'")
  })

  it('keeps poison utility equipment from being labeled as direct damage', () => {
    expect(app).toContain("def.tags.includes('poison')")
    expect(app).toContain("'中毒'")
  })
})
