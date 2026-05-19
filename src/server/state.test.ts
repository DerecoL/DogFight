import { describe, expect, it } from 'vitest'
import { publicRelics } from './state'

describe('public run relic data', () => {
  it('returns quality-adjusted relic descriptions for upgraded relics', () => {
    const relics = publicRelics({
      relics: JSON.stringify([{ id: 'r1', relicId: 'midas-left', quality: 'GOLD', slot: 0 }]),
    })

    expect(relics[0].def.description).toContain('75%')
  })
})
