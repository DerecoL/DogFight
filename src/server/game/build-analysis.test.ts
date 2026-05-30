import { describe, expect, it } from 'vitest'
import { BUILD_ARCHETYPE_IDS, type BuildArchetypeId } from './build-archetypes'
import { itemDef, relicDef } from './data'
import { analyzeBuildArchetypes } from './build-analysis'

function scoreFor(scores: { archetype: BuildArchetypeId; score: number }[], archetype: BuildArchetypeId) {
  return scores.find((entry) => entry.archetype === archetype)?.score ?? 0
}

describe('BD build analysis', () => {
  it('returns a stable score row for every BD route', () => {
    const analysis = analyzeBuildArchetypes({})

    expect(analysis.scores.map((entry) => entry.archetype)).toEqual([...BUILD_ARCHETYPE_IDS])
    expect(analysis.scores.every((entry) => entry.score === 0)).toBe(true)
    expect(analysis.topArchetypes).toEqual([])
  })

  it('scores dog identity, items, and relics without forcing a single route', () => {
    const analysis = analyzeBuildArchetypes({
      dogType: 'SHIBA',
      itemDefs: [
        itemDef('training-disc'),
        itemDef('v4-boom-counter'),
        itemDef('v4-blood-contract-fang'),
      ],
      relicDefs: [relicDef('midas-right')],
    })

    expect(scoreFor(analysis.scores, 'SMALL_DICE')).toBeGreaterThan(0)
    expect(scoreFor(analysis.scores, 'MULTI')).toBeGreaterThan(0)
    expect(scoreFor(analysis.scores, 'BOOM_FREQUENCY')).toBeGreaterThan(0)
    expect(scoreFor(analysis.scores, 'LIFESTEAL_GROWTH')).toBeGreaterThan(0)
    expect(analysis.topArchetypes.length).toBeGreaterThan(1)
  })

  it('keeps evidence for why a route scored', () => {
    const analysis = analyzeBuildArchetypes({
      dogType: 'FROG',
      itemDefs: [itemDef('frog-lily-pump'), itemDef('training-disc')],
    })
    const reservoir = analysis.scores.find((entry) => entry.archetype === 'RESERVOIR')

    expect(reservoir?.score).toBeGreaterThan(0)
    expect(reservoir?.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: 'DOG', sourceId: 'FROG' }),
        expect.objectContaining({ source: 'ITEM', sourceId: 'frog-lily-pump' }),
      ]),
    )
  })

  it('does not export helpers that validate or reject a player build', async () => {
    const module = await import('./build-analysis')

    expect('validateBuild' in module).toBe(false)
    expect('isBuildAllowed' in module).toBe(false)
    expect('filterItemsForBuild' in module).toBe(false)
  })
})
