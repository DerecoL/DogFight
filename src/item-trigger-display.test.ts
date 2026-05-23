import { describe, expect, it } from 'vitest'
import { itemTriggerCountLabel, triggerDiceLabel } from './item-trigger-display'

const item = (dice: number[], advancedEffect = 'NONE') => ({ dice, advancedEffect })

describe('item trigger dice display', () => {
  it('keeps all six dice visible when an item triggers from every roll face', () => {
    expect(triggerDiceLabel(item([1, 2, 3, 4, 5, 6], 'POISON_ON_ROLL'))).toBe('1/2/3/4/5/6')
  })

  it('hides dice for equipment whose effect is driven by passive, opening, or event hooks', () => {
    expect(triggerDiceLabel(item([1, 2, 3, 4, 5, 6], 'POST_BATTLE_LARGE_ITEM'))).toBeNull()
    expect(triggerDiceLabel(item([1, 6], 'BOOM_COUNTER'))).toBeNull()
  })

  it('keeps normal face-triggered items visible', () => {
    expect(triggerDiceLabel(item([4, 5, 6]))).toBe('4/5/6')
  })

  it('shifts visible trigger dice up when carrot is active', () => {
    expect(triggerDiceLabel(item([4, 5, 6]), [{ def: { effect: 'SHIFT_TRIGGER_DICE_UP' } }])).toBe('1/5/6')
  })

  it('shifts visible trigger dice down when tissue is active', () => {
    expect(triggerDiceLabel(item([1, 2, 3]), [{ def: { effect: 'SHIFT_TRIGGER_DICE_DOWN' } }])).toBe('1/2/6')
  })

  it('applies carrot then tissue when both remapping relics are active', () => {
    expect(triggerDiceLabel(item([1, 6]), [
      { def: { effect: 'SHIFT_TRIGGER_DICE_UP' } },
      { def: { effect: 'SHIFT_TRIGGER_DICE_DOWN' } },
    ])).toBe('1/6')
  })
})

describe('battle item trigger count display', () => {
  it('uses the latest per-item trigger count from structured battle events', () => {
    const events = [
      { kind: 'ITEM', actor: 'player', itemId: 'fang', itemTriggerCount: 1 },
      { kind: 'ITEM', actor: 'player', itemId: 'fang', itemTriggerCount: 1 },
      { kind: 'ITEM', actor: 'player', itemId: 'bite', itemTriggerCount: 1 },
      { kind: 'ITEM', actor: 'player', itemId: 'fang', itemTriggerCount: 2 },
    ]

    expect(itemTriggerCountLabel(events, 'player', 'fang', 2)).toBe('x1')
    expect(itemTriggerCountLabel(events, 'player', 'fang', 3)).toBe('x2')
  })

  it('falls back to counting unique item event groups when older battles have no trigger count', () => {
    const events = [
      { kind: 'ITEM', actor: 'player', itemId: 'fang', time: 1, roll: 6, effectType: 'DAMAGE' },
      { kind: 'ITEM', actor: 'player', itemId: 'fang', time: 1, roll: 6, effectType: 'UTILITY' },
      { kind: 'ITEM', actor: 'opponent', itemId: 'fang', time: 1, roll: 6, effectType: 'DAMAGE' },
      { kind: 'ITEM', actor: 'player', itemId: 'fang', time: 2, roll: 1, effectType: 'DAMAGE' },
    ]

    expect(itemTriggerCountLabel(events, 'player', 'fang', 3)).toBe('x2')
  })
})
