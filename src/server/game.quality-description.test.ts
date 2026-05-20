import { describe, expect, it } from 'vitest'
import { ALL_ITEM_DEFS, growthDamageBase, growthDamageStep, itemDefForQuality } from './game/data'
import { ITEM_QUALITIES, qualityAmountFrom } from './game/quality'

function numbers(defId: string, quality: 'GOLD' | 'DIAMOND') {
  return itemDefForQuality(defId, quality).description?.match(/\d+/g) ?? []
}

describe('quality-adjusted item descriptions', () => {
  it('shows upgraded blood mad fang damage in item details', () => {
    expect(numbers('v3-blood-mad-fang', 'GOLD')).toContain('14')
    expect(numbers('v3-blood-mad-fang', 'DIAMOND')).toContain('20')
  })

  it('shows upgraded shield and poison values for advanced equipment', () => {
    expect(numbers('v3-golden-kennel', 'DIAMOND')).toContain('14')
    expect(numbers('v3-golden-kennel', 'DIAMOND')).not.toContain('84')
    expect(numbers('v3-fermented-trash-bin', 'DIAMOND')).toContain('17')
  })

  it('keeps shiba poison fixed instead of scaling by quality', () => {
    expect(numbers('shiba-poison', 'DIAMOND')).toContain('6')
    expect(numbers('shiba-poison', 'DIAMOND')).not.toContain('20')
  })

  it('describes shiba break size triggers and its repeat chance', () => {
    const description = itemDefForQuality('shiba-break', 'DIAMOND').description

    expect(description).toContain('按照其容量触发')
    expect(description).toContain('50% 概率额外触发 1 次')
  })

  it('describes dog house stealing real buffs while excluding shield', () => {
    const description = itemDefForQuality('dog-house', 'BRONZE').description

    expect(description).toContain('偷取敌方 1 层增益')
    expect(description).toContain('护盾不算增益')
  })

  it('describes giant bone fury as a stacking attack damage buff', () => {
    const description = itemDefForQuality('giant-bone', 'BRONZE').description

    expect(description).toContain('50% 概率触发【激昂】')
    expect(description).toContain('所有攻击伤害 +1')
    expect(description).toContain('可叠加')
  })

  it('shows upgraded base effects for described equipment and class rewards', () => {
    expect(numbers('v3-large-bone-sword', 'DIAMOND')).toContain('27')
    expect(numbers('v3-auto-waterer', 'DIAMOND')).toContain('27')
    expect(numbers('samoyed-soft-fur', 'DIAMOND')).toContain('27')
    expect(numbers('shiba-speed-katana', 'DIAMOND')).toContain('20')
    expect(numbers('shiba-great-katana', 'DIAMOND')).toContain('27')
    expect(numbers('shiba-swallow-katana', 'DIAMOND')).toContain('17')
  })

  it('uses effective item values in every quality-adjusted item description', () => {
    for (const def of ALL_ITEM_DEFS) {
      if (def.effect.amount <= 0) continue
      if (def.advancedEffect === 'GROWTH_DAMAGE') continue
      for (const quality of ITEM_QUALITIES) {
        const effective = qualityAmountFrom(def.effect.amount, quality, def.effect.qualityBase)
        expect(itemDefForQuality(def.id, quality).description, `${def.id} ${quality}`).toContain(String(effective))
      }
    }
  })

  it('uses growth-specific values in growth equipment descriptions', () => {
    for (const quality of ITEM_QUALITIES) {
      const description = itemDefForQuality('v4-growing-chew-sword', quality).description
      expect(description, `growth ${quality} base`).toContain(String(growthDamageBase(quality)))
      expect(description, `growth ${quality} step`).toContain(String(growthDamageStep(quality)))
    }
  })
})
