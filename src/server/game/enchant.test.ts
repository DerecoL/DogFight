import { describe, expect, it } from 'vitest'
import { createEnchantChoices, enchantmentText } from './enchant'

describe('enchantment choices', () => {
  it('creates three fully described deterministic enchant choices', () => {
    const first = createEnchantChoices('enchant-seed', 4)
    const second = createEnchantChoices('enchant-seed', 4)

    expect(first).toEqual(second)
    expect(first).toHaveLength(3)
    expect(new Set(first.map((choice) => choice.id)).size).toBe(3)
    expect(first.every((choice) => choice.description === enchantmentText(choice.enchant))).toBe(true)
    expect(first.every((choice) => choice.description.length > 0)).toBe(true)
  })

  it('pre-rolls concrete dice, direction, effect type, and values for every choice', () => {
    const choices = createEnchantChoices('specific-enchant-seed', 8)

    for (const choice of choices) {
      expect(choice.enchant.kind).toBeTruthy()
      expect(choice.description).not.toContain('随机')
      if (choice.enchant.kind === 'EXTRA_DICE') expect(choice.enchant.dice.length).toBeGreaterThan(0)
      if ('amount' in choice.enchant) expect(choice.enchant.amount).toBeGreaterThan(0)
      if ('target' in choice.enchant) expect(['LEFT', 'RIGHT', 'ADJACENT']).toContain(choice.enchant.target)
    }
  })
})
