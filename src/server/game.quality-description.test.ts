import { describe, expect, it } from 'vitest'
import { ALL_ITEM_DEFS, DOGS, growthDamageBase, growthDamageStep, itemDefForQuality, relicDefForQuality, relicEquipmentEffectScale } from './game/data'
import { ITEM_QUALITIES, qualityAmountFrom } from './game/quality'

function numbers(defId: string, quality: 'GOLD' | 'DIAMOND') {
  return itemDefForQuality(defId, quality).description?.match(/\d+/g) ?? []
}

describe('quality-adjusted item descriptions', () => {
  it('keeps fourth-dimensional kennel from reducing equipment effects', () => {
    const description = relicDefForQuality('v3-fourth-dimensional-kennel', 'DIAMOND').description

    expect(relicEquipmentEffectScale('v3-fourth-dimensional-kennel', 'DIAMOND')).toBe(1)
    expect(description).not.toContain('降低')
    expect(description).not.toContain('15%')
  })

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
    expect(description).toContain('【护盾】不算增益')
  })

  it('links rule terms without restating their definitions in item and dog descriptions', () => {
    expect(DOGS.EMPEROR.trait).toContain('【天命数字】')
    expect(DOGS.EMPEROR.trait).not.toContain('幸运数字')
    expect(DOGS.FROG.trait).toContain('【蓄水】')
    expect(DOGS.FROG.trait).not.toContain('初始水位')
    expect(DOGS.FROG.trait).not.toContain('间隔 =')

    const description = itemDefForQuality('giant-bone', 'BRONZE').description
    expect(description).toContain('50% 概率触发【激昂】')
    expect(description).not.toContain('所有攻击伤害 +1')
    expect(description).not.toContain('可叠加')

    expect(itemDefForQuality('v3-blood-mad-fang', 'GOLD').description).toContain('【吸血】')
    expect(itemDefForQuality('v3-blood-mad-fang', 'GOLD').description).not.toContain('100%')
    expect(itemDefForQuality('v4-blood-contract-fang', 'GOLD').description).not.toContain('按实际造成的生命伤害')
    expect(itemDefForQuality('patting-bear', 'SILVER').description).not.toContain('直接攻击伤害 +')
    expect(itemDefForQuality('lotus-sea', 'GOLD').description).not.toContain('最多提高到')
    expect(itemDefForQuality('lucky-paw', 'BRONZE').description).toContain('【多重】 2')
    expect(itemDefForQuality('lucky-paw', 'BRONZE').description).not.toContain('命中时总共完整触发')
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
