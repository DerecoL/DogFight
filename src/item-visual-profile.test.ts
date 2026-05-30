import { describe, expect, it } from 'vitest'
import { itemDef } from './server/game/data'
import { itemCardArtManifest, itemVisualProfile } from './item-visual-profile'

describe('item visual profiles', () => {
  it('maps representative equipment effects to shared card art tones', () => {
    expect(itemVisualProfile(itemDef('v3-large-bone-sword')).tone).toBe('damage')
    expect(itemVisualProfile(itemDef('v3-flea-disc')).tone).toBe('poison')
    expect(itemVisualProfile(itemDef('v3-wooden-shield')).tone).toBe('shield')
    expect(itemVisualProfile(itemDef('milk-bone')).tone).toBe('heal')
    expect(itemVisualProfile(itemDef('v4-blood-contract-fang')).tone).toBe('heal')
    expect(itemVisualProfile(itemDef('mutt-old-collar')).tone).toBe('heal')
    expect(itemVisualProfile(itemDef('v3-hydrant-axe')).tone).toBe('weak')
    expect(itemVisualProfile(itemDef('samoyed-absolute-zero')).tone).toBe('freeze')
    expect(itemVisualProfile(itemDef('v3-spiked-vest')).tone).toBe('thorns')
    expect(itemVisualProfile(itemDef('dog-gold-ingot')).tone).toBe('economy')
    expect(itemVisualProfile(itemDef('v4-growing-chew-sword')).tone).toBe('growth')
    expect(itemVisualProfile(itemDef('v4-boom-counter')).tone).toBe('counter')
    expect(itemVisualProfile(itemDef('v3-night-patrol-light')).tone).toBe('trigger')
    expect(itemVisualProfile(itemDef('v5-shattered-tooth-gear')).tone).toBe('counter')
    expect(itemVisualProfile(itemDef('v5-poison-blood-pump')).tone).toBe('poison')
    expect(itemVisualProfile(itemDef('v5-biteback-shield')).tone).toBe('thorns')
    expect(itemVisualProfile(itemDef('v5-barkproof-earmuffs')).tone).toBe('counter')
    expect(itemVisualProfile(itemDef('v5-offbeat-metronome')).tone).toBe('counter')
    expect(itemVisualProfile(itemDef('v5-bitter-kibble')).tone).toBe('poison')
    expect(itemVisualProfile(itemDef('v5-thornbreaker-chew')).tone).toBe('thorns')
  })

  it('exposes tone class names, art paths, and size-aware crop hints', () => {
    const poison = itemVisualProfile(itemDef('v3-flea-disc'))
    expect(poison.className).toBe('item-tone-poison')
    expect(poison.artSrc).toBe('/assets/item-card-art/v3-flea-disc.webp')
    expect(poison.hasCustomArt).toBe(true)
    expect(poison.artAspect).toBe('portrait')

    const fallback = itemVisualProfile(itemDef('spiked-collar'))
    expect(fallback.className).toBe('item-tone-damage')
    expect(fallback.artSrc).toBeNull()
    expect(fallback.hasCustomArt).toBe(false)
    expect(fallback.artAspect).toBe('square')

    expect(itemVisualProfile(itemDef('guard-vest')).artAspect).toBe('wide')
    expect(itemVisualProfile(itemDef('v3-fermented-trash-bin')).artAspect).toBe('panorama')
  })

  it('registers the first batch of custom art assets explicitly', () => {
    expect(Object.keys(itemCardArtManifest).sort()).toEqual([
      'dog-gold-ingot',
      'milk-bone',
      'samoyed-absolute-zero',
      'v3-auto-waterer',
      'v3-fermented-trash-bin',
      'v3-flea-disc',
      'v3-hydrant-axe',
      'v3-large-bone-sword',
      'v3-spiked-vest',
      'v3-wooden-shield',
      'v4-boom-counter',
      'v4-growing-chew-sword',
    ])
  })
})
