import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')

describe('app localization wiring', () => {
  it('uses localization helpers at the main display boundaries', () => {
    for (const helper of [
      'localizeItemDef(',
      'localizeRelicDef(',
      'localizeDog(',
      'localizeQuality(',
      'localizeShopType(',
      'localizeBattleEventText(',
      'localizeFeedbackText(',
      'localizeServerError(',
    ]) {
      expect(app).toContain(helper)
    }
  })
})
