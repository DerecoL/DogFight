import { describe, expect, it } from 'vitest'
import { resolveWinnerByHealthPercent, simulateBattle } from './game/battle'
import { CLASS_REWARD_DEFS, DOGS, RELIC_DEFS, TERM_DEFS, itemDef, itemDefForQuality, relicDefForQuality, shopPool } from './game/data'
import { canPlace, findSlot, triggerOrder } from './game/grid'
import { createRng } from './game/rng'
import { createChoices, createShop, itemPurchaseValue, itemSellValue } from './game/shop'
import type { FighterSnapshot, GameItem, RelicInstance } from './game/types'
import { makeNewRunShop } from './state'

function baseItems(): GameItem[] {
  return [1, 2, 3, 4, 5, 6].map((n, index) => ({ id: `i${n}`, defId: `starter-${n}`, quality: 'BRONZE' as const, area: 'EQUIPMENT' as const, x: index, y: 0 }))
}

function equipment(id: string, defId: string, x: number, quality: GameItem['quality'] = 'DIAMOND'): GameItem {
  return { id, defId, quality, area: 'EQUIPMENT', x, y: 0 }
}

function repeatedEquipment(defId: string, count: number, quality: GameItem['quality'] = 'DIAMOND'): GameItem[] {
  return Array.from({ length: count }, (_, index) => equipment(`${defId}-${index}`, defId, index * 2, quality))
}

function boomCounterTestItems(quality: GameItem['quality']): GameItem[] {
  return [
    { id: 'counter', defId: 'v4-boom-counter', quality, area: 'EQUIPMENT', x: 0, y: 0 },
    ...Array.from({ length: 11 }, (_, index) => ({
      id: `extreme-${index}`,
      defId: 'v3-chew-scratch-post',
      quality: 'BRONZE' as const,
      area: 'EQUIPMENT' as const,
      x: index + 1,
      y: 0,
    })),
  ]
}

function lateGameFighter(name: string, dogType: FighterSnapshot['dogType'], items: GameItem[]): FighterSnapshot {
  return { name, dogType, wins: 0, losses: 0, round: 6, items }
}

function eventAtOrBefore(result: ReturnType<typeof simulateBattle>, time: number) {
  return [...result.events].reverse().find((event) => event.time <= time) ?? result.events[0]
}

describe('grid placement', () => {
  it('rejects overlaps and out-of-bounds placement', () => {
    const items = baseItems()
    const moving = { id: 'new', defId: 'giant-bone', quality: 'BRONZE' as const, area: 'EQUIPMENT' as const, x: 0, y: 0 }
    expect(canPlace(items, moving, 'EQUIPMENT', 0, 0)).toBe(false)
    expect(canPlace(items, moving, 'EQUIPMENT', 8, 0)).toBe(true)
    expect(canPlace(items, moving, 'EQUIPMENT', 9, 0)).toBe(false)
    expect(canPlace(items, moving, 'EQUIPMENT', 8, 1)).toBe(false)
    expect(findSlot(items, 'giant-bone', 'BAG')).toEqual({ x: 0, y: 0 })
  })

  it('keeps bag placement to one horizontal row', () => {
    const items: GameItem[] = []
    const moving = { id: 'new', defId: 'giant-bone', quality: 'BRONZE' as const, area: 'BAG' as const, x: 0, y: 0 }
    expect(canPlace(items, moving, 'BAG', 8, 0)).toBe(true)
    expect(canPlace(items, moving, 'BAG', 9, 0)).toBe(false)
    expect(canPlace(items, moving, 'BAG', 8, 1)).toBe(false)
  })

  it('allows the equipment row to expand to a thirteenth slot', () => {
    const items = Array.from({ length: 12 }, (_, index) => ({
      id: `filled-${index}`,
      defId: 'starter-1',
      quality: 'BRONZE' as const,
      area: 'EQUIPMENT' as const,
      x: index,
      y: 0,
    }))
    const moving = { id: 'new', defId: 'starter-1', quality: 'BRONZE' as const, area: 'EQUIPMENT' as const, x: 12, y: 0 }

    expect(canPlace(items, moving, 'EQUIPMENT', 12, 0)).toBe(false)
    expect(canPlace(items, moving, 'EQUIPMENT', 12, 0, { equipmentWidth: 13 })).toBe(true)
    expect(findSlot(items, 'starter-1', 'EQUIPMENT', { equipmentWidth: 13 })).toEqual({ x: 12, y: 0 })
  })

  it('orders equipment from left to right, then top to bottom within a column', () => {
    const ordered = triggerOrder([
      { id: 'b', defId: 'starter-1', quality: 'BRONZE', area: 'EQUIPMENT', x: 1, y: 0 },
      { id: 'a', defId: 'starter-1', quality: 'BRONZE', area: 'EQUIPMENT', x: 0, y: 2 },
      { id: 'c', defId: 'starter-1', quality: 'BRONZE', area: 'BAG', x: 0, y: 0 },
    ])
    expect(ordered.map((item) => item.id)).toEqual(['a', 'b'])
  })
})

describe('shop generation', () => {
  it('uses a per-run seed for the initial shop even for the same user', () => {
    const signature = (offers: ReturnType<typeof makeNewRunShop>) =>
      offers.map(({ defId, price, discount, quality }) => ({ defId, price, discount, quality }))

    expect(signature(makeNewRunShop('same-user', 'first-run'))).not.toEqual(
      signature(makeNewRunShop('same-user', 'second-run')),
    )
  })

  it('creates five filtered offers with progressive-compatible prices', () => {
    const offers = createShop('LARGE', createRng('shop-test'))
    expect(offers).toHaveLength(5)
    expect(offers.every((offer) => offer.price >= 1)).toBe(true)
  })

  it('does not offer gold or diamond equipment before round 3', () => {
    const offers = createShop('LARGE', () => 0.7, 2)

    expect(offers.every((offer) => offer.quality === 'BRONZE' || offer.quality === 'SILVER')).toBe(true)
  })

  it('does not offer diamond equipment before round 6', () => {
    const offers = createShop('LARGE', () => 0.99, 5)

    expect(offers.every((offer) => offer.quality !== 'DIAMOND')).toBe(true)
  })

  it('prices direct diamond equipment at its exact quality value without purchase markup', () => {
    const [offer] = createShop('LARGE', () => 0.99, 6)

    expect(offer.defId).toBe('v3-golden-kennel')
    expect(offer.quality).toBe('DIAMOND')
    expect(offer.price).toBe(88)
  })

  it('values upgraded equipment by each item price doubled per quality before selling at half', () => {
    const smallBite = itemDef('small-bite')
    const luckyPaw = itemDef('lucky-paw')

    expect(itemPurchaseValue(smallBite, 'BRONZE')).toBe(3)
    expect(itemPurchaseValue(smallBite, 'SILVER')).toBe(6)
    expect(itemPurchaseValue(smallBite, 'GOLD')).toBe(12)
    expect(itemPurchaseValue(smallBite, 'DIAMOND')).toBe(24)
    expect(itemSellValue(smallBite, 'BRONZE')).toBe(1)
    expect(itemSellValue(smallBite, 'SILVER')).toBe(3)
    expect(itemSellValue(smallBite, 'GOLD')).toBe(6)
    expect(itemSellValue(smallBite, 'DIAMOND')).toBe(12)

    expect(itemPurchaseValue(luckyPaw, 'BRONZE')).toBe(4)
    expect(itemPurchaseValue(luckyPaw, 'SILVER')).toBe(8)
    expect(itemPurchaseValue(luckyPaw, 'GOLD')).toBe(16)
    expect(itemPurchaseValue(luckyPaw, 'DIAMOND')).toBe(32)
    expect(itemSellValue(luckyPaw, 'BRONZE')).toBe(2)
    expect(itemSellValue(luckyPaw, 'SILVER')).toBe(4)
    expect(itemSellValue(luckyPaw, 'GOLD')).toBe(8)
    expect(itemSellValue(luckyPaw, 'DIAMOND')).toBe(16)

    const bloodFang = itemDef('v3-blood-mad-fang')
    expect(itemPurchaseValue(bloodFang, 'GOLD')).toBe(48)
    expect(itemSellValue(bloodFang, 'GOLD')).toBe(24)
    expect(itemPurchaseValue(bloodFang, 'DIAMOND')).toBe(96)
    expect(itemSellValue(bloodFang, 'DIAMOND')).toBe(48)
  })

  it('adds per-instance sell bonuses on top of base sell value', () => {
    const silverIngot = itemDef('dog-silver-ingot')

    expect(itemPurchaseValue(silverIngot, 'BRONZE')).toBe(1)
    expect(itemSellValue(silverIngot, 'BRONZE')).toBe(0)
    expect(itemSellValue(silverIngot, 'BRONZE', 3)).toBe(3)
    expect(itemSellValue(silverIngot, 'SILVER', 6)).toBe(7)
  })

  it('describes silver ingots as gaining one sell value after each battle', () => {
    expect(itemDefForQuality('dog-silver-ingot', 'BRONZE').description).toContain('+1')
  })

  it('can offer relic and upgrade shops independently after round 4 when equipment can improve', () => {
    const rolls = [0, 0.2, 0.4, 0, 0, 0, 0, 0]
    const choices = createChoices(() => rolls.shift() ?? 0, 4, [
      { id: 'upgrade-me', defId: 'starter-1', quality: 'BRONZE', area: 'EQUIPMENT', x: 0, y: 0 },
    ])

    expect(choices).toContain('RELIC')
    expect(choices).toContain('UPGRADE_SILVER')
    expect(choices).toHaveLength(3)
  })

  it('does not offer the upgrade shop when every item is already diamond', () => {
    const rolls = [0, 0.2, 0.4, 0, 0, 0, 0]
    const choices = createChoices(() => rolls.shift() ?? 0, 4, [
      { id: 'maxed', defId: 'starter-1', quality: 'DIAMOND', area: 'EQUIPMENT', x: 0, y: 0 },
    ])

    expect(choices).toContain('RELIC')
    expect(choices).not.toContain('UPGRADE_SILVER')
    expect(choices).not.toContain('UPGRADE_GOLD')
    expect(choices).not.toContain('UPGRADE_DIAMOND')
  })
})

describe('dog and item definitions', () => {
  it('classifies 1-slot as small, 2-3-slot as medium, and 4-slot as large', () => {
    expect(itemDef('small-bite')).toMatchObject({ size: 1 })
    expect(itemDef('rubber-ball')).toMatchObject({ size: 2 })
    expect(itemDef('guard-vest')).toMatchObject({ size: 3 })
    expect(itemDef('giant-bone')).toMatchObject({ size: 4 })

    expect(shopPool('MEDIUM').some((item) => item.id === 'guard-vest')).toBe(true)
    expect(shopPool('LARGE').some((item) => item.id === 'guard-vest')).toBe(false)
  })

  it('defines bully as the large-item effect dog', () => {
    expect(DOGS).toHaveProperty('BULLY')
    expect(DOGS.BULLY.trait).toContain('40%')
    expect(DOGS.BULLY.trait).toContain('大型物品')
  })

  it('defines dog emperor as the lucky-number effect dog', () => {
    expect(DOGS).toHaveProperty('EMPEROR')
    expect(DOGS.EMPEROR.trait).toContain('天命数字')
    expect(DOGS.EMPEROR.trait).toContain('50%')
  })

  it('defines frog as the reservoir timing dog', () => {
    expect(DOGS).toHaveProperty('FROG')
    expect(DOGS.FROG.trait).toContain('蓄水')
    expect(DOGS.FROG.trait).toContain('职业装备提速')
  })

  it('defines class rewards by dog and unlock round plus relic definitions', () => {
    expect(CLASS_REWARD_DEFS.filter((item) => item.classDog === 'SHIBA' && item.unlockRound === 3).map((item) => item.name)).toEqual([
      '极速太刀',
      '大太刀',
      '燕回太刀',
    ])
    expect(CLASS_REWARD_DEFS.filter((item) => item.classDog === 'BULLY' && item.unlockRound === 6)).toHaveLength(3)
    expect(CLASS_REWARD_DEFS.filter((item) => item.classDog === 'FROG' && item.unlockRound === 3).map((item) => item.name)).toEqual([
      '荷叶水泵',
      '蛙鸣鼓',
      '雨滴漏斗',
    ])
    expect(CLASS_REWARD_DEFS.filter((item) => item.classDog === 'FROG' && item.unlockRound === 6).map((item) => item.name)).toEqual([
      '莲池回声',
      '暴雨季',
      '满池闸门',
    ])
    expect(RELIC_DEFS.map((relic) => relic.name)).toEqual(expect.arrayContaining(['点金手·左', '点金手·右', '半截骰·左', '半截骰·右']))
  })

  it('appends V3 common equipment and relic definitions without removing the existing pool', () => {
    expect(itemDef('small-bite')).toMatchObject({ size: 1 })
    expect(itemDef('v3-cone-collar')).toMatchObject({ size: 1, effect: { type: 'UTILITY', amount: 3 } })
    expect(itemDef('v3-wooden-shield')).toMatchObject({ dice: [2, 3, 4], effect: { type: 'UTILITY', amount: 8 } })
    expect(itemDef('v3-spiked-vest')).toMatchObject({ dice: [4, 5, 6], effect: { type: 'UTILITY', amount: 1 } })
    expect(itemDef('v3-dinosaur-leg-bone')).toMatchObject({ dice: [5, 6], effect: { type: 'DAMAGE', amount: 18 }, advancedEffect: 'DOUBLE_SHIELD_DAMAGE' })
    expect(itemDef('v3-auto-waterer')).toMatchObject({ effect: { type: 'HEAL', amount: 8 }, advancedEffect: 'HEAL_OR_MAX_HP' })
    expect(itemDef('samoyed-soft-fur')).toMatchObject({ effect: { type: 'HEAL', amount: 8 } })
    expect(itemDef('v3-golden-kennel')).toMatchObject({ size: 4, price: 11, defaultQuality: 'DIAMOND' })
    expect(shopPool('SMALL').some((item) => item.id === 'v3-flea-disc')).toBe(true)
    expect(shopPool('LARGE').some((item) => item.id === 'v3-dinosaur-leg-bone')).toBe(true)
    expect(RELIC_DEFS.map((relic) => relic.id)).toEqual(expect.arrayContaining([
      'midas-left',
      'v3-two-sided-gold-tag',
      'v3-bad-dog-manual',
      'v3-husky-engine',
    ]))
  })

  it('defines the new common archetype equipment with exact tuning', () => {
    expect(itemDef('v4-blood-contract-fang')).toMatchObject({
      size: 2,
      price: 12,
      dice: [1, 6],
      tags: ['lifesteal', 'support', 'extreme'],
      effect: { type: 'UTILITY', amount: 0 },
      advancedEffect: 'GRANT_LIFESTEAL_ADJACENT',
      defaultQuality: 'GOLD',
    })
    expect(itemDef('v4-boom-counter')).toMatchObject({
      size: 2,
      price: 14,
      dice: [],
      tags: ['counter', 'trigger', 'damage'],
      effect: { type: 'UTILITY', amount: 380, qualityBase: 'GOLD' },
      advancedEffect: 'BOOM_COUNTER',
      defaultQuality: 'GOLD',
    })
    expect(itemDef('v4-growing-chew-sword')).toMatchObject({
      size: 2,
      price: 9,
      dice: [2, 3, 4],
      tags: ['growth', 'damage', 'stable'],
      effect: { type: 'DAMAGE', amount: 1, qualityBase: 'SILVER' },
      advancedEffect: 'GROWTH_DAMAGE',
      defaultQuality: 'SILVER',
    })
    expect(itemDef('v4-reverse-fur-comb')).toMatchObject({
      size: 1,
      price: 8,
      dice: [3, 4],
      tags: ['cleanse', 'heal', 'counter'],
      effect: { type: 'UTILITY', amount: 3, qualityBase: 'SILVER' },
      advancedEffect: 'PURGE_ENEMY_BUFFS',
      defaultQuality: 'SILVER',
    })
    expect(itemDef('patting-bear')).toMatchObject({
      name: '拍拍熊',
      size: 2,
      price: 10,
      dice: [1, 6],
      tags: ['wound', 'attack'],
      effect: { type: 'UTILITY', amount: 1, qualityBase: 'SILVER' },
      advancedEffect: 'APPLY_WOUND',
      defaultQuality: 'SILVER',
    })

    expect(itemDef('poisoned-dog-fang')).toMatchObject({
      size: 2,
      price: 7.5,
      dice: [],
      tags: ['poison', 'attack', 'passive'],
      effect: { type: 'UTILITY', amount: 2, qualityBase: 'GOLD' },
      advancedEffect: 'POISON_ON_ATTACK_HIT',
      defaultQuality: 'SILVER',
    })
    expect(itemPurchaseValue(itemDef('patting-bear'))).toBe(20)
    expect(itemPurchaseValue(itemDef('poisoned-dog-fang'))).toBe(15)

    expect(shopPool('GENERAL').map((item) => item.id)).toEqual(expect.arrayContaining([
      'v4-blood-contract-fang',
      'v4-boom-counter',
      'v4-growing-chew-sword',
      'v4-reverse-fur-comb',
      'patting-bear',
      'poisoned-dog-fang',
    ]))
    expect(shopPool('MEDIUM').map((item) => item.id)).toEqual(expect.arrayContaining([
      'v4-blood-contract-fang',
      'v4-boom-counter',
      'v4-growing-chew-sword',
      'patting-bear',
      'poisoned-dog-fang',
    ]))
    expect(shopPool('SMALL').map((item) => item.id)).toContain('v4-reverse-fur-comb')
  })

  it('defines V5 converter and counter equipment with exact tuning', () => {
    expect(itemDef('v5-shattered-tooth-gear')).toMatchObject({
      size: 1,
      price: 7,
      dice: [],
      tags: ['small', 'counter', 'damage'],
      effect: { type: 'UTILITY', amount: 10, qualityBase: 'SILVER' },
      advancedEffect: 'SMALL_TRIGGER_COUNTER',
      defaultQuality: 'SILVER',
    })
    expect(itemDef('v5-poison-blood-pump')).toMatchObject({
      size: 2,
      price: 9,
      dice: [1, 3, 5],
      tags: ['poison', 'heal', 'converter'],
      effect: { type: 'UTILITY', amount: 6, qualityBase: 'SILVER' },
      advancedEffect: 'POISON_TO_HEAL',
      defaultQuality: 'SILVER',
    })
    expect(itemDef('v5-biteback-shield')).toMatchObject({
      size: 3,
      price: 11,
      dice: [4, 5],
      tags: ['shield', 'thorn', 'damage', 'converter'],
      effect: { type: 'UTILITY', amount: 10, qualityBase: 'GOLD' },
      advancedEffect: 'SHIELD_TO_DAMAGE',
      defaultQuality: 'GOLD',
    })
    expect(itemDef('v5-barkproof-earmuffs')).toMatchObject({
      size: 2,
      price: 9,
      dice: [],
      tags: ['counter', 'disable', 'anti-frequency'],
      effect: { type: 'UTILITY', amount: 0 },
      advancedEffect: 'ANTI_FREQUENCY_DISABLE_SMALL',
      defaultQuality: 'SILVER',
    })
    expect(itemDef('v5-offbeat-metronome')).toMatchObject({
      size: 1,
      price: 7,
      dice: [],
      tags: ['counter', 'multi', 'tempo'],
      effect: { type: 'UTILITY', amount: 1, qualityBase: 'SILVER' },
      advancedEffect: 'ANTI_MULTI_SUPPRESS',
      defaultQuality: 'SILVER',
    })
    expect(itemDef('v5-bitter-kibble')).toMatchObject({
      size: 1,
      price: 6,
      dice: [1, 6],
      tags: ['cleanse', 'poison', 'shield', 'counter'],
      effect: { type: 'UTILITY', amount: 0 },
      advancedEffect: 'CLEANSE_POISON_TO_SHIELD',
      defaultQuality: 'SILVER',
    })
    expect(itemDef('v5-thornbreaker-chew')).toMatchObject({
      size: 2,
      price: 8,
      dice: [4, 6],
      tags: ['shield-break', 'thorn', 'counter', 'damage'],
      effect: { type: 'DAMAGE', amount: 8, qualityBase: 'SILVER' },
      advancedEffect: 'BREAK_SHIELD_THORNS',
      defaultQuality: 'SILVER',
    })

    expect(shopPool('GENERAL').map((item) => item.id)).toEqual(expect.arrayContaining([
      'v5-shattered-tooth-gear',
      'v5-poison-blood-pump',
      'v5-biteback-shield',
      'v5-barkproof-earmuffs',
      'v5-offbeat-metronome',
      'v5-bitter-kibble',
      'v5-thornbreaker-chew',
    ]))
    expect(shopPool('SMALL').map((item) => item.id)).toEqual(expect.arrayContaining([
      'v5-shattered-tooth-gear',
      'v5-offbeat-metronome',
      'v5-bitter-kibble',
    ]))
    expect(shopPool('MEDIUM').map((item) => item.id)).toEqual(expect.arrayContaining([
      'v5-poison-blood-pump',
      'v5-biteback-shield',
      'v5-barkproof-earmuffs',
      'v5-thornbreaker-chew',
    ]))
  })

  it('describes V5 equipment with quality-scaled values', () => {
    expect(itemDefForQuality('v5-shattered-tooth-gear', 'SILVER').description).toContain('4 次')
    expect(itemDefForQuality('v5-shattered-tooth-gear', 'SILVER').description).toContain('10 点直接伤害')
    expect(itemDefForQuality('v5-shattered-tooth-gear', 'DIAMOND').description).toContain('23 点直接伤害')
    expect(itemDefForQuality('v5-poison-blood-pump', 'GOLD').description).toContain('每档恢复 9 点生命')
    expect(itemDefForQuality('v5-biteback-shield', 'GOLD').description).toContain('获得 10 点【护盾】')
    expect(itemDefForQuality('v5-barkproof-earmuffs', 'DIAMOND').description).toContain('连续成功触发 4 次')
    expect(itemDefForQuality('v5-offbeat-metronome', 'DIAMOND').description).toContain('减少 2 次')
    expect(itemDefForQuality('v5-bitter-kibble', 'GOLD').description).toContain('最多【净化】 9 层【中毒】')
    expect(itemDefForQuality('v5-thornbreaker-chew', 'DIAMOND').description).toContain('清除 3 层【荆棘】')
  })

  it('defines carrot and tissue as trigger point remapping relics', () => {
    expect(RELIC_DEFS).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'carrot',
        name: '胡萝卜',
        unlockRound: 3,
        defaultQuality: 'SILVER',
        effect: 'SHIFT_TRIGGER_DICE_UP',
      }),
      expect.objectContaining({
        id: 'tissue',
        name: '纸巾',
        unlockRound: 3,
        defaultQuality: 'SILVER',
        effect: 'SHIFT_TRIGGER_DICE_DOWN',
      }),
    ]))
    expect(relicDefForQuality('carrot', 'SILVER').description).toContain('6 会变成 1')
    expect(relicDefForQuality('tissue', 'SILVER').description).toContain('1 会变成 6')
  })

  it('uses quality-scaled descriptions for base-quality archetype equipment', () => {
    expect(itemDefForQuality('v4-growing-chew-sword', 'BRONZE').description).toContain('初始造成 1 点伤害')
    expect(itemDefForQuality('v4-growing-chew-sword', 'BRONZE').description).toContain('后续伤害 +2')
    expect(itemDefForQuality('v4-growing-chew-sword', 'SILVER').description).toContain('后续伤害 +3')
    expect(itemDefForQuality('v4-reverse-fur-comb', 'BRONZE').description).toContain('每实际清除 1 层，自己恢复 3 点生命')
    expect(itemDefForQuality('v4-reverse-fur-comb', 'SILVER').description).toContain('每实际清除 1 层，自己恢复 5 点生命')
  })

  it('growing chew sword diamond description matches growth base and step', () => {
    expect(itemDefForQuality('v4-growing-chew-sword', 'DIAMOND').description).toContain('初始造成 3 点伤害')
    expect(itemDefForQuality('v4-growing-chew-sword', 'DIAMOND').description).toContain('后续伤害 +7')
  })

  it('describes thorns as two reflected damage per stack', () => {
    expect(TERM_DEFS.find((term) => term.term === '荆棘')?.description).toContain('造成2点伤害')
  })

  it('defines formal numeric descriptions for battle buffs and debuffs', () => {
    const terms = Object.fromEntries(TERM_DEFS.map((term) => [term.term, term.description]))

    expect(terms.荆棘).toContain('每 1 层在受到攻击时反弹 2 点伤害')
    expect(terms.激昂).toContain('每 1 层使自身所有攻击伤害 +1')
    expect(terms.中毒).toContain('每 1 层每秒造成 1 点伤害')
    expect(terms.虚弱).toContain('下一次攻击造成的伤害降低 50%')
    expect(terms.失效).toContain('每 1 层抵消 1 次装备触发')
  })
})

describe('battle simulation', () => {
  const openingThornsRelic: RelicInstance = { id: 'opening-thorns', relicId: 'v3-fluffed-spike-collar', quality: 'GOLD', slot: 0 }

  function reverseFurCombEvent(result: ReturnType<typeof simulateBattle>, itemId = 'comb') {
    return result.events.find((event) =>
      event.kind === 'ITEM'
      && event.actor === 'player'
      && event.itemId === itemId
      && event.defId === 'v4-reverse-fur-comb'
    )
  }

  const allDice = [1, 2, 3, 4, 5, 6]

  it('shattered tooth gear converts four other small triggers into direct damage', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'SHIBA',
      wins: 0,
      losses: 0,
      round: 6,
      items: [
        equipment('gear', 'v5-shattered-tooth-gear', 0, 'SILVER'),
        ...Array.from({ length: 4 }, (_, index) => ({
          ...equipment(`tooth-${index}`, 'starter-1', index + 1, 'BRONZE'),
          triggerDiceOverride: allDice,
        })),
      ],
    }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'SHIBA', wins: 0, losses: 0, round: 6, items: [] }

    const result = simulateBattle(player, opponent, 'shattered-tooth-gear')
    const burst = result.events.find((event) => event.itemId === 'gear' && event.defId === 'v5-shattered-tooth-gear' && event.effectType === 'DAMAGE')

    expect(burst).toMatchObject({
      actor: 'player',
      amount: 10,
      target: 'opponent',
      boomCounterChanged: undefined,
    })
  })

  it('poison blood pump converts enemy poison stacks into capped healing tiers', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'SHIBA',
      wins: 0,
      losses: 0,
      round: 6,
      items: [
        { ...equipment('flea-left', 'v3-flea-disc', 0, 'DIAMOND'), triggerDiceOverride: allDice },
        { ...equipment('flea-right', 'v3-flea-disc', 1, 'DIAMOND'), triggerDiceOverride: allDice },
        { ...equipment('pump', 'v5-poison-blood-pump', 2, 'SILVER'), triggerDiceOverride: allDice },
      ],
    }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'SHIBA', wins: 0, losses: 0, round: 6, items: [] }

    const result = simulateBattle(player, opponent, 'poison-blood-pump')
    const heal = result.events.find((event) => event.itemId === 'pump' && event.defId === 'v5-poison-blood-pump' && event.effectType === 'HEAL')

    expect(heal).toMatchObject({
      actor: 'player',
      amount: 12,
      target: 'player',
    })
  })

  it('biteback shield gains shield and converts current shield into capped direct damage', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'SAMOYED',
      wins: 0,
      losses: 0,
      round: 6,
      items: [
        { ...equipment('shield', 'v5-biteback-shield', 0, 'GOLD'), triggerDiceOverride: allDice },
      ],
    }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'SHIBA', wins: 0, losses: 0, round: 6, items: [] }

    const result = simulateBattle(player, opponent, 'biteback-shield')
    const shieldGain = result.events.find((event) => event.itemId === 'shield' && event.defId === 'v5-biteback-shield' && event.effectType === 'UTILITY')
    const counterDamage = result.events.find((event) => event.itemId === 'shield' && event.defId === 'v5-biteback-shield' && event.effectType === 'DAMAGE')

    expect(shieldGain).toMatchObject({ amount: 10, playerShield: 10 })
    expect(counterDamage).toMatchObject({ amount: 2, target: 'opponent' })
  })

  it('barkproof earmuffs disables the enemy next small item after six consecutive triggers', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'SHIBA',
      wins: 0,
      losses: 0,
      round: 6,
      items: [equipment('earmuffs', 'v5-barkproof-earmuffs', 0, 'SILVER')],
    }
    const opponent: FighterSnapshot = {
      name: 'O',
      dogType: 'SHIBA',
      wins: 0,
      losses: 0,
      round: 6,
      items: Array.from({ length: 7 }, (_, index) => ({
        ...equipment(`enemy-${index}`, 'starter-1', index, 'BRONZE'),
        triggerDiceOverride: allDice,
      })),
    }

    const result = simulateBattle(player, opponent, 'barkproof-earmuffs')
    const disabled = result.events.find((event) => event.actor === 'opponent' && event.itemId === 'enemy-6' && event.effectType === 'UTILITY' && event.amount === 0)

    expect(disabled).toMatchObject({
      defId: 'starter-1',
      target: 'none',
    })
  })

  it('offbeat metronome suppresses enemy multi repeats without removing the base trigger', () => {
    const opponentWithDisc: FighterSnapshot = {
      name: 'O',
      dogType: 'BULLY',
      wins: 0,
      losses: 0,
      round: 6,
      items: [{ ...equipment('disc', 'training-disc', 0, 'BRONZE'), triggerDiceOverride: allDice }],
    }
    const fighterWithMetronome = (quality: GameItem['quality']): FighterSnapshot => ({
      name: 'P',
      dogType: 'BULLY',
      wins: 0,
      losses: 0,
      round: 6,
      items: [equipment('metronome', 'v5-offbeat-metronome', 0, quality)],
    })
    const discEvents = (quality: GameItem['quality']) => simulateBattle(fighterWithMetronome(quality), opponentWithDisc, `offbeat-${quality}`).events
      .filter((event) => event.actor === 'opponent' && event.itemId === 'disc' && event.time === 1 && event.kind === 'ITEM')

    expect(discEvents('SILVER').map((event) => event.multiIndex)).toEqual([1, 2])
    expect(discEvents('SILVER').map((event) => event.multiTotal)).toEqual([2, 2])
    expect(discEvents('DIAMOND').map((event) => event.multiIndex)).toEqual([1])
    expect(discEvents('DIAMOND').map((event) => event.multiTotal)).toEqual([1])
  })

  it('bitter kibble cleanses poison into shield with a quality-scaled cap', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'SHIBA',
      wins: 0,
      losses: 0,
      round: 6,
      items: [{ ...equipment('kibble', 'v5-bitter-kibble', 0, 'GOLD'), triggerDiceOverride: allDice }],
    }
    const opponent: FighterSnapshot = {
      name: 'O',
      dogType: 'SHIBA',
      wins: 0,
      losses: 0,
      round: 6,
      items: [
        { ...equipment('flea-left', 'v3-flea-disc', 0, 'DIAMOND'), triggerDiceOverride: allDice },
        { ...equipment('flea-right', 'v3-flea-disc', 1, 'DIAMOND'), triggerDiceOverride: allDice },
      ],
    }

    const result = simulateBattle(player, opponent, 'bitter-kibble')
    const cleanse = result.events.find((event) => event.itemId === 'kibble' && event.time === 2 && event.defId === 'v5-bitter-kibble')

    expect(cleanse).toMatchObject({
      amount: 18,
      playerShield: 18,
      effectType: 'UTILITY',
      target: 'player',
    })
  })

  it('thornbreaker chew removes thorns and deals bonus shield damage', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'SHIBA',
      wins: 0,
      losses: 0,
      round: 6,
      items: [{ ...equipment('chew', 'v5-thornbreaker-chew', 0, 'SILVER'), triggerDiceOverride: allDice }],
    }
    const opponent: FighterSnapshot = {
      name: 'O',
      dogType: 'SAMOYED',
      wins: 0,
      losses: 0,
      round: 6,
      items: [{ ...equipment('wood', 'v3-wooden-shield', 0, 'BRONZE'), triggerDiceOverride: allDice }],
      relics: [openingThornsRelic],
    }

    const result = simulateBattle(player, opponent, 'thornbreaker-chew')
    const clear = result.events.find((event) => event.itemId === 'chew' && event.defId === 'v5-thornbreaker-chew' && event.effectType === 'UTILITY')
    const shieldBreak = result.events.find((event) => event.itemId === 'chew' && event.defId === 'v5-thornbreaker-chew' && event.time === 2 && event.effectType === 'DAMAGE')

    expect(clear).toMatchObject({ amount: 1, target: 'opponent' })
    expect(shieldBreak).toMatchObject({ opponentShield: 0 })
  })

  it('night patrol light upgrade increases adjacent trigger count', () => {
    const fighterWithLight = (quality: GameItem['quality']): FighterSnapshot => ({
      name: 'P',
      dogType: 'BULLY',
      wins: 0,
      losses: 0,
      round: 6,
      items: [
        { id: 'neighbor', defId: 'starter-6', quality: 'BRONZE', area: 'EQUIPMENT', x: 0, y: 0 },
        { id: 'lamp', defId: 'v3-night-patrol-light', quality, area: 'EQUIPMENT', x: 1, y: 0 },
      ],
    })
    const opponent: FighterSnapshot = { name: 'O', dogType: 'BULLY', wins: 0, losses: 0, round: 6, items: [] }
    const adjacentTriggersAtFirstRoll = (quality: GameItem['quality']) => {
      const result = simulateBattle(fighterWithLight(quality), opponent, 'night-light-0')
      return result.events.filter((event) =>
        event.time === 1
        && event.kind === 'ITEM'
        && event.actor === 'player'
        && event.itemId === 'neighbor'
      )
    }

    expect(adjacentTriggersAtFirstRoll('GOLD')).toHaveLength(1)
    expect(adjacentTriggersAtFirstRoll('DIAMOND')).toHaveLength(2)
  })

  it('records trigger counts for night patrol light itself when it queues adjacent triggers', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'BULLY',
      wins: 0,
      losses: 0,
      round: 6,
      items: [
        { ...equipment('neighbor', 'starter-1', 0, 'BRONZE'), triggerDiceOverride: allDice },
        { ...equipment('lamp', 'v3-night-patrol-light', 1, 'GOLD'), triggerDiceOverride: allDice },
      ],
    }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'BULLY', wins: 0, losses: 0, round: 6, items: [] }

    const result = simulateBattle(player, opponent, 'night-light-count-self')
    const firstPlayerRoll = result.events.find((event) => event.kind === 'ROLL' && event.actor === 'player')
    const lampEvent = result.events.find((event) =>
      event.kind === 'ITEM'
      && event.actor === 'player'
      && event.time === firstPlayerRoll?.time
      && event.itemId === 'lamp'
    )

    expect(lampEvent).toMatchObject({
      defId: 'v3-night-patrol-light',
      itemTriggerCount: 1,
      effectType: 'UTILITY',
    })
  })

  it('records trigger counts for self-trigger side effects that do not emit direct payloads', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'BULLY',
      wins: 0,
      losses: 0,
      round: 6,
      items: [
        { ...equipment('post', 'v3-chew-scratch-post', 0, 'BRONZE'), triggerDiceOverride: allDice },
        { ...equipment('bite', 'starter-1', 1, 'BRONZE'), triggerDiceOverride: allDice },
      ],
    }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'BULLY', wins: 0, losses: 0, round: 6, items: [] }

    const result = simulateBattle(player, opponent, 'scratch-post-count-self')
    const firstPlayerRoll = result.events.find((event) => event.kind === 'ROLL' && event.actor === 'player')
    const postEvent = result.events.find((event) =>
      event.kind === 'ITEM'
      && event.actor === 'player'
      && event.time === firstPlayerRoll?.time
      && event.itemId === 'post'
    )
    const biteEvent = result.events.find((event) =>
      event.kind === 'ITEM'
      && event.actor === 'player'
      && event.time === firstPlayerRoll?.time
      && event.itemId === 'bite'
      && event.effectType === 'DAMAGE'
    )

    expect(postEvent).toMatchObject({
      defId: 'v3-chew-scratch-post',
      itemTriggerCount: 1,
      effectType: 'UTILITY',
    })
    expect(biteEvent?.amount).toBeGreaterThan(5)
  })

  it('reflects two damage per thorn stack when attacked', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'MUTT',
      wins: 0,
      losses: 0,
      round: 0,
      items: [
        { id: 'hit', defId: 'starter-1', quality: 'BRONZE', area: 'EQUIPMENT', x: 0, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = {
      name: 'O',
      dogType: 'MUTT',
      wins: 0,
      losses: 0,
      round: 0,
      items: [],
      relics: [openingThornsRelic],
    }

    const result = simulateBattle(player, opponent, 'thorn-0')
    const thorn = result.events.find((event) => event.text.includes('【荆棘】反弹'))

    expect(thorn).toMatchObject({
      effectType: 'DAMAGE',
      amount: 10,
      target: 'player',
      sourceHpDelta: -10,
    })
    expect(thorn?.text).toContain('反弹 10 点伤害')
  })

  it('lets wound increase direct attack damage only', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'BULLY',
      wins: 0,
      losses: 0,
      round: 10,
      items: [
        { id: 'bear', defId: 'patting-bear', quality: 'SILVER', area: 'EQUIPMENT', x: 0, y: 0 },
        { id: 'bite', defId: 'starter-1', quality: 'BRONZE', area: 'EQUIPMENT', x: 2, y: 0 },
        { id: 'poison', defId: 'shiba-poison', quality: 'DIAMOND', area: 'EQUIPMENT', x: 3, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = {
      name: 'O',
      dogType: 'BULLY',
      wins: 0,
      losses: 0,
      round: 10,
      items: [
        { id: 'enemy-bear', defId: 'patting-bear', quality: 'SILVER', area: 'EQUIPMENT', x: 0, y: 0 },
      ],
      relics: [openingThornsRelic],
    }

    const result = simulateBattle(player, opponent, 'wound-direct-only')
    const wound = result.events.find((event) => event.itemId === 'bear' && event.text.includes('【伤口】'))
    const boostedAttack = result.events.find((event) => event.itemId === 'bite' && event.target === 'opponent' && event.targetHpDelta === -6)
    const poisonTick = result.events.find((event) => event.kind === 'POISON' && event.target === 'opponent')
    const thorn = result.events.find((event) =>
      event.text.includes('【荆棘】反弹')
      && event.target === 'player'
      && event.playerStatuses?.negative.some((status) => status.type === 'wound')
    )

    expect(wound?.opponentStatuses?.negative).toContainEqual(expect.objectContaining({ type: 'wound', stacks: 1 }))
    expect(boostedAttack).toMatchObject({ amount: 6, targetHpDelta: -6 })
    expect(poisonTick).toMatchObject({ amount: 6 })
    expect(thorn).toMatchObject({ amount: 10, sourceHpDelta: -10 })
  })

  it('lets poisoned dog fang apply quality-scaled poison whenever an attack hits', () => {
    const fighterWithFang = (quality: GameItem['quality']): FighterSnapshot => ({
      name: 'P',
      dogType: 'BULLY',
      wins: 0,
      losses: 0,
      round: 10,
      items: [
        { id: 'fang', defId: 'poisoned-dog-fang', quality, area: 'EQUIPMENT', x: 0, y: 0 },
        ...[1, 2, 3, 4, 5, 6].map((n, index) => ({
          id: `bite-${quality}-${n}`,
          defId: `starter-${n}`,
          quality: 'BRONZE' as const,
          area: 'EQUIPMENT' as const,
          x: index + 2,
          y: 0,
        })),
      ],
    })
    const opponent: FighterSnapshot = { name: 'O', dogType: 'BULLY', wins: 0, losses: 0, round: 10, items: [] }
    const firstFangPoison = (quality: GameItem['quality']) => {
      const result = simulateBattle(fighterWithFang(quality), opponent, `poisoned-fang-${quality}`)
      return result.events.find((event) => event.defId === 'poisoned-dog-fang' && event.effectType === 'POISON')
    }

    expect(firstFangPoison('SILVER')).toMatchObject({ amount: 1, target: 'opponent' })
    expect(firstFangPoison('GOLD')).toMatchObject({ amount: 2, target: 'opponent' })
    expect(firstFangPoison('DIAMOND')).toMatchObject({ amount: 3, target: 'opponent' })
  })

  it('night patrol light upgrade increases adjacent trigger count', () => {
    const fighterWithLight = (quality: GameItem['quality']): FighterSnapshot => ({
      name: 'P',
      dogType: 'BULLY',
      wins: 0,
      losses: 0,
      round: 6,
      items: [
        { id: 'neighbor', defId: 'starter-6', quality: 'BRONZE', area: 'EQUIPMENT', x: 0, y: 0 },
        { id: 'lamp', defId: 'v3-night-patrol-light', quality, area: 'EQUIPMENT', x: 1, y: 0 },
      ],
    })
    const opponent: FighterSnapshot = { name: 'O', dogType: 'BULLY', wins: 0, losses: 0, round: 6, items: [] }
    const adjacentTriggersAtFirstRoll = (quality: GameItem['quality']) => {
      const result = simulateBattle(fighterWithLight(quality), opponent, 'night-light-0')
      return result.events.filter((event) =>
        event.time === 1
        && event.kind === 'ITEM'
        && event.actor === 'player'
        && event.itemId === 'neighbor'
      )
    }

    expect(adjacentTriggersAtFirstRoll('GOLD')).toHaveLength(1)
    expect(adjacentTriggersAtFirstRoll('DIAMOND')).toHaveLength(2)
  })

  it('reverse fur comb silver purges enemy thorns first and heals by removed layers', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'MUTT',
      wins: 0,
      losses: 0,
      round: 7,
      items: [
        { id: 'comb', defId: 'v4-reverse-fur-comb', quality: 'SILVER', area: 'EQUIPMENT', x: 0, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = {
      name: 'O',
      dogType: 'MUTT',
      wins: 0,
      losses: 0,
      round: 7,
      items: [
        { id: 'hit', defId: 'starter-1', quality: 'DIAMOND', area: 'EQUIPMENT', x: 0, y: 0 },
        { id: 'shield', defId: 'v3-wooden-shield', quality: 'DIAMOND', area: 'EQUIPMENT', x: 1, y: 0 },
        { id: 'speed', defId: 'shiba-speed-katana', quality: 'GOLD', area: 'EQUIPMENT', x: 2, y: 0 },
      ],
      relics: [openingThornsRelic],
    }

    const result = simulateBattle(player, opponent, 'reverse-fur-comb-0')
    const purge = reverseFurCombEvent(result)

    expect(purge).toMatchObject({
      effectType: 'HEAL',
      amount: 15,
      target: 'player',
      sourceHpDelta: 15,
      playerHp: 250,
    })
    expect(purge?.text).toContain('清除 3 层增益')
    expect(purge?.text).toContain('恢复 15 点生命')
    expect(purge?.opponentStatuses?.positive).toContainEqual(expect.objectContaining({ type: 'thorns', stacks: 2 }))
    expect(purge?.opponentShield).toBe(27)
  })

  it('reverse fur comb converts every 8 enemy shield into one purged layer after thorns and speed', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'MUTT',
      wins: 0,
      losses: 0,
      round: 7,
      items: [
        { id: 'comb', defId: 'v4-reverse-fur-comb', quality: 'SILVER', area: 'EQUIPMENT', x: 0, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = {
      name: 'O',
      dogType: 'MUTT',
      wins: 0,
      losses: 0,
      round: 7,
      items: [
        { id: 'hit', defId: 'starter-1', quality: 'DIAMOND', area: 'EQUIPMENT', x: 0, y: 0 },
        { id: 'shield', defId: 'v3-wooden-shield', quality: 'DIAMOND', area: 'EQUIPMENT', x: 1, y: 0 },
      ],
    }

    const result = simulateBattle(player, opponent, 'reverse-fur-comb-5')
    const purge = reverseFurCombEvent(result)

    expect(purge).toMatchObject({
      effectType: 'HEAL',
      amount: 15,
      sourceHpDelta: 15,
      playerHp: 261,
    })
    expect(purge?.text).toContain('清除 3 层增益')
    expect(purge?.text).toContain('恢复 15 点生命')
    expect(purge?.opponentShield).toBe(30)
  })

  it('reverse fur comb diamond purges seven layers and reports seventy-seven healing', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'MUTT',
      wins: 0,
      losses: 0,
      round: 7,
      items: [
        { id: 'comb', defId: 'v4-reverse-fur-comb', quality: 'DIAMOND', area: 'EQUIPMENT', x: 0, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = {
      name: 'O',
      dogType: 'MUTT',
      wins: 0,
      losses: 0,
      round: 7,
      items: [
        { id: 'hit', defId: 'starter-1', quality: 'DIAMOND', area: 'EQUIPMENT', x: 0, y: 0 },
        { id: 'shield', defId: 'v3-wooden-shield', quality: 'DIAMOND', area: 'EQUIPMENT', x: 1, y: 0 },
        { id: 'speed', defId: 'shiba-speed-katana', quality: 'GOLD', area: 'EQUIPMENT', x: 2, y: 0 },
      ],
      relics: [openingThornsRelic],
    }

    const result = simulateBattle(player, opponent, 'reverse-fur-comb-0')
    const purge = reverseFurCombEvent(result)

    expect(purge).toMatchObject({
      effectType: 'HEAL',
      amount: 77,
      target: 'player',
    })
    expect(purge?.text).toContain('清除 7 层增益')
    expect(purge?.text).toContain('恢复 77 点生命')
    expect(purge?.opponentStatuses?.positive).not.toContainEqual(expect.objectContaining({ type: 'thorns' }))
    expect(purge?.opponentStatuses?.positive).not.toContainEqual(expect.objectContaining({ type: 'extraRoll' }))
    expect(purge?.opponentShield).toBe(27)
  })

  it('reverse fur comb prioritizes thorns before shield when the purge limit is small', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'MUTT',
      wins: 0,
      losses: 0,
      round: 7,
      items: [
        { id: 'comb', defId: 'v4-reverse-fur-comb', quality: 'BRONZE', area: 'EQUIPMENT', x: 0, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = {
      name: 'O',
      dogType: 'MUTT',
      wins: 0,
      losses: 0,
      round: 7,
      items: [
        { id: 'hit', defId: 'starter-1', quality: 'DIAMOND', area: 'EQUIPMENT', x: 0, y: 0 },
        { id: 'shield', defId: 'v3-wooden-shield', quality: 'DIAMOND', area: 'EQUIPMENT', x: 1, y: 0 },
      ],
      relics: [openingThornsRelic],
    }

    const result = simulateBattle(player, opponent, 'reverse-fur-comb-1')
    const purge = reverseFurCombEvent(result)

    expect(purge).toMatchObject({
      effectType: 'HEAL',
      amount: 6,
    })
    expect(purge?.text).toContain('恢复 6 点生命')
    expect(purge?.opponentStatuses?.positive).toContainEqual(expect.objectContaining({ type: 'thorns', stacks: 3 }))
    expect(purge?.opponentShield).toBe(27)
  })

  it('reverse fur comb still purges buffs but does not heal while recovery is blocked', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'MUTT',
      wins: 0,
      losses: 0,
      round: 7,
      items: [
        { id: 'air', defId: 'mutt-eat-air', quality: 'DIAMOND', area: 'EQUIPMENT', x: 0, y: 0 },
        { id: 'comb', defId: 'v4-reverse-fur-comb', quality: 'DIAMOND', area: 'EQUIPMENT', x: 4, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = {
      name: 'O',
      dogType: 'MUTT',
      wins: 0,
      losses: 0,
      round: 7,
      items: [
        { id: 'hit', defId: 'starter-1', quality: 'DIAMOND', area: 'EQUIPMENT', x: 0, y: 0 },
        { id: 'shield', defId: 'v3-wooden-shield', quality: 'DIAMOND', area: 'EQUIPMENT', x: 1, y: 0 },
      ],
      relics: [openingThornsRelic],
    }

    const result = simulateBattle(player, opponent, 'reverse-fur-comb-blocked-1')
    const purge = reverseFurCombEvent(result)

    expect(purge).toBeDefined()
    expect(purge?.time).toBeLessThanOrEqual(10)
    expect(purge?.effectType).not.toBe('HEAL')
    expect(purge).toMatchObject({
      effectType: 'UTILITY',
      sourceHpDelta: 0,
    })
    expect(purge?.text).toContain('清除')
    expect(purge?.text).not.toContain('恢复')
    expect(purge?.opponentStatuses?.positive).not.toContainEqual(expect.objectContaining({ type: 'thorns' }))
    expect(purge?.opponentShield).toBe(11)
  })

  it('growing chew sword silver damage grows without a fixed cap', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'MUTT',
      wins: 0,
      losses: 0,
      round: 7,
      items: [
        { id: 'growing-silver', defId: 'v4-growing-chew-sword', quality: 'SILVER', area: 'EQUIPMENT', x: 0, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'MUTT', wins: 0, losses: 0, round: 7, items: [] }
    const result = simulateBattle(player, opponent, 'growing-chew-sword-silver')
    const hits = result.events.filter((event) =>
      event.kind === 'ITEM'
      && event.actor === 'player'
      && event.itemId === 'growing-silver'
      && event.effectType === 'DAMAGE'
    )
    const growthEvents = result.events.filter((event) =>
      event.kind === 'ITEM'
      && event.actor === 'player'
      && event.itemId === 'growing-silver'
      && event.effectType === 'UTILITY'
      && event.text.includes('后续伤害提高')
    )

    expect(hits.slice(0, 5).map((event) => event.amount)).toEqual([1, 4, 7, 10, 13])
    expect(hits.some((event) => (event.amount ?? 0) > 25)).toBe(true)
    expect(growthEvents.slice(0, 3).map((event) => event.amount)).toEqual([3, 3, 3])
  })

  it('growing chew sword quality controls starting damage and growth step', () => {
    const damageSequenceFor = (quality: GameItem['quality']) => {
      const player: FighterSnapshot = {
        name: 'P',
        dogType: 'MUTT',
        wins: 0,
        losses: 0,
        round: 7,
        items: [
          { id: `growing-${quality}`, defId: 'v4-growing-chew-sword', quality, area: 'EQUIPMENT', x: 0, y: 0 },
        ],
      }
      const opponent: FighterSnapshot = { name: 'O', dogType: 'MUTT', wins: 0, losses: 0, round: 7, items: [] }
      const result = simulateBattle(player, opponent, `growing-chew-sword-${quality}`)
      return result.events
        .filter((event) =>
          event.kind === 'ITEM'
          && event.actor === 'player'
          && event.itemId === `growing-${quality}`
          && event.effectType === 'DAMAGE'
        )
        .slice(0, 3)
        .map((event) => event.amount)
    }

    expect(damageSequenceFor('GOLD')).toEqual([2, 7, 12])
    expect(damageSequenceFor('DIAMOND')).toEqual([3, 10, 17])
  })

  it('growing chew sword applies emperor lucky doubling to current unscaled growth base', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'EMPEROR',
      luckyNumber: 2,
      wins: 0,
      losses: 0,
      round: 7,
      items: [
        { id: 'growing-diamond', defId: 'v4-growing-chew-sword', quality: 'DIAMOND', area: 'EQUIPMENT', x: 0, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'MUTT', wins: 0, losses: 0, round: 7, items: [] }
    const result = simulateBattle(player, opponent, 'growing-chew-sword-emperor-5')
    const firstPlayerRoll = result.events.find((event) => event.kind === 'ROLL' && event.actor === 'player')
    const firstHit = result.events.find((event) =>
      event.kind === 'ITEM'
      && event.actor === 'player'
      && event.itemId === 'growing-diamond'
      && event.effectType === 'DAMAGE'
    )
    const firstGrowth = result.events.find((event) =>
      event.kind === 'ITEM'
      && event.actor === 'player'
      && event.itemId === 'growing-diamond'
      && event.effectType === 'UTILITY'
      && event.text.includes('后续伤害提高')
    )

    expect(firstPlayerRoll?.roll).toBe(2)
    expect(firstHit?.amount).toBe(6)
    expect(firstGrowth?.amount).toBe(7)
  })

  it('growing chew sword keeps growth per item instance', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'MUTT',
      wins: 0,
      losses: 0,
      round: 7,
      items: [
        { id: 'left-growth', defId: 'v4-growing-chew-sword', quality: 'SILVER', area: 'EQUIPMENT', x: 0, y: 0 },
        { id: 'right-growth', defId: 'v4-growing-chew-sword', quality: 'SILVER', area: 'EQUIPMENT', x: 2, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'MUTT', wins: 0, losses: 0, round: 7, items: [] }
    const result = simulateBattle(player, opponent, 'growing-chew-sword-instances')
    const hits = result.events.filter((event) =>
      event.kind === 'ITEM'
      && event.actor === 'player'
      && (event.itemId === 'left-growth' || event.itemId === 'right-growth')
      && event.effectType === 'DAMAGE'
    )

    expect(hits.slice(0, 4).map((event) => [event.itemId, event.amount])).toEqual([
      ['left-growth', 1],
      ['right-growth', 1],
      ['left-growth', 4],
      ['right-growth', 4],
    ])
  })

  it('blood contract fang at gold grants lifesteal to left adjacent equipment only', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'SHIBA',
      wins: 0,
      losses: 0,
      round: 6,
      items: [
        { id: 'left-bite', defId: 'starter-1', quality: 'BRONZE', area: 'EQUIPMENT', x: 0, y: 0 },
        { id: 'fang', defId: 'v4-blood-contract-fang', quality: 'GOLD', area: 'EQUIPMENT', x: 1, y: 0 },
        { id: 'right-bite', defId: 'starter-1', quality: 'BRONZE', area: 'EQUIPMENT', x: 3, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = {
      name: 'O',
      dogType: 'SHIBA',
      wins: 0,
      losses: 0,
      round: 6,
      items: [
        { id: 'opener', defId: 'starter-1', quality: 'DIAMOND', area: 'EQUIPMENT', x: 0, y: 0 },
      ],
    }
    const result = simulateBattle(player, opponent, 'blood-contract-gold')
    const grantIndex = result.events.findIndex((event) =>
      event.actor === 'player'
      && event.itemId === 'fang'
      && event.effectType === 'UTILITY'
      && event.text.includes('左侧')
      && event.text.includes('吸血')
    )
    const laterEvents = result.events.slice(grantIndex + 1)
    const leftHeals = laterEvents.filter((event) => event.actor === 'player' && event.itemId === 'left-bite' && event.effectType === 'HEAL')
    const rightHeals = laterEvents.filter((event) => event.actor === 'player' && event.itemId === 'right-bite' && event.effectType === 'HEAL')

    expect(grantIndex).toBeGreaterThanOrEqual(0)
    expect(leftHeals.length).toBeGreaterThan(0)
    expect(leftHeals.some((event) => (event.sourceHpDelta ?? 0) > 0)).toBe(true)
    expect(rightHeals).toEqual([])
  })

  it('blood contract fang aura grants lifesteal before adjacent equipment first trigger', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'SHIBA',
      wins: 0,
      losses: 0,
      round: 6,
      items: [
        { id: 'left-bite', defId: 'starter-1', quality: 'BRONZE', area: 'EQUIPMENT', x: 0, y: 0 },
        { id: 'fang', defId: 'v4-blood-contract-fang', quality: 'GOLD', area: 'EQUIPMENT', x: 1, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = {
      name: 'O',
      dogType: 'SHIBA',
      wins: 0,
      losses: 0,
      round: 6,
      items: [],
    }
    const result = simulateBattle(player, opponent, 'blood-contract-aura-first-trigger')
    const firstLeftDamageIndex = result.events.findIndex((event) =>
      event.actor === 'player'
      && event.itemId === 'left-bite'
      && event.effectType === 'DAMAGE'
    )
    const firstLeftHealIndex = result.events.findIndex((event, index) =>
      index > firstLeftDamageIndex
      && event.actor === 'player'
      && event.itemId === 'left-bite'
      && event.effectType === 'HEAL'
    )
    const rolledFangGrantBeforeHeal = result.events.findIndex((event, index) =>
      index > firstLeftDamageIndex
      && index < firstLeftHealIndex
      && event.actor === 'player'
      && event.itemId === 'fang'
      && event.effectType === 'UTILITY'
      && event.roll != null
    )

    expect(firstLeftDamageIndex).toBeGreaterThanOrEqual(0)
    expect(firstLeftHealIndex).toBe(firstLeftDamageIndex + 1)
    expect(rolledFangGrantBeforeHeal).toBe(-1)
  })

  it('blood contract fang grants lifesteal to wide left adjacent equipment touching edges', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'SHIBA',
      wins: 0,
      losses: 0,
      round: 6,
      items: [
        { id: 'large-left', defId: 'giant-bone', quality: 'BRONZE', area: 'EQUIPMENT', x: 0, y: 0 },
        { id: 'fang', defId: 'v4-blood-contract-fang', quality: 'GOLD', area: 'EQUIPMENT', x: 4, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = {
      name: 'O',
      dogType: 'SHIBA',
      wins: 0,
      losses: 0,
      round: 6,
      items: [
        { id: 'opener', defId: 'starter-1', quality: 'DIAMOND', area: 'EQUIPMENT', x: 0, y: 0 },
      ],
    }
    const result = simulateBattle(player, opponent, 'wide-left-adjacent-blood-contract')
    const grantIndex = result.events.findIndex((event) =>
      event.actor === 'player'
      && event.itemId === 'fang'
      && event.effectType === 'UTILITY'
      && event.text.includes('吸血')
    )
    const laterEvents = result.events.slice(grantIndex + 1)
    const largeDamageIndex = laterEvents.findIndex((event) =>
      event.actor === 'player'
      && event.itemId === 'large-left'
      && event.effectType === 'DAMAGE'
      && (event.targetHpDelta ?? 0) < 0
    )
    const largeHeal = laterEvents.slice(largeDamageIndex + 1).find((event) =>
      event.actor === 'player'
      && event.itemId === 'large-left'
      && event.effectType === 'HEAL'
      && (event.sourceHpDelta ?? 0) > 0
    )

    expect(grantIndex).toBeGreaterThanOrEqual(0)
    expect(largeDamageIndex).toBeGreaterThanOrEqual(0)
    expect(largeHeal).toBeDefined()
  })

  it('blood contract fang at diamond grants lifesteal to both adjacent equipment', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'SHIBA',
      wins: 0,
      losses: 0,
      round: 6,
      items: [
        { id: 'left-bite', defId: 'starter-1', quality: 'BRONZE', area: 'EQUIPMENT', x: 0, y: 0 },
        { id: 'fang', defId: 'v4-blood-contract-fang', quality: 'DIAMOND', area: 'EQUIPMENT', x: 1, y: 0 },
        { id: 'right-bite', defId: 'starter-1', quality: 'BRONZE', area: 'EQUIPMENT', x: 3, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = {
      name: 'O',
      dogType: 'SHIBA',
      wins: 0,
      losses: 0,
      round: 6,
      items: [
        { id: 'opener', defId: 'starter-1', quality: 'DIAMOND', area: 'EQUIPMENT', x: 0, y: 0 },
      ],
    }
    const result = simulateBattle(player, opponent, 'blood-contract-diamond')
    const grantIndex = result.events.findIndex((event) =>
      event.actor === 'player'
      && event.itemId === 'fang'
      && event.effectType === 'UTILITY'
      && event.text.includes('左右【相邻】')
      && event.text.includes('吸血')
    )
    const laterEvents = result.events.slice(grantIndex + 1)
    const leftHeals = laterEvents.filter((event) => event.actor === 'player' && event.itemId === 'left-bite' && event.effectType === 'HEAL')
    const rightHeals = laterEvents.filter((event) => event.actor === 'player' && event.itemId === 'right-bite' && event.effectType === 'HEAL')

    expect(grantIndex).toBeGreaterThanOrEqual(0)
    expect(leftHeals.length).toBeGreaterThan(0)
    expect(rightHeals.length).toBeGreaterThan(0)
    expect([...leftHeals, ...rightHeals].every((event) => (event.sourceHpDelta ?? 0) > 0)).toBe(true)
  })

  it('blood contract lifesteal does not heal for shield-absorbed damage', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'SHIBA',
      wins: 0,
      losses: 0,
      round: 6,
      items: [
        { id: 'left-bite', defId: 'starter-1', quality: 'BRONZE', area: 'EQUIPMENT', x: 0, y: 0 },
        { id: 'fang', defId: 'v4-blood-contract-fang', quality: 'GOLD', area: 'EQUIPMENT', x: 1, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = {
      name: 'O',
      dogType: 'SHIBA',
      wins: 0,
      losses: 0,
      round: 6,
      items: [
        { id: 'shield-a', defId: 'v3-golden-kennel', quality: 'DIAMOND', area: 'EQUIPMENT', x: 0, y: 0 },
        { id: 'shield-b', defId: 'v3-golden-kennel', quality: 'DIAMOND', area: 'EQUIPMENT', x: 4, y: 0 },
        { id: 'opener', defId: 'starter-1', quality: 'DIAMOND', area: 'EQUIPMENT', x: 8, y: 0 },
      ],
    }
    const result = simulateBattle(player, opponent, 'blood-contract-shield')
    const grantIndex = result.events.findIndex((event) =>
      event.actor === 'player'
      && event.itemId === 'fang'
      && event.effectType === 'UTILITY'
      && event.text.includes('吸血')
    )
    const laterEvents = result.events.slice(grantIndex + 1)
    const absorbedHit = laterEvents.find((event) =>
      event.actor === 'player'
      && event.itemId === 'left-bite'
      && event.effectType === 'DAMAGE'
      && event.targetHpDelta === 0
    )
    const absorbedIndex = laterEvents.findIndex((event) => event === absorbedHit)
    const nextEvent = absorbedIndex >= 0 ? laterEvents[absorbedIndex + 1] : undefined

    expect(grantIndex).toBeGreaterThanOrEqual(0)
    expect(absorbedHit).toMatchObject({ amount: 0, targetHpDelta: 0 })
    expect(nextEvent).not.toMatchObject({ actor: 'player', itemId: 'left-bite', effectType: 'HEAL' })
  })

  it('gold boom counter explodes for 380 damage after 50 successful equipment triggers', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'SHIBA',
      wins: 0,
      losses: 0,
      round: 10,
      items: boomCounterTestItems('GOLD'),
    }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'SHIBA', wins: 0, losses: 0, round: 10, items: [] }
    const result = simulateBattle(player, opponent, 'boom-counter-gold')
    const explosion = result.events.find((event) =>
      event.actor === 'player'
      && event.itemId === 'counter'
      && event.defId === 'v4-boom-counter'
      && event.effectType === 'DAMAGE'
      && event.text.includes('【爆鸣计数】达到 50')
    )

    expect(explosion).toMatchObject({
      quality: 'GOLD',
      amount: 380,
      target: 'opponent',
      targetHpDelta: -380,
      boomCounterValue: 0,
      boomCounterMax: 50,
    })
    const explosionIndex = result.events.indexOf(explosion!)
    expect(result.events.slice(0, explosionIndex + 1).filter((event) => event.boomCounterChanged && event.itemId === 'counter').length).toBe(50)
  })

  it('diamond boom counter keeps threshold 50 and damage 570', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'SHIBA',
      wins: 0,
      losses: 0,
      round: 13,
      items: boomCounterTestItems('DIAMOND'),
    }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'SHIBA', wins: 0, losses: 0, round: 13, items: [] }
    const result = simulateBattle(player, opponent, 'boom-counter-diamond')
    const explosion = result.events.find((event) =>
      event.actor === 'player'
      && event.itemId === 'counter'
      && event.effectType === 'DAMAGE'
      && event.text.includes('【爆鸣计数】达到 50')
    )

    expect(explosion).toMatchObject({
      quality: 'DIAMOND',
      amount: 570,
      targetHpDelta: -570,
      boomCounterValue: 0,
      boomCounterMax: 50,
    })
    const explosionIndex = result.events.indexOf(explosion!)
    expect(result.events.slice(0, explosionIndex + 1).filter((event) => event.boomCounterChanged && event.itemId === 'counter').length).toBe(50)
  })

  it('tracks each boom counter item instance independently', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'SHIBA',
      wins: 0,
      losses: 0,
      round: 100,
      items: [
        { id: 'gold-counter', defId: 'v4-boom-counter', quality: 'GOLD', area: 'EQUIPMENT', x: 0, y: 0 },
        { id: 'diamond-counter', defId: 'v4-boom-counter', quality: 'DIAMOND', area: 'EQUIPMENT', x: 2, y: 0 },
        ...Array.from({ length: 10 }, (_, index) => ({
          id: `extreme-${index}`,
          defId: 'v3-chew-scratch-post',
          quality: 'BRONZE' as const,
          area: 'EQUIPMENT' as const,
          x: index + 4,
          y: 0,
        })),
      ],
    }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'SHIBA', wins: 0, losses: 0, round: 100, items: [] }
    const result = simulateBattle(player, opponent, 'two-boom-counters')

    expect(result.events.find((event) => event.itemId === 'gold-counter' && event.effectType === 'DAMAGE')).toMatchObject({
      amount: 380,
      quality: 'GOLD',
      boomCounterValue: 0,
    })
    expect(result.events.find((event) => event.itemId === 'diamond-counter' && event.effectType === 'DAMAGE')).toMatchObject({
      amount: 570,
      quality: 'DIAMOND',
      boomCounterValue: 0,
    })
  })

  it('boom counter explosion does not trigger lifesteal when granted by diamond blood contract fang', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'SHIBA',
      wins: 0,
      losses: 0,
      round: 10,
      items: [
        { id: 'fang', defId: 'v4-blood-contract-fang', quality: 'DIAMOND', area: 'EQUIPMENT', x: 0, y: 0 },
        { id: 'counter', defId: 'v4-boom-counter', quality: 'GOLD', area: 'EQUIPMENT', x: 2, y: 0 },
        ...Array.from({ length: 11 }, (_, index) => ({
          id: `extreme-${index}`,
          defId: 'v3-chew-scratch-post',
          quality: 'BRONZE' as const,
          area: 'EQUIPMENT' as const,
          x: index + 4,
          y: 0,
        })),
      ],
    }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'SHIBA', wins: 0, losses: 0, round: 10, items: [] }
    const result = simulateBattle(player, opponent, 'boom-counter-lifesteal')
    const grantIndex = result.events.findIndex((event) =>
      event.actor === 'player'
      && event.itemId === 'fang'
      && event.effectType === 'UTILITY'
      && event.text.includes('吸血')
    )
    const explosionIndex = result.events.findIndex((event) =>
      event.actor === 'player'
      && event.itemId === 'counter'
      && event.effectType === 'DAMAGE'
      && event.text.includes('【爆鸣计数】达到 50')
    )
    const nextPlayerEvent = result.events.slice(explosionIndex + 1).find((event) => event.actor === 'player')

    expect(grantIndex).toBeGreaterThanOrEqual(0)
    expect(explosionIndex).toBeGreaterThan(grantIndex)
    expect(nextPlayerEvent).not.toMatchObject({ itemId: 'counter', effectType: 'HEAL' })
  })

  it('replaced small items do not count toward boom counter', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'BULLY',
      wins: 0,
      losses: 0,
      round: 10,
      items: [
        ...Array.from({ length: 30 }, (_, index) => ({
          id: `small-${index}`,
          defId: 'starter-1',
          quality: 'BRONZE' as const,
          area: 'EQUIPMENT' as const,
          x: index,
          y: 0,
        })),
        { id: 'counter', defId: 'v4-boom-counter', quality: 'GOLD', area: 'EQUIPMENT', x: 30, y: 0 },
        { id: 'sacrifice', defId: 'bully-sacrifice', quality: 'DIAMOND', area: 'EQUIPMENT', x: 32, y: 0 },
        { id: 'large', defId: 'giant-bone', quality: 'BRONZE', area: 'EQUIPMENT', x: 36, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'SHIBA', wins: 0, losses: 0, round: 10, items: [] }
    const result = simulateBattle(player, opponent, 'sacrifice-boom-4')
    const firstPlayerRollIndex = result.events.findIndex((event) => event.kind === 'ROLL' && event.actor === 'player')
    const firstPlayerRoll = result.events[firstPlayerRollIndex]
    const firstLargeReplacementIndex = result.events.findIndex((event) =>
      event.time === firstPlayerRoll?.time
      && event.actor === 'player'
      && event.itemId === 'large'
      && event.effectType === 'DAMAGE'
    )
    const boomBeforeLargeReplacement = result.events.slice(firstPlayerRollIndex + 1, firstLargeReplacementIndex).find((event) =>
      event.actor === 'player'
      && event.itemId === 'counter'
      && event.defId === 'v4-boom-counter'
      && event.effectType === 'DAMAGE'
    )

    expect(firstPlayerRollIndex).toBeGreaterThanOrEqual(0)
    expect(firstPlayerRoll?.roll).toBe(1)
    expect(firstLargeReplacementIndex).toBeGreaterThan(firstPlayerRollIndex)
    expect(boomBeforeLargeReplacement).toBeUndefined()
  })

  it('resolves deterministic battle logs with poison or victory', () => {
    const player: FighterSnapshot = { name: 'P', dogType: 'MUTT', wins: 0, losses: 0, round: 0, items: baseItems() }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'SHIBA', wins: 0, losses: 0, round: 0, items: baseItems() }
    const result = simulateBattle(player, opponent, 'battle-seed')
    expect(['player', 'opponent']).toContain(result.winner)
    expect(result.duration).toBeGreaterThan(0)
    expect(result.events.some((event) => event.kind === 'ROLL')).toBe(true)
    expect(result.events.at(-1)?.kind).toBe('END')
  })

  it('stops resolving queued equipment once a fighter reaches zero hp', () => {
    const player: FighterSnapshot = { name: 'P', dogType: 'SHIBA', wins: 0, losses: 0, round: 0, items: [] }
    const opponent: FighterSnapshot = {
      name: 'O',
      dogType: 'SHIBA',
      wins: 0,
      losses: 0,
      round: 0,
      items: repeatedEquipment('v3-large-bone-sword', 5).map((item) => ({ ...item, triggerDiceOverride: [1, 2, 3, 4, 5, 6] })),
    }
    const result = simulateBattle(player, opponent, 'queued-death-stop')
    const firstZeroHpIndex = result.events.findIndex((event) => event.playerHp <= 0 || event.opponentHp <= 0)

    expect(firstZeroHpIndex).toBeGreaterThanOrEqual(0)
    expect(result.events[firstZeroHpIndex + 1]?.kind).toBe('END')
    expect(result.events.slice(firstZeroHpIndex + 1, -1)).toEqual([])
  })

  it('applies escalating sudden-death poison after one minute without producing a draw', () => {
    const player: FighterSnapshot = { name: 'P', dogType: 'SHIBA', wins: 0, losses: 0, round: 0, items: [] }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'SHIBA', wins: 0, losses: 0, round: 0, items: [] }
    const result = simulateBattle(player, opponent, 'sudden-death-no-draw')
    const suddenDeathTicks = result.events.filter((event) => event.kind === 'POISON' && event.target === 'both')

    expect(suddenDeathTicks.slice(0, 4).map((event) => event.amount)).toEqual([1, 2, 3, 4])
    expect(result.winner).toBe('player')
  })

  it('settles the two-minute cap by current health percentage instead of absolute health', () => {
    expect(resolveWinnerByHealthPercent({ hp: 60, maxHp: 200 }, { hp: 50, maxHp: 100 })).toBe('opponent')
    expect(resolveWinnerByHealthPercent({ hp: 0, maxHp: 100 }, { hp: 0, maxHp: 100 })).toBe('player')
  })

  it('starts fighters with stepped late-round max health and records it for playback', () => {
    const player: FighterSnapshot = { name: 'P', dogType: 'SHIBA', wins: 0, losses: 0, round: 8, items: [] }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'SHIBA', wins: 0, losses: 0, round: 9, items: [] }
    const result = simulateBattle(player, opponent, 'round-health-growth')
    const boundary = simulateBattle({ ...player, round: 6 }, { ...opponent, round: 7 }, 'round-health-growth-boundary')

    expect(boundary.playerMaxHp).toBe(220)
    expect(boundary.opponentMaxHp).toBe(280)
    expect(result.playerMaxHp).toBe(340)
    expect(result.opponentMaxHp).toBe(410)
    expect(result.events[0]).toMatchObject({
      playerHp: 340,
      playerMaxHp: 340,
      opponentHp: 410,
      opponentMaxHp: 410,
    })
  })

  it('records the exact item instance and effect payload for item triggers', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'SHIBA',
      wins: 0,
      losses: 0,
      round: 0,
      items: [
        { id: 'left-copy', defId: 'starter-1', quality: 'BRONZE', area: 'EQUIPMENT', x: 0, y: 0 },
        { id: 'right-copy', defId: 'starter-1', quality: 'BRONZE', area: 'EQUIPMENT', x: 1, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'SHIBA', wins: 0, losses: 0, round: 0, items: [] }
    const result = simulateBattle(player, opponent, 'structured-item-event')
    const itemEvent = result.events.find((event) => event.kind === 'ITEM' && event.actor === 'player')

    expect(itemEvent).toMatchObject({
      itemId: 'left-copy',
      defId: 'starter-1',
      itemTriggerCount: 1,
      effectType: 'DAMAGE',
      amount: 5,
      target: 'opponent',
      sourceHpDelta: 0,
      targetHpDelta: -5,
    })
    expect(result.playerSnapshot.items[0]).toMatchObject({ id: 'left-copy', def: { id: 'starter-1' } })
    expect(result.opponentSnapshot.items).toEqual([])
  })

  it('lets enchantments add concrete trigger dice to an item instance', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'MUTT',
      wins: 0,
      losses: 0,
      round: 0,
      items: [
        {
          id: 'enchanted-six',
          defId: 'starter-6',
          quality: 'BRONZE',
          area: 'EQUIPMENT',
          x: 0,
          y: 0,
          enchant: { kind: 'EXTRA_DICE', dice: [1, 2, 3, 4, 5], label: '1/2/3/4/5点也触发' },
        },
      ],
    }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'MUTT', wins: 0, losses: 0, round: 0, items: [] }

    const result = simulateBattle(player, opponent, 'enchant-extra-dice')
    const damage = result.events.find((event) => event.kind === 'ITEM' && event.itemId === 'enchanted-six')

    expect(damage).toMatchObject({ effectType: 'DAMAGE', amount: 5, target: 'opponent' })
    expect(result.playerSnapshot.items[0].enchant).toMatchObject({ kind: 'EXTRA_DICE', dice: [1, 2, 3, 4, 5] })
  })

  it('applies flat enchantment effects without scaling them by item quality', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'MUTT',
      wins: 0,
      losses: 0,
      round: 0,
      items: [
        {
          id: 'shield-enchanted',
          defId: 'mutt-old-collar',
          quality: 'DIAMOND',
          area: 'EQUIPMENT',
          x: 0,
          y: 0,
          enchant: { kind: 'BASE_EFFECT', effect: 'SHIELD', amount: 11, label: '触发时获得11护盾' },
        },
      ],
    }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'MUTT', wins: 0, losses: 0, round: 0, items: [] }

    const result = simulateBattle(player, opponent, 'enchant-flat-shield')
    const shield = result.events.find((event) => event.kind === 'ITEM' && event.itemId === 'shield-enchanted' && event.text.includes('附魔'))

    expect(shield).toMatchObject({ effectType: 'UTILITY', amount: 11, target: 'player' })
  })

  it('lets a trigger enchantment queue its neighboring item', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'MUTT',
      wins: 0,
      losses: 0,
      round: 0,
      items: [
        {
          id: 'trigger-source',
          defId: 'mutt-old-collar',
          quality: 'GOLD',
          area: 'EQUIPMENT',
          x: 0,
          y: 0,
          enchant: { kind: 'TRIGGER_NEIGHBOR', target: 'RIGHT', label: '触发右侧装备' },
        },
        { id: 'right-item', defId: 'starter-6', quality: 'BRONZE', area: 'EQUIPMENT', x: 1, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'MUTT', wins: 0, losses: 0, round: 0, items: [] }

    const result = simulateBattle(player, opponent, 'enchant-trigger-right')
    const sourceIndex = result.events.findIndex((event) => event.kind === 'ITEM' && event.itemId === 'trigger-source')
    const rightIndex = result.events.findIndex((event, index) => index > sourceIndex && event.kind === 'ITEM' && event.itemId === 'right-item')

    expect(sourceIndex).toBeGreaterThanOrEqual(0)
    expect(rightIndex).toBeGreaterThan(sourceIndex)
  })

  it('does not let one trigger chain bounce between the same two items forever', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'MUTT',
      wins: 0,
      losses: 0,
      round: 0,
      items: [
        {
          id: 'left-trigger',
          defId: 'starter-1',
          quality: 'BRONZE',
          area: 'EQUIPMENT',
          x: 0,
          y: 0,
          triggerDiceOverride: [1, 2, 3, 4, 5, 6],
          enchant: { kind: 'TRIGGER_NEIGHBOR', target: 'RIGHT', label: 'trigger right' },
        },
        {
          id: 'right-trigger',
          defId: 'starter-1',
          quality: 'BRONZE',
          area: 'EQUIPMENT',
          x: 1,
          y: 0,
          triggerDiceOverride: [1, 2, 3, 4, 5, 6],
          enchant: { kind: 'TRIGGER_NEIGHBOR', target: 'LEFT', label: 'trigger left' },
        },
      ],
    }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'MUTT', wins: 0, losses: 0, round: 0, items: [] }

    const result = simulateBattle(player, opponent, 'trigger-chain-ping-pong')
    const firstPlayerRoll = result.events.find((event) => event.kind === 'ROLL' && event.actor === 'player')
    const firstRollItems = result.events.filter((event) =>
      event.kind === 'ITEM'
      && event.actor === 'player'
      && event.time === firstPlayerRoll?.time
      && (event.itemId === 'left-trigger' || event.itemId === 'right-trigger')
    )

    expect(firstRollItems.map((event) => event.itemId)).toEqual([
      'left-trigger',
      'right-trigger',
      'right-trigger',
      'left-trigger',
      'left-trigger',
      'right-trigger',
    ])
    expect(firstRollItems.some((event) => event.text.includes('触发队列达到上限'))).toBe(false)
  })

  it('shares chain history across branching trigger paths', () => {
    const triggerItem = (id: string, x: number, naturallyTriggered: boolean): FighterSnapshot['items'][number] => ({
      id,
      defId: naturallyTriggered ? 'starter-1' : 'starter-6',
      quality: 'BRONZE',
      area: 'EQUIPMENT',
      x,
      y: 0,
      triggerDiceOverride: naturallyTriggered ? [1] : [6],
      enchant: { kind: 'TRIGGER_NEIGHBOR', target: 'ADJACENT', label: 'trigger adjacent' },
    })
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'BULLY',
      wins: 0,
      losses: 0,
      round: 8,
      items: [
        triggerItem('a', 0, true),
        triggerItem('b', 1, false),
        triggerItem('c', 2, false),
        triggerItem('d', 3, false),
      ],
    }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'BULLY', wins: 0, losses: 0, round: 8, items: [] }

    const result = simulateBattle(player, opponent, 'single-chain-bully-8')
    const firstPlayerRoll = result.events.find((event) => event.kind === 'ROLL' && event.actor === 'player')
    const firstRollItems = result.events.filter((event) =>
      event.kind === 'ITEM'
      && event.actor === 'player'
      && event.time === firstPlayerRoll?.time
      && ['a', 'b', 'c', 'd'].includes(event.itemId ?? '')
    )

    expect(firstPlayerRoll?.roll).toBe(1)
    expect(firstRollItems.map((event) => event.itemId)).toEqual(['a', 'b', 'a', 'c', 'b', 'd', 'c'])
    expect(firstRollItems.some((event) => event.text.includes('触发队列达到上限'))).toBe(false)
  })

  it('lets small bite sometimes inflict weak after dealing damage', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'MUTT',
      wins: 0,
      losses: 0,
      round: 0,
      items: [
        { id: 'small-copy', defId: 'small-bite', quality: 'BRONZE', area: 'EQUIPMENT', x: 0, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'MUTT', wins: 0, losses: 0, round: 0, items: [] }
    const result = simulateBattle(player, opponent, 'small-bite-weak-2')
    const damageEvent = result.events.find((event) => event.kind === 'ITEM' && event.actor === 'player' && event.itemId === 'small-copy' && event.effectType === 'DAMAGE')
    const weakEvent = result.events.find((event) => event.kind === 'ITEM' && event.actor === 'player' && event.itemId === 'small-copy' && event.effectType === 'UTILITY')

    expect(damageEvent).toMatchObject({ amount: 4, target: 'opponent', targetHpDelta: -4 })
    expect(weakEvent).toMatchObject({ amount: 1, target: 'opponent', targetHpDelta: 0 })
    expect(weakEvent?.opponentStatuses?.negative).toContainEqual(expect.objectContaining({ type: 'weak', stacks: 1 }))
  })

  it('lets giant bone stack fury that increases later attack damage', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'EMPEROR',
      wins: 0,
      losses: 0,
      round: 0,
      items: [
        { id: 'bone', defId: 'giant-bone', quality: 'BRONZE', area: 'EQUIPMENT', x: 0, y: 0 },
        { id: 'bite-6', defId: 'starter-6', quality: 'BRONZE', area: 'EQUIPMENT', x: 4, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'EMPEROR', wins: 0, losses: 0, round: 0, items: [] }
    const result = simulateBattle(player, opponent, 'giant-fury-same-0')
    const firstRollTime = result.events.find((event) => event.kind === 'ROLL' && event.actor === 'player')?.time
    const firstRollEvents = result.events.filter((event) => event.kind === 'ITEM' && event.actor === 'player' && event.time === firstRollTime)

    expect(firstRollEvents.map((event) => [event.itemId, event.effectType, event.amount])).toEqual([
      ['bone', 'DAMAGE', 16],
      ['bone', 'UTILITY', 1],
      ['bite-6', 'DAMAGE', 6],
    ])
    expect(firstRollEvents.filter((event) => event.itemId === 'bone').map((event) => event.itemTriggerCount)).toEqual([1, 1])
    expect(firstRollEvents.find((event) => event.itemId === 'bite-6')?.itemTriggerCount).toBe(1)
    expect(firstRollEvents[1].playerStatuses?.positive).toContainEqual(expect.objectContaining({ type: 'fury', stacks: 1 }))
  })

  it('resolves every matching item immediately from left to right on a roll', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'SAMOYED',
      wins: 0,
      losses: 0,
      round: 0,
      items: [
        { id: 'starter', defId: 'starter-6', quality: 'BRONZE', area: 'EQUIPMENT', x: 0, y: 0 },
        { id: 'paw', defId: 'lucky-paw', quality: 'BRONZE', area: 'EQUIPMENT', x: 1, y: 0 },
        { id: 'collar', defId: 'spiked-collar', quality: 'BRONZE', area: 'EQUIPMENT', x: 2, y: 0 },
        { id: 'disc', defId: 'training-disc', quality: 'BRONZE', area: 'EQUIPMENT', x: 4, y: 0 },
        { id: 'bone', defId: 'giant-bone', quality: 'BRONZE', area: 'EQUIPMENT', x: 6, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'SHIBA', wins: 0, losses: 0, round: 0, items: [] }
    const result = simulateBattle(player, opponent, 'plain-10')
    const firstPlayerRoll = result.events.find((event) => event.kind === 'ROLL' && event.actor === 'player')
    const itemEvents = result.events.filter(
      (event) => event.kind === 'ITEM' && event.actor === 'player' && event.time === firstPlayerRoll?.time,
    )

    expect(firstPlayerRoll?.roll).toBe(6)
    expect(itemEvents.map((event) => event.itemId)).toEqual(['starter', 'paw', 'paw', 'collar', 'disc', 'disc', 'disc', 'bone'])
    expect(itemEvents.map((event) => event.targetHpDelta)).toEqual([-5, -5, -5, -8, -3, -3, -3, -16])
    expect(itemEvents.map((event) => event.opponentHp)).toEqual([95, 90, 85, 77, 74, 71, 68, 52])
  })

  it('lets shiba break repeat size-based triggers half the time', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'BULLY',
      wins: 0,
      losses: 0,
      round: 6,
      items: [
        { id: 'break', defId: 'shiba-break', quality: 'DIAMOND', area: 'EQUIPMENT', x: 0, y: 0 },
        { id: 'ball-a', defId: 'rubber-ball', quality: 'BRONZE', area: 'EQUIPMENT', x: 1, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'SHIBA', wins: 0, losses: 0, round: 6, items: [] }
    const result = simulateBattle(player, opponent, 'shiba-break-size-repeat-85')
    const firstPlayerRoll = result.events.find((event) => event.kind === 'ROLL' && event.actor === 'player')
    const ballEvents = result.events.filter(
      (event) => event.time === firstPlayerRoll?.time && event.itemId === 'ball-a' && event.kind === 'ITEM',
    )

    expect(firstPlayerRoll?.roll).toBe(2)
    expect(ballEvents).toHaveLength(4)
    expect(ballEvents.map((event) => event.amount)).toEqual([4, 4, 4, 4])
  })

  it('lets dog house steal one thorn buff from the opponent after healing', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'SHIBA',
      wins: 0,
      losses: 0,
      round: 0,
      items: [
        { id: 'house', defId: 'dog-house', quality: 'BRONZE', area: 'EQUIPMENT', x: 0, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = {
      name: 'O',
      dogType: 'SAMOYED',
      wins: 0,
      losses: 0,
      round: 0,
      items: [],
      relics: [{ id: 'opening-thorns', relicId: 'v3-fluffed-spike-collar', quality: 'GOLD', slot: 0 }],
    }

    const result = simulateBattle(player, opponent, 'dog-house-seed-0')
    const steal = result.events.find((event) => event.itemId === 'house' && event.text.includes('偷取 1 层【荆棘】'))

    expect(steal?.playerStatuses?.positive).toContainEqual(expect.objectContaining({ type: 'thorns', stacks: 1 }))
    expect(steal?.opponentStatuses?.positive).toContainEqual(expect.objectContaining({ type: 'thorns', stacks: 4 }))
  })

  it('lets dog house steal one speed buff when the opponent has no thorns', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'SHIBA',
      wins: 0,
      losses: 0,
      round: 0,
      items: [
        { id: 'house', defId: 'dog-house', quality: 'BRONZE', area: 'EQUIPMENT', x: 0, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = {
      name: 'O',
      dogType: 'SHIBA',
      wins: 0,
      losses: 0,
      round: 0,
      items: [
        { id: 'speed', defId: 'shiba-speed-katana', quality: 'GOLD', area: 'EQUIPMENT', x: 0, y: 0 },
      ],
    }

    const result = simulateBattle(player, opponent, 'dog-house-speed-0')
    const steal = result.events.find((event) => event.itemId === 'house' && event.text.includes('偷取 1 层【加速】'))

    expect(steal?.playerStatuses?.positive).toContainEqual(expect.objectContaining({ type: 'extraRoll', stacks: 1 }))
    expect(steal?.opponentStatuses?.positive ?? []).not.toContainEqual(expect.objectContaining({ type: 'extraRoll' }))
  })

  it('does not let dog house steal shield because shield is special health', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'SHIBA',
      wins: 0,
      losses: 0,
      round: 0,
      items: [
        { id: 'house', defId: 'dog-house', quality: 'BRONZE', area: 'EQUIPMENT', x: 0, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = {
      name: 'O',
      dogType: 'SHIBA',
      wins: 0,
      losses: 0,
      round: 0,
      items: [
        { id: 'shield', defId: 'v3-cone-collar', quality: 'BRONZE', area: 'EQUIPMENT', x: 0, y: 0 },
      ],
    }

    const result = simulateBattle(player, opponent, 'dog-house-shield-2')
    const shieldEvent = result.events.find((event) => event.itemId === 'shield')
    const houseEvents = result.events.filter((event) => event.itemId === 'house')

    expect(shieldEvent?.opponentShield).toBe(3)
    expect(houseEvents.some((event) => event.text.includes('偷取'))).toBe(false)
  })

  it('scales item effects by quality with rounded 1.5x steps', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'SHIBA',
      wins: 0,
      losses: 0,
      round: 0,
      items: [
        { id: 'silver-copy', defId: 'starter-1', quality: 'SILVER', area: 'EQUIPMENT', x: 0, y: 0 },
        { id: 'gold-copy', defId: 'starter-1', quality: 'GOLD', area: 'EQUIPMENT', x: 1, y: 0 },
        { id: 'diamond-copy', defId: 'starter-1', quality: 'DIAMOND', area: 'EQUIPMENT', x: 2, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'SHIBA', wins: 0, losses: 0, round: 0, items: [] }
    const result = simulateBattle(player, opponent, 'structured-item-event')
    const itemAmounts = result.events
      .filter((event) => event.kind === 'ITEM' && event.actor === 'player')
      .map((event) => event.amount)

    expect(itemAmounts.slice(0, 3)).toEqual([8, 11, 17])
    expect(result.playerSnapshot.items.map((item) => item.quality)).toEqual(['SILVER', 'GOLD', 'DIAMOND'])
  })

  it('lets bully double a triggered large item effect when its trait procs', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'BULLY',
      wins: 0,
      losses: 0,
      round: 0,
      items: [
        { id: 'large-copy', defId: 'giant-bone', quality: 'BRONZE', area: 'EQUIPMENT', x: 0, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'SHIBA', wins: 0, losses: 0, round: 0, items: [] }
    const result = simulateBattle(player, opponent, 'bully-large-11')
    const itemEvent = result.events.find((event) => event.kind === 'ITEM' && event.actor === 'player')

    expect(itemEvent).toMatchObject({
      itemId: 'large-copy',
      amount: 32,
      targetHpDelta: -32,
    })
  })

  it('does not let bully double triggered non-large item effects', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'BULLY',
      wins: 0,
      losses: 0,
      round: 0,
      items: [
        { id: 'medium-copy', defId: 'spiked-collar', quality: 'BRONZE', area: 'EQUIPMENT', x: 0, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'SHIBA', wins: 0, losses: 0, round: 0, items: [] }
    const result = simulateBattle(player, opponent, 'bully-small-17')
    const itemEvent = result.events.find((event) => event.kind === 'ITEM' && event.actor === 'player')

    expect(itemEvent).toMatchObject({
      itemId: 'medium-copy',
      amount: 8,
      targetHpDelta: -8,
    })
  })

  it('makes ruthless sacrifice replace small item effects with large item triggers', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'BULLY',
      wins: 0,
      losses: 0,
      round: 0,
      items: [
        { id: 'small-copy', defId: 'small-bite', quality: 'BRONZE', area: 'EQUIPMENT', x: 0, y: 0 },
        { id: 'large-copy', defId: 'giant-bone', quality: 'BRONZE', area: 'EQUIPMENT', x: 1, y: 0 },
        { id: 'sacrifice', defId: 'bully-sacrifice', quality: 'DIAMOND', area: 'EQUIPMENT', x: 5, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'SHIBA', wins: 0, losses: 0, round: 0, items: [] }
    const result = simulateBattle(player, opponent, 'structured-item-event')
    const firstPlayerRoll = result.events.find((event) => event.kind === 'ROLL' && event.actor === 'player')
    const firstRollItemEvents = result.events.filter(
      (event) => event.kind === 'ITEM' && event.actor === 'player' && event.time === firstPlayerRoll?.time,
    )
    const largeEvent = firstRollItemEvents.find((event) => event.itemId === 'large-copy')

    expect(firstPlayerRoll?.roll).toBe(2)
    expect(firstRollItemEvents.some((event) => event.itemId === 'small-copy')).toBe(false)
    expect(largeEvent).toMatchObject({ defId: 'giant-bone', effectType: 'DAMAGE' })
    expect(largeEvent?.amount).toBeGreaterThanOrEqual(16)
    expect(largeEvent?.targetHpDelta).toBe(-(largeEvent?.amount ?? 0))
  })

  it('lets dog emperor double triggered item effects when the lucky number procs', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'EMPEROR',
      luckyNumber: 5,
      wins: 0,
      losses: 0,
      round: 0,
      items: [
        { id: 'lucky-copy', defId: 'giant-bone', quality: 'BRONZE', area: 'EQUIPMENT', x: 0, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'SHIBA', wins: 0, losses: 0, round: 0, items: [] }
    const result = simulateBattle(player, opponent, 'emperor-2')
    const itemEvent = result.events.find((event) => event.kind === 'ITEM' && event.actor === 'player')

    expect(itemEvent).toMatchObject({
      itemId: 'lucky-copy',
      amount: 32,
      targetHpDelta: -32,
    })
    expect(itemEvent?.text).toContain('狗皇帝幸运翻倍')
    expect(result.playerSnapshot.luckyNumber).toBe(5)
  })

  it('does not let dog emperor double item effects on non-lucky rolls', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'EMPEROR',
      luckyNumber: 4,
      wins: 0,
      losses: 0,
      round: 0,
      items: [
        { id: 'plain-copy', defId: 'giant-bone', quality: 'BRONZE', area: 'EQUIPMENT', x: 0, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'SHIBA', wins: 0, losses: 0, round: 0, items: [] }
    const result = simulateBattle(player, opponent, 'emperor-2')
    const itemEvent = result.events.find((event) => event.kind === 'ITEM' && event.actor === 'player')

    expect(itemEvent).toMatchObject({
      itemId: 'plain-copy',
      amount: 16,
      targetHpDelta: -16,
    })
    expect(itemEvent?.text).not.toContain('狗皇帝幸运翻倍')
  })

  it('lets point-mapping relics trigger opposite half equipment with reduced effect', () => {
    const relics: RelicInstance[] = [{ id: 'r1', relicId: 'midas-left', quality: 'SILVER', slot: 0 }]
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'SHIBA',
      wins: 0,
      losses: 0,
      round: 4,
      relics,
      items: [
        { id: 'big-copy', defId: 'lucky-paw', quality: 'BRONZE', area: 'EQUIPMENT', x: 0, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'SHIBA', wins: 0, losses: 0, round: 4, items: [] }
    const result = simulateBattle(player, opponent, 'structured-item-event')
    const mapped = result.events.find((event) => event.kind === 'ITEM' && event.defId === 'lucky-paw' && event.text.includes('点金手·左'))

    expect(mapped).toMatchObject({ roll: 3, amount: 3, targetHpDelta: -3 })
    expect(mapped?.text).toContain('点金手·左')
    expect(result.playerSnapshot.relics?.[0]).toMatchObject({ relicId: 'midas-left', def: { name: '点金手·左' } })
  })

  it('scales point-mapping relic strength by quality', () => {
    const relics: RelicInstance[] = [{ id: 'r1', relicId: 'midas-left', quality: 'GOLD', slot: 0 }]
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'SHIBA',
      wins: 0,
      losses: 0,
      round: 4,
      relics,
      items: [
        { id: 'big-copy', defId: 'lucky-paw', quality: 'BRONZE', area: 'EQUIPMENT', x: 0, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'SHIBA', wins: 0, losses: 0, round: 4, items: [] }
    const result = simulateBattle(player, opponent, 'structured-item-event')
    const mapped = result.events.find((event) => event.kind === 'ITEM' && event.defId === 'lucky-paw' && event.text.includes('点金手·左'))

    expect(mapped).toMatchObject({ roll: 3, amount: 4, targetHpDelta: -4 })
  })

  it('makes carrot shift equipped trigger dice up with wraparound', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'BULLY',
      wins: 0,
      losses: 0,
      round: 4,
      relics: [{ id: 'carrot', relicId: 'carrot', quality: 'SILVER', slot: 0 }],
      items: [
        { id: 'paw', defId: 'lucky-paw', quality: 'BRONZE', area: 'EQUIPMENT', x: 0, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'BULLY', wins: 0, losses: 0, round: 4, items: [] }
    const shifted = simulateBattle(player, opponent, 'shift-11')
    const original = simulateBattle(player, opponent, 'shift-9')
    const shiftedRoll = shifted.events.find((event) => event.kind === 'ROLL' && event.actor === 'player')
    const originalRoll = original.events.find((event) => event.kind === 'ROLL' && event.actor === 'player')

    expect(shifted.events.find((event) => event.time === shiftedRoll?.time && event.kind === 'ITEM' && event.itemId === 'paw')).toMatchObject({ roll: 1, amount: 5 })
    expect(original.events.find((event) => event.time === originalRoll?.time && event.kind === 'ITEM' && event.itemId === 'paw')).toBeUndefined()
  })

  it('applies potion trigger dice overrides before carrot remaps trigger dice', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'BULLY',
      wins: 0,
      losses: 0,
      round: 4,
      relics: [{ id: 'carrot', relicId: 'carrot', quality: 'SILVER', slot: 0 }],
      items: [
        { id: 'paw', defId: 'lucky-paw', quality: 'BRONZE', area: 'EQUIPMENT', x: 0, y: 0, triggerDiceOverride: [1] },
      ],
    }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'BULLY', wins: 0, losses: 0, round: 4, items: [] }
    const result = simulateBattle(player, opponent, 'potion-shift-1')
    const roll = result.events.find((event) => event.kind === 'ROLL' && event.actor === 'player')

    expect(roll?.roll).toBe(2)
    expect(result.events.find((event) => event.time === roll?.time && event.kind === 'ITEM' && event.itemId === 'paw')).toMatchObject({ roll: 2, amount: 5 })
  })

  it('makes tissue shift equipped trigger dice down with wraparound', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'BULLY',
      wins: 0,
      losses: 0,
      round: 4,
      relics: [{ id: 'tissue', relicId: 'tissue', quality: 'SILVER', slot: 0 }],
      items: [
        { id: 'bite', defId: 'starter-1', quality: 'BRONZE', area: 'EQUIPMENT', x: 0, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'BULLY', wins: 0, losses: 0, round: 4, items: [] }
    const shifted = simulateBattle(player, opponent, 'shift-9')
    const original = simulateBattle(player, opponent, 'shift-11')
    const shiftedRoll = shifted.events.find((event) => event.kind === 'ROLL' && event.actor === 'player')
    const originalRoll = original.events.find((event) => event.kind === 'ROLL' && event.actor === 'player')

    expect(shifted.events.find((event) => event.time === shiftedRoll?.time && event.kind === 'ITEM' && event.itemId === 'bite')).toMatchObject({ roll: 6, amount: 5 })
    expect(original.events.find((event) => event.time === originalRoll?.time && event.kind === 'ITEM' && event.itemId === 'bite')).toBeUndefined()
  })

  it('lets half-die relics restrict rolls while reducing equipment effects', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'SAMOYED',
      wins: 0,
      losses: 0,
      round: 4,
      relics: [{ id: 'r1', relicId: 'half-die-right', quality: 'SILVER', slot: 0 }],
      items: [
        { id: 'small-copy', defId: 'small-bite', quality: 'BRONZE', area: 'EQUIPMENT', x: 0, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'SHIBA', wins: 0, losses: 0, round: 4, items: [] }
    const result = simulateBattle(player, opponent, 'plain-10')
    const rolls = result.events.filter((event) => event.kind === 'ROLL' && event.actor === 'player').map((event) => event.roll)
    const itemEvent = result.events.find((event) => event.kind === 'ITEM' && event.actor === 'player')

    expect(rolls.every((roll) => roll != null && roll <= 3)).toBe(true)
    expect(itemEvent).toMatchObject({ amount: 2, targetHpDelta: -2 })
  })

  it('scales half-die relic penalties by quality', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'SAMOYED',
      wins: 0,
      losses: 0,
      round: 4,
      relics: [{ id: 'r1', relicId: 'half-die-right', quality: 'GOLD', slot: 0 }],
      items: [
        { id: 'small-copy', defId: 'small-bite', quality: 'BRONZE', area: 'EQUIPMENT', x: 0, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'SHIBA', wins: 0, losses: 0, round: 4, items: [] }
    const result = simulateBattle(player, opponent, 'plain-10')
    const rolls = result.events.filter((event) => event.kind === 'ROLL' && event.actor === 'player').map((event) => event.roll)
    const itemEvent = result.events.find((event) => event.kind === 'ITEM' && event.actor === 'player')

    expect(rolls.every((roll) => roll != null && roll <= 3)).toBe(true)
    expect(itemEvent).toMatchObject({ amount: 3, targetHpDelta: -3 })
  })

  it('does not let mutt extra-roll support items loop during a normal roll', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'MUTT',
      wins: 0,
      losses: 0,
      round: 6,
      items: [
        { id: 'chase-car', defId: 'mutt-chase-car', quality: 'DIAMOND', area: 'EQUIPMENT', x: 0, y: 0 },
        { id: 'bite', defId: 'starter-1', quality: 'BRONZE', area: 'EQUIPMENT', x: 1, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'SHIBA', wins: 0, losses: 0, round: 6, items: [] }
    const result = simulateBattle(player, opponent, 'mutt-normal-roll-no-loop')
    const firstPlayerRoll = result.events.find((event) => event.kind === 'ROLL' && event.actor === 'player')
    const firstRollDamageItems = result.events.filter(
      (event) => event.kind === 'ITEM'
        && event.actor === 'player'
        && event.time === firstPlayerRoll?.time
        && event.effectType === 'DAMAGE',
    )

    expect(firstPlayerRoll?.roll).toBe(4)
    expect(firstRollDamageItems).toEqual([])
  })

  it('lets shields stack above max health and absorb normal damage before health', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'SHIBA',
      wins: 0,
      losses: 0,
      round: 0,
      items: [
        { id: 'shield-a', defId: 'v3-wooden-shield', quality: 'DIAMOND', area: 'EQUIPMENT', x: 0, y: 0 },
        { id: 'shield-b', defId: 'v3-wooden-shield', quality: 'DIAMOND', area: 'EQUIPMENT', x: 2, y: 0 },
        { id: 'shield-c', defId: 'v3-wooden-shield', quality: 'DIAMOND', area: 'EQUIPMENT', x: 4, y: 0 },
        { id: 'shield-d', defId: 'v3-wooden-shield', quality: 'DIAMOND', area: 'EQUIPMENT', x: 6, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = {
      name: 'O',
      dogType: 'SHIBA',
      wins: 0,
      losses: 0,
      round: 0,
      items: [
        { id: 'bite', defId: 'starter-1', quality: 'BRONZE', area: 'EQUIPMENT', x: 0, y: 0 },
      ],
    }
    const result = simulateBattle(player, opponent, 'shield-2')
    const shieldEvents = result.events.filter((event) => event.itemId?.startsWith('shield-'))
    const absorbedDamage = result.events.find((event) => event.actor === 'opponent' && event.kind === 'ITEM' && event.effectType === 'DAMAGE' && event.targetHpDelta === 0)

    expect(shieldEvents.length).toBeGreaterThanOrEqual(2)
    expect(shieldEvents.reduce((sum, event) => sum + (event.amount ?? 0), 0)).toBeGreaterThan(100)
    expect(absorbedDamage).toMatchObject({ playerHp: 100, targetHpDelta: 0 })
  })

  it('keeps wooden shield as a normal-attack counter without extreme shield banking', () => {
    let maxShieldBeforePoison = 0
    let zeroHealthDamageHits = 0
    let attackHits = 0
    const sampleCount = 40

    for (let index = 0; index < sampleCount; index += 1) {
      const result = simulateBattle(
        lateGameFighter('P', 'SHIBA', repeatedEquipment('v3-wooden-shield', 4)),
        lateGameFighter('O', 'SHIBA', repeatedEquipment('v3-large-bone-sword', 4)),
        `wooden-shield-balance-${index}`,
      )
      maxShieldBeforePoison += Math.max(...result.events.filter((event) => event.time <= 60).map((event) => event.playerShield))

      for (const event of result.events.filter((entry) => entry.time <= 60 && entry.actor === 'opponent' && entry.kind === 'ITEM' && entry.effectType === 'DAMAGE')) {
        attackHits += 1
        if (event.targetHpDelta === 0) zeroHealthDamageHits += 1
      }
    }

    expect(maxShieldBeforePoison / sampleCount).toBeLessThan(900)
    expect(zeroHealthDamageHits / attackHits).toBeGreaterThan(0.85)
  })

  it('lets stable shield-break equipment answer stacked wooden shields', () => {
    let hpAtPoisonRamp = 0
    let shieldAtPoisonRamp = 0
    const sampleCount = 40

    for (let index = 0; index < sampleCount; index += 1) {
      const result = simulateBattle(
        lateGameFighter('P', 'SHIBA', repeatedEquipment('v3-wooden-shield', 4)),
        lateGameFighter('O', 'SHIBA', repeatedEquipment('v3-dinosaur-leg-bone', 4)),
        `shield-break-balance-${index}`,
      )
      const event = eventAtOrBefore(result, 60)
      hpAtPoisonRamp += event.playerHp
      shieldAtPoisonRamp += event.playerShield
    }

    expect(hpAtPoisonRamp / sampleCount).toBeLessThan(5)
    expect(shieldAtPoisonRamp / sampleCount).toBeLessThan(20)
  })

  it('keeps high-output healing from outpacing equal-quality sustained damage', () => {
    let watererWins = 0
    let softFurWins = 0
    const sampleCount = 40

    for (let index = 0; index < sampleCount; index += 1) {
      const watererResult = simulateBattle(
        lateGameFighter('P', 'SHIBA', repeatedEquipment('v3-auto-waterer', 4)),
        lateGameFighter('O', 'SHIBA', repeatedEquipment('v3-large-bone-sword', 4)),
        `auto-waterer-balance-${index}`,
      )
      if (watererResult.winner === 'player') watererWins += 1

      const softFurResult = simulateBattle(
        lateGameFighter('P', 'SAMOYED', repeatedEquipment('samoyed-soft-fur', 4)),
        lateGameFighter('O', 'SHIBA', repeatedEquipment('v3-large-bone-sword', 4)),
        `soft-fur-balance-${index}`,
      )
      if (softFurResult.winner === 'player') softFurWins += 1
    }

    expect(watererWins).toBeLessThanOrEqual(8)
    expect(softFurWins).toBeLessThanOrEqual(3)
  })

  it('records current shield values on each battle event', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'SHIBA',
      wins: 0,
      losses: 0,
      round: 0,
      items: [
        { id: 'shield', defId: 'v3-golden-kennel', quality: 'DIAMOND', area: 'EQUIPMENT', x: 0, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = {
      name: 'O',
      dogType: 'SHIBA',
      wins: 0,
      losses: 0,
      round: 0,
      items: [
        { id: 'bite', defId: 'starter-1', quality: 'BRONZE', area: 'EQUIPMENT', x: 0, y: 0 },
      ],
    }

    const result = simulateBattle(player, opponent, 'shield-ui-events')
    const shieldEvent = result.events.find((event) => event.itemId === 'shield')

    expect(shieldEvent?.playerShield).toBeGreaterThan(0)
    expect(result.events.every((event) => typeof event.playerShield === 'number' && typeof event.opponentShield === 'number')).toBe(true)
  })

  it('applies the golden kennel shield as its toned-down diamond value', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'SHIBA',
      wins: 0,
      losses: 0,
      round: 0,
      items: [
        { id: 'shield', defId: 'v3-golden-kennel', quality: 'DIAMOND', area: 'EQUIPMENT', x: 0, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'SHIBA', wins: 0, losses: 0, round: 0, items: [] }
    const result = simulateBattle(player, opponent, 'shield-ui-events')
    const shieldEvent = result.events.find((event) => event.itemId === 'shield')

    expect(shieldEvent).toMatchObject({ amount: 14, playerShield: 14 })
  })

  it('records positive and negative status snapshots on battle events', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'SHIBA',
      wins: 0,
      losses: 0,
      round: 0,
      items: [
        { id: 'poison', defId: 'shiba-poison', quality: 'DIAMOND', area: 'EQUIPMENT', x: 0, y: 0 },
        { id: 'shield', defId: 'v3-cone-collar', quality: 'BRONZE', area: 'EQUIPMENT', x: 1, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'SHIBA', wins: 0, losses: 0, round: 0, items: [] }
    const result = simulateBattle(player, opponent, 'status-snapshot')
    const poisonApply = result.events.find((event) => event.defId === 'shiba-poison' && event.effectType === 'POISON')
    const poisonTick = result.events.find((event) => event.kind === 'POISON' && event.target === 'opponent')
    const shieldEvent = result.events.find((event) => event.defId === 'v3-cone-collar')

    expect(poisonApply?.opponentStatuses?.negative).toContainEqual(expect.objectContaining({ type: 'poison', stacks: 6, nextTickIn: 1, tickDamage: 6 }))
    expect(poisonTick?.opponentStatuses?.negative).toContainEqual(expect.objectContaining({ type: 'poison', stacks: 6, tickDamage: 6 }))
    expect(shieldEvent?.playerShield).toBe(3)
    expect(shieldEvent?.playerStatuses?.positive ?? []).not.toContainEqual(expect.objectContaining({ type: 'shield' }))
  })

  it('lets golden kennel fully block poison and weak while shielded', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'SHIBA',
      wins: 0,
      losses: 0,
      round: 0,
      items: [
        { id: 'shield-a', defId: 'v3-golden-kennel', quality: 'DIAMOND', area: 'EQUIPMENT', x: 0, y: 0 },
        { id: 'shield-b', defId: 'v3-golden-kennel', quality: 'DIAMOND', area: 'EQUIPMENT', x: 4, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = {
      name: 'O',
      dogType: 'SHIBA',
      wins: 0,
      losses: 0,
      round: 0,
      items: [
        { id: 'poison', defId: 'shiba-poison', quality: 'DIAMOND', area: 'EQUIPMENT', x: 0, y: 0 },
        { id: 'weak', defId: 'v3-hydrant-axe', quality: 'BRONZE', area: 'EQUIPMENT', x: 1, y: 0 },
      ],
    }
    const result = simulateBattle(player, opponent, 'shield-first-3')
    const poisonApplyWhileShielded = result.events.find((event) => event.defId === 'shiba-poison' && event.effectType === 'POISON' && event.playerShield > 0)
    const weakApplyWhileShielded = result.events.find((event) => event.defId === 'v3-hydrant-axe' && event.effectType === 'UTILITY' && event.playerShield > 0)
    const poisonTickWhileShielded = result.events.find((event) => event.kind === 'POISON' && event.target === 'player' && event.playerShield > 0)
    const weakAttackWhileShielded = result.events.find((event) => event.defId === 'v3-hydrant-axe' && event.effectType === 'DAMAGE' && event.playerShield > 0)

    expect(weakAttackWhileShielded).toBeDefined()
    expect(poisonApplyWhileShielded).toBeUndefined()
    expect(weakApplyWhileShielded).toBeUndefined()
    expect(poisonTickWhileShielded).toBeUndefined()
  })

  it('lets spiked vest grant one shield while keeping its thorns', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'SHIBA',
      wins: 0,
      losses: 0,
      round: 0,
      items: [
        { id: 'vest', defId: 'v3-spiked-vest', quality: 'BRONZE', area: 'EQUIPMENT', x: 0, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'SHIBA', wins: 0, losses: 0, round: 0, items: [] }
    const result = simulateBattle(player, opponent, 'spiked-vest-shield-thorns')
    const vestEvent = result.events.find((event) => event.itemId === 'vest')

    expect(vestEvent).toMatchObject({ amount: 1, playerShield: 1 })
    expect(vestEvent?.playerStatuses?.positive).toContainEqual(expect.objectContaining({ type: 'thorns', stacks: 1 }))
  })

  it('lets chase car extra-roll fanout trigger one other equipment twice', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'MUTT',
      wins: 0,
      losses: 0,
      round: 6,
      items: [
        { id: 'chase-car', defId: 'mutt-chase-car', quality: 'DIAMOND', area: 'EQUIPMENT', x: 0, y: 0 },
        { id: 'bite-a', defId: 'starter-2', quality: 'BRONZE', area: 'EQUIPMENT', x: 1, y: 0 },
        { id: 'bite-b', defId: 'starter-2', quality: 'BRONZE', area: 'EQUIPMENT', x: 2, y: 0 },
        { id: 'bite-c', defId: 'starter-2', quality: 'BRONZE', area: 'EQUIPMENT', x: 3, y: 0 },
        { id: 'bite-d', defId: 'starter-2', quality: 'BRONZE', area: 'EQUIPMENT', x: 4, y: 0 },
        { id: 'counter', defId: 'mutt-counting-collar', quality: 'GOLD', area: 'EQUIPMENT', x: 5, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'SHIBA', wins: 0, losses: 0, round: 6, items: [] }
    const result = simulateBattle(player, opponent, 'mutt-chase-car-fanout-limit')
    const firstExtraRoll = result.events.find((event) => event.kind === 'ROLL' && event.actor === 'player' && event.text.includes('额外'))
    const extraRollDamage = result.events.filter((event) =>
      event.time === firstExtraRoll?.time
      && event.actor === 'player'
      && event.kind === 'ITEM'
      && event.effectType === 'DAMAGE'
    )

    expect(firstExtraRoll).toBeDefined()
    expect(extraRollDamage.map((event) => event.itemId)).toEqual(['bite-a', 'bite-a'])
  })

  it('uses frog reservoir timing instead of base rolls for explicit trigger dice equipment', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'FROG' as never,
      wins: 0,
      losses: 0,
      round: 0,
      items: [
        { id: 'one', defId: 'starter-1', quality: 'BRONZE', area: 'EQUIPMENT', x: 0, y: 0 },
        { id: 'three', defId: 'small-bite', quality: 'BRONZE', area: 'EQUIPMENT', x: 1, y: 0 },
        { id: 'six', defId: 'starter-6', quality: 'BRONZE', area: 'EQUIPMENT', x: 2, y: 0, triggerDiceOverride: [1, 2, 3, 4, 5, 6] },
      ],
    }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'SHIBA', wins: 0, losses: 0, round: 0, items: [] }
    const result = simulateBattle(player, opponent, 'frog-reservoir-basic')
    const firstByItem = (itemId: string) => result.events.find((event) => event.kind === 'ITEM' && event.itemId === itemId)

    expect(firstByItem('six')?.time).toBe(0.5)
    expect(firstByItem('three')?.time).toBe(1)
    expect(firstByItem('one')?.time).toBe(3)
    const oneEvents = result.events.filter((event) => event.kind === 'ITEM' && event.itemId === 'one')
    expect(oneEvents.slice(0, 2).map((event) => event.time)).toEqual([3, 9])
    expect(result.events.find((event) => event.kind === 'ROLL' && event.actor === 'player')).toBeUndefined()
    expect((eventAtOrBefore(result, 1) as never as { reservoirs?: { player: Array<{ itemId: string; duration: number; progress: number; nextAt: number }> } }).reservoirs?.player)
      .toContainEqual(expect.objectContaining({ itemId: 'one', duration: 6, progress: expect.closeTo(0.6667, 3), nextAt: 3 }))
  })

  it('stores overflow progress when frog reservoir charging pushes an item past full', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'FROG' as never,
      wins: 0,
      losses: 0,
      round: 0,
      items: [
        { id: 'funnel', defId: 'frog-raindrop-funnel', quality: 'GOLD', area: 'EQUIPMENT', x: 0, y: 0 },
        { id: 'bite', defId: 'small-bite', quality: 'BRONZE', area: 'EQUIPMENT', x: 1, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'SHIBA', wins: 0, losses: 0, round: 0, items: [] }
    const result = simulateBattle(player, opponent, 'frog-reservoir-overflow')
    const biteEvents = result.events.filter((event) => event.kind === 'ITEM' && event.actor === 'player' && event.itemId === 'bite' && event.effectType === 'DAMAGE')
    const firstBiteReservoir = (biteEvents[0] as never as { reservoirs?: { player: Array<{ itemId: string; duration: number; progress: number; nextAt: number }> } })?.reservoirs?.player

    expect(biteEvents.slice(0, 2).map((event) => event.time)).toEqual([1, 2])
    expect(firstBiteReservoir).toContainEqual(expect.objectContaining({ itemId: 'bite', duration: 2, progress: 0.5, nextAt: 2 }))
  })

  it('counts only explicit trigger dice when frog reservoir timing is changed by potions, enchants, and relic shifts', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'FROG' as never,
      wins: 0,
      losses: 0,
      round: 0,
      relics: [{ id: 'carrot', relicId: 'carrot', quality: 'SILVER', slot: 0 }, { id: 'midas', relicId: 'midas-left', quality: 'SILVER', slot: 1 }],
      items: [
        { id: 'potion', defId: 'starter-1', quality: 'BRONZE', area: 'EQUIPMENT', x: 0, y: 0, triggerDiceOverride: [1, 2] },
        { id: 'enchant', defId: 'starter-1', quality: 'BRONZE', area: 'EQUIPMENT', x: 1, y: 0, enchant: { kind: 'EXTRA_DICE', dice: [3], label: '额外在 3 点触发' } },
        { id: 'mapped', defId: 'lucky-paw', quality: 'BRONZE', area: 'EQUIPMENT', x: 2, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'SHIBA', wins: 0, losses: 0, round: 0, items: [] }
    const result = simulateBattle(player, opponent, 'frog-reservoir-explicit-dice')
    const firstByItem = (itemId: string) => result.events.find((event) => event.kind === 'ITEM' && event.itemId === itemId)

    expect(firstByItem('potion')?.time).toBe(1.5)
    expect(firstByItem('enchant')?.time).toBe(1.5)
    expect(firstByItem('mapped')?.time).toBe(3)
  })

  it('keeps no-dice equipment on original non-reservoir rules for frog', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'FROG' as never,
      wins: 0,
      losses: 0,
      round: 0,
      items: [
        { id: 'ingot', defId: 'dog-gold-ingot', quality: 'BRONZE', area: 'EQUIPMENT', x: 0, y: 0 },
        { id: 'bite', defId: 'starter-1', quality: 'BRONZE', area: 'EQUIPMENT', x: 1, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'SHIBA', wins: 0, losses: 0, round: 0, items: [] }
    const result = simulateBattle(player, opponent, 'frog-no-dice')

    expect(result.events.some((event) => event.kind === 'ITEM' && event.itemId === 'ingot')).toBe(false)
    expect((eventAtOrBefore(result, 1) as never as { reservoirs?: { player: Array<{ itemId: string }> } }).reservoirs?.player)
      .toEqual([expect.objectContaining({ itemId: 'bite' })])
  })

  it('lets frog class equipment accelerate reservoirs and create ordinary roll activations', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'FROG' as never,
      wins: 0,
      losses: 0,
      round: 6,
      items: [
        { id: 'pump', defId: 'frog-lily-pump', quality: 'GOLD', area: 'EQUIPMENT', x: 0, y: 0 },
        { id: 'drum', defId: 'frog-croak-drum', quality: 'GOLD', area: 'EQUIPMENT', x: 1, y: 0 },
        { id: 'funnel', defId: 'frog-raindrop-funnel', quality: 'GOLD', area: 'EQUIPMENT', x: 2, y: 0 },
        { id: 'echo', defId: 'frog-lotus-echo', quality: 'DIAMOND', area: 'EQUIPMENT', x: 3, y: 0 },
        { id: 'storm', defId: 'frog-rainy-season', quality: 'DIAMOND', area: 'EQUIPMENT', x: 4, y: 0 },
        { id: 'gate', defId: 'frog-full-pond-gate', quality: 'DIAMOND', area: 'EQUIPMENT', x: 5, y: 0 },
        { id: 'bite-a', defId: 'starter-1', quality: 'BRONZE', area: 'EQUIPMENT', x: 6, y: 0, triggerDiceOverride: [1, 2, 3, 4, 5, 6] },
        { id: 'bite-b', defId: 'starter-1', quality: 'BRONZE', area: 'EQUIPMENT', x: 7, y: 0, triggerDiceOverride: [1, 2, 3, 4, 5, 6] },
      ],
    }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'SHIBA', wins: 0, losses: 0, round: 6, items: [] }
    const result = simulateBattle(player, opponent, 'frog-class-equipment')
    const firstBite = result.events.find((event) => event.kind === 'ITEM' && event.itemId === 'bite-a')
    const frogRoll = result.events.find((event) => event.kind === 'ROLL' && event.actor === 'player' && event.text.includes('蛙鸣鼓'))
    const echoDamageAtRoll = result.events.filter((event) => event.kind === 'ITEM' && event.actor === 'player' && event.time === frogRoll?.time && event.itemId === 'bite-a')

    expect(firstBite?.time).toBeLessThan(6)
    expect(frogRoll).toBeDefined()
    expect(echoDamageAtRoll.length).toBeGreaterThanOrEqual(2)
    expect(result.events.some((event) => event.text.includes('暴雨季') && event.text.includes('充水速度'))).toBe(true)
    expect(result.events.some((event) => event.text.includes('满池闸门') && event.text.includes('水位最高'))).toBe(true)
  })

  it('cuts same-tick frog fanout cycles before a growth item can trigger explosively', () => {
    const allDice = [1, 2, 3, 4, 5, 6]
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'FROG' as never,
      wins: 0,
      losses: 0,
      round: 13,
      items: [
        { id: 'growth', defId: 'v4-growing-chew-sword', quality: 'DIAMOND', area: 'EQUIPMENT', x: 0, y: 0, triggerDiceOverride: allDice },
        { id: 'left-light', defId: 'v3-night-patrol-light', quality: 'DIAMOND', area: 'EQUIPMENT', x: 2, y: 0, triggerDiceOverride: allDice },
        { id: 'drum', defId: 'frog-croak-drum', quality: 'GOLD', area: 'EQUIPMENT', x: 4, y: 0, triggerDiceOverride: allDice },
        { id: 'right-light', defId: 'v3-night-patrol-light', quality: 'GOLD', area: 'EQUIPMENT', x: 5, y: 0, triggerDiceOverride: allDice },
        { id: 'counter', defId: 'v4-boom-counter', quality: 'GOLD', area: 'EQUIPMENT', x: 7, y: 0 },
        { id: 'fang', defId: 'poisoned-dog-fang', quality: 'GOLD', area: 'EQUIPMENT', x: 9, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'SHIBA', wins: 0, losses: 0, round: 13, items: [] }

    const result = simulateBattle(player, opponent, 'frog-fanout-growth-loop')
    const growthHitsAtOpeningTick = result.events.filter((event) =>
      event.time === 0.5
      && event.kind === 'ITEM'
      && event.actor === 'player'
      && event.itemId === 'growth'
      && event.effectType === 'DAMAGE'
    )

    expect(growthHitsAtOpeningTick).toHaveLength(6)
    expect(result.duration).toBeGreaterThan(0.5)
  })
})
