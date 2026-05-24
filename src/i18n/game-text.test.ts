import { describe, expect, it } from 'vitest'
import { ALL_ITEM_DEFS, DOGS, RELIC_DEFS } from '../server/game/data'
import { TERM_DEFS } from '../shared/rule-terms'
import {
  localizeDog,
  localizeItemDef,
  localizeRelicDef,
  localizeRuleTerm,
} from './game-text'

const chineseText = /[\u3400-\u9fff]/

describe('game text localization', () => {
  it('has English text for every item definition', () => {
    for (const def of ALL_ITEM_DEFS) {
      const text = localizeItemDef(def, 'en-US')

      expect(text.name, def.id).toBeTruthy()
      expect(text.description, def.id).toBeTruthy()
      expect(text.name, def.id).not.toMatch(chineseText)
      expect(text.description, def.id).not.toMatch(chineseText)
    }
  })

  it('has English text for every relic definition', () => {
    for (const def of RELIC_DEFS) {
      const text = localizeRelicDef(def, 'en-US')

      expect(text.name, def.id).toBeTruthy()
      expect(text.description, def.id).toBeTruthy()
      expect(text.name, def.id).not.toMatch(chineseText)
      expect(text.description, def.id).not.toMatch(chineseText)
    }
  })

  it('has English text for every dog and rule term', () => {
    for (const dogType of Object.keys(DOGS) as Array<keyof typeof DOGS>) {
      const dog = localizeDog(dogType, 'en-US')

      expect(dog.name, dogType).toBeTruthy()
      expect(dog.trait, dogType).toBeTruthy()
      expect(dog.name, dogType).not.toMatch(chineseText)
      expect(dog.trait, dogType).not.toMatch(chineseText)
    }

    for (const term of TERM_DEFS) {
      const localized = localizeRuleTerm(term.term, 'en-US')

      expect(localized.term, term.term).toBeTruthy()
      expect(localized.description, term.term).toBeTruthy()
      expect(localized.term, term.term).not.toMatch(chineseText)
      expect(localized.description, term.term).not.toMatch(chineseText)
    }
  })

  it('keeps Chinese text as the canonical default display', () => {
    const firstItem = ALL_ITEM_DEFS[0]
    const firstRelic = RELIC_DEFS[0]

    expect(localizeItemDef(firstItem, 'zh-CN').name).toBe(firstItem.name)
    expect(localizeRelicDef(firstRelic, 'zh-CN').name).toBe(firstRelic.name)
  })
})
