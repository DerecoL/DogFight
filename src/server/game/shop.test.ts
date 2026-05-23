import { describe, expect, it } from 'vitest'
import { createChoices } from './shop'

describe('shop choices', () => {
  it('can independently offer relic, upgrade, and potion shops in the same choice set', () => {
    const rolls = [
      0.0, 0.2, 0.4,
      0.1, 0.0,
      0.1, 0.0,
      0.1, 0.0,
    ]
    const rng = () => rolls.shift() ?? 0

    const choices = createChoices(rng, 4, [{ quality: 'BRONZE' }])

    expect(choices).toEqual(['RELIC', 'UPGRADE', 'POTION'])
  })
})
