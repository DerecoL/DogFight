import { describe, expect, it } from 'vitest'
import { upgradeEnchant } from './quality'
import type { Enchantment } from './types'

describe('upgrade enchantment inheritance', () => {
  const targetEnchant: Enchantment = { kind: 'BASE_EFFECT', effect: 'DAMAGE', amount: 10, label: 'target enchant' }
  const sourceEnchant: Enchantment = { kind: 'BASE_EFFECT', effect: 'HEAL', amount: 12, label: 'source enchant' }

  it('keeps the target enchantment when both upgraded items have enchantments', () => {
    expect(upgradeEnchant(targetEnchant, sourceEnchant)).toBe(targetEnchant)
  })

  it('inherits the source enchantment when only the consumed item has one', () => {
    expect(upgradeEnchant(null, sourceEnchant)).toBe(sourceEnchant)
  })
})
