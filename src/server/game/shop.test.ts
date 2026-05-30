import { describe, expect, it } from 'vitest'
import { createChoices } from './shop'

describe('shop choices', () => {
  it('can independently offer relic, tiered upgrade, and potion shops in the same choice set', () => {
    const rolls = [
      0.0, 0.2, 0.4,
      0.1, 0.0,
      0.1, 0.0, 0.0,
      0.1, 0.0,
    ]
    const rng = () => rolls.shift() ?? 0

    const choices = createChoices(rng, 4, [{ quality: 'BRONZE' }])

    expect(choices).toEqual(['RELIC', 'UPGRADE_SILVER', 'POTION'])
  })

  it('raises the chance of higher upgrade shops as rounds increase', () => {
    const earlyRolls = [
      0.0, 0.2, 0.4,
      0.9,
      0.1, 0.99, 0.0,
      0.9,
    ]
    const lateRolls = [
      0.0, 0.2, 0.4,
      0.9,
      0.1, 0.99, 0.0,
      0.9,
    ]

    const earlyChoices = createChoices(() => earlyRolls.shift() ?? 0, 4, [{ quality: 'BRONZE' }])
    const lateChoices = createChoices(() => lateRolls.shift() ?? 0, 10, [{ quality: 'BRONZE' }])

    expect(earlyChoices).toContain('UPGRADE_SILVER')
    expect(lateChoices).toContain('UPGRADE_DIAMOND')
  })

  it('only offers upgrade tiers that can target the owned item qualities', () => {
    const rolls = [
      0.0, 0.2, 0.4,
      0.9,
      0.1, 0.0, 0.0,
      0.9,
    ]
    const choices = createChoices(() => rolls.shift() ?? 0, 10, [{ quality: 'GOLD' }])

    expect(choices).toContain('UPGRADE_DIAMOND')
    expect(choices).not.toContain('UPGRADE_SILVER')
    expect(choices).not.toContain('UPGRADE_GOLD')
  })
})
