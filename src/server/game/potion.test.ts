import { describe, expect, it } from 'vitest'
import { applyPotionToBaseDice, createPotionChoices, potionChoiceText } from './potion'
import type { PotionChoice } from './types'

describe('potion choices', () => {
  it('creates three deterministic choices with concrete text', () => {
    const first = createPotionChoices('potion-seed')
    const second = createPotionChoices('potion-seed')

    expect(first).toEqual(second)
    expect(first).toHaveLength(3)
    expect(first.every((choice) => choice.description === potionChoiceText(choice))).toBe(true)
    expect(first.every((choice) => choice.dice.length > 0)).toBe(true)
  })

  it('adds dice without duplicate trigger points', () => {
    const choice: PotionChoice = { id: 'potion', category: 'ADD_ONE', dice: [1], description: '增加 1 点触发' }

    expect(applyPotionToBaseDice([1, 2], choice)).toEqual([1, 2])
  })

  it('replaces base dice for range and all-dice potions', () => {
    const range: PotionChoice = { id: 'range', category: 'REPLACE_RANGE', dice: [1, 6], description: '改为极值 1/6 触发' }
    const all: PotionChoice = { id: 'all', category: 'REPLACE_ALL', dice: [1, 2, 3, 4, 5, 6], description: '改为全点数触发' }

    expect(applyPotionToBaseDice([2, 3], range)).toEqual([1, 6])
    expect(applyPotionToBaseDice([2, 3], all)).toEqual([1, 2, 3, 4, 5, 6])
  })
})
