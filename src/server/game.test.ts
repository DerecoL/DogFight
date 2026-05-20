import { describe, expect, it } from 'vitest'
import { resolveWinnerByHealthPercent, simulateBattle } from './game/battle'
import { CLASS_REWARD_DEFS, DOGS, RELIC_DEFS, itemDef, itemDefForQuality, shopPool } from './game/data'
import { canPlace, findSlot, triggerOrder } from './game/grid'
import { createRng } from './game/rng'
import { createShop, itemPurchaseValue, itemSellValue } from './game/shop'
import type { FighterSnapshot, GameItem, RelicInstance } from './game/types'

function baseItems(): GameItem[] {
  return [1, 2, 3, 4, 5, 6].map((n, index) => ({ id: `i${n}`, defId: `starter-${n}`, quality: 'BRONZE' as const, area: 'EQUIPMENT' as const, x: index, y: 0 }))
}

function equipment(id: string, defId: string, x: number, quality: GameItem['quality'] = 'DIAMOND'): GameItem {
  return { id, defId, quality, area: 'EQUIPMENT', x, y: 0 }
}

function repeatedEquipment(defId: string, count: number, quality: GameItem['quality'] = 'DIAMOND'): GameItem[] {
  return Array.from({ length: count }, (_, index) => equipment(`${defId}-${index}`, defId, index * 2, quality))
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
    expect(offer.price).toBe(144)
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
    expect(DOGS.EMPEROR.trait).toContain('幸运数字')
    expect(DOGS.EMPEROR.trait).toContain('50%')
  })

  it('defines class rewards by dog and unlock round plus relic definitions', () => {
    expect(CLASS_REWARD_DEFS.filter((item) => item.classDog === 'SHIBA' && item.unlockRound === 3).map((item) => item.name)).toEqual([
      '极速太刀',
      '大太刀',
      '燕回太刀',
    ])
    expect(CLASS_REWARD_DEFS.filter((item) => item.classDog === 'BULLY' && item.unlockRound === 6)).toHaveLength(3)
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
    expect(itemDef('v3-golden-kennel')).toMatchObject({ size: 4, defaultQuality: 'DIAMOND' })
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
      dice: [1, 2, 3, 4, 5, 6],
      tags: ['counter', 'trigger', 'damage'],
      effect: { type: 'UTILITY', amount: 300, qualityBase: 'GOLD' },
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

    expect(shopPool('GENERAL').map((item) => item.id)).toEqual(expect.arrayContaining([
      'v4-blood-contract-fang',
      'v4-boom-counter',
      'v4-growing-chew-sword',
      'v4-reverse-fur-comb',
    ]))
    expect(shopPool('MEDIUM').map((item) => item.id)).toEqual(expect.arrayContaining([
      'v4-blood-contract-fang',
      'v4-boom-counter',
      'v4-growing-chew-sword',
    ]))
    expect(shopPool('SMALL').map((item) => item.id)).toContain('v4-reverse-fur-comb')
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
      amount: 3,
      target: 'player',
      sourceHpDelta: 15,
      playerHp: 240,
    })
    expect(purge?.text).toContain('清除 3 层增益')
    expect(purge?.text).toContain('恢复 15 点生命')
    expect(purge?.opponentStatuses?.positive).toContainEqual(expect.objectContaining({ type: 'thorns', stacks: 2 }))
    expect(purge?.opponentStatuses?.positive).toContainEqual(expect.objectContaining({ type: 'shield', amount: 27 }))
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
      amount: 3,
      sourceHpDelta: 15,
      playerHp: 251,
    })
    expect(purge?.text).toContain('清除 3 层增益')
    expect(purge?.text).toContain('恢复 15 点生命')
    expect(purge?.opponentStatuses?.positive).toContainEqual(expect.objectContaining({ type: 'shield', amount: 30 }))
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
      amount: 7,
      target: 'player',
    })
    expect(purge?.text).toContain('清除 7 层增益')
    expect(purge?.text).toContain('恢复 77 点生命')
    expect(purge?.opponentStatuses?.positive).not.toContainEqual(expect.objectContaining({ type: 'thorns' }))
    expect(purge?.opponentStatuses?.positive).not.toContainEqual(expect.objectContaining({ type: 'extraRoll' }))
    expect(purge?.opponentStatuses?.positive).toContainEqual(expect.objectContaining({ type: 'shield', amount: 27 }))
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
      amount: 2,
    })
    expect(purge?.text).toContain('恢复 6 点生命')
    expect(purge?.opponentStatuses?.positive).toContainEqual(expect.objectContaining({ type: 'thorns', stacks: 3 }))
    expect(purge?.opponentStatuses?.positive).toContainEqual(expect.objectContaining({ type: 'shield', amount: 27 }))
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
    expect(hits.some((event) => event.amount > 25)).toBe(true)
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
    expect(leftHeals.every((event) => (event.sourceHpDelta ?? 0) > 0)).toBe(true)
    expect(rightHeals).toEqual([])
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
      && event.text.includes('左右相邻')
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

  it('gold boom counter explodes for 300 damage after 30 successful equipment triggers', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'SHIBA',
      wins: 0,
      losses: 0,
      round: 10,
      items: [
        { id: 'counter', defId: 'v4-boom-counter', quality: 'GOLD', area: 'EQUIPMENT', x: 0, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'SHIBA', wins: 0, losses: 0, round: 10, items: [] }
    const result = simulateBattle(player, opponent, 'boom-counter-gold')
    const explosion = result.events.find((event) =>
      event.actor === 'player'
      && event.itemId === 'counter'
      && event.defId === 'v4-boom-counter'
      && event.effectType === 'DAMAGE'
      && event.text.includes('爆鸣计数达到 30')
    )

    expect(explosion).toMatchObject({
      quality: 'GOLD',
      amount: 300,
      target: 'opponent',
      targetHpDelta: -300,
      time: 30,
    })
  })

  it('diamond boom counter keeps threshold 30 and damage 450', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'SHIBA',
      wins: 0,
      losses: 0,
      round: 11,
      items: [
        { id: 'counter', defId: 'v4-boom-counter', quality: 'DIAMOND', area: 'EQUIPMENT', x: 0, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'SHIBA', wins: 0, losses: 0, round: 11, items: [] }
    const result = simulateBattle(player, opponent, 'boom-counter-diamond')
    const explosion = result.events.find((event) =>
      event.actor === 'player'
      && event.itemId === 'counter'
      && event.effectType === 'DAMAGE'
      && event.text.includes('爆鸣计数达到 30')
    )

    expect(explosion).toMatchObject({
      quality: 'DIAMOND',
      amount: 450,
      targetHpDelta: -450,
      time: 30,
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
      && event.text.includes('爆鸣计数达到 30')
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

  it('starts fighters with round-scaled max health and records it for playback', () => {
    const player: FighterSnapshot = { name: 'P', dogType: 'SHIBA', wins: 0, losses: 0, round: 6, items: [] }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'SHIBA', wins: 0, losses: 0, round: 7, items: [] }
    const result = simulateBattle(player, opponent, 'round-health-growth')

    expect(result.playerMaxHp).toBe(220)
    expect(result.opponentMaxHp).toBe(270)
    expect(result.events[0]).toMatchObject({
      playerHp: 220,
      playerMaxHp: 220,
      opponentHp: 270,
      opponentMaxHp: 270,
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
      effectType: 'DAMAGE',
      amount: 5,
      target: 'opponent',
      sourceHpDelta: 0,
      targetHpDelta: -5,
    })
    expect(result.playerSnapshot.items[0]).toMatchObject({ id: 'left-copy', def: { id: 'starter-1' } })
    expect(result.opponentSnapshot.items).toEqual([])
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
    expect(itemEvents.map((event) => event.itemId)).toEqual(['starter', 'paw', 'collar', 'disc', 'bone'])
    expect(itemEvents.map((event) => event.targetHpDelta)).toEqual([-5, -12, -8, -10, -16])
    expect(itemEvents.map((event) => event.opponentHp)).toEqual([95, 83, 75, 65, 49])
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

    expect(mapped).toMatchObject({ roll: 3, amount: 6, targetHpDelta: -6 })
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

    expect(mapped).toMatchObject({ roll: 3, amount: 9, targetHpDelta: -9 })
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
    expect(shieldEvent?.playerStatuses?.positive).toContainEqual(expect.objectContaining({ type: 'shield', amount: 3 }))
  })

  it('lets golden kennel halve poison instead of fully blocking it', () => {
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
        { id: 'poison', defId: 'shiba-poison', quality: 'DIAMOND', area: 'EQUIPMENT', x: 0, y: 0 },
      ],
    }
    const result = simulateBattle(player, opponent, 'shield-first-3')
    const poisonApply = result.events.find((event) => event.defId === 'shiba-poison' && event.effectType === 'POISON')
    const poisonTick = result.events.find((event) => event.kind === 'POISON' && event.target === 'player')

    expect(poisonApply?.amount).toBe(3)
    expect(poisonApply?.playerStatuses?.negative).toContainEqual(expect.objectContaining({ type: 'poison', stacks: 3 }))
    expect(poisonTick).toMatchObject({ amount: 3, target: 'player' })
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
})
