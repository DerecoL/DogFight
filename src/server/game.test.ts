import { describe, expect, it } from 'vitest'
import { simulateBattle } from './game/battle'
import { CLASS_REWARD_DEFS, DOGS, RELIC_DEFS, itemDef, shopPool } from './game/data'
import { canPlace, findSlot, triggerOrder } from './game/grid'
import { createRng } from './game/rng'
import { createShop } from './game/shop'
import type { FighterSnapshot, GameItem, RelicInstance } from './game/types'

function baseItems(): GameItem[] {
  return [1, 2, 3, 4, 5, 6].map((n, index) => ({ id: `i${n}`, defId: `starter-${n}`, quality: 'BRONZE' as const, area: 'EQUIPMENT' as const, x: index, y: 0 }))
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
    expect(RELIC_DEFS.map((relic) => relic.name)).toEqual(['点金手·左', '点金手·右', '半截骰·左', '半截骰·右'])
  })
})

describe('battle simulation', () => {
  it('resolves deterministic battle logs with poison or victory', () => {
    const player: FighterSnapshot = { name: 'P', dogType: 'MUTT', wins: 0, losses: 0, round: 0, items: baseItems() }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'SHIBA', wins: 0, losses: 0, round: 0, items: baseItems() }
    const result = simulateBattle(player, opponent, 'battle-seed')
    expect(['player', 'opponent', 'draw']).toContain(result.winner)
    expect(result.duration).toBeGreaterThan(0)
    expect(result.events.some((event) => event.kind === 'ROLL')).toBe(true)
    expect(result.events.at(-1)?.kind).toBe('END')
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

  it('caps chained class reward triggers and records a readable log entry', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'MUTT',
      wins: 0,
      losses: 0,
      round: 6,
      items: Array.from({ length: 12 }, (_, index) => ({
        id: `chainer-${index}`,
        defId: 'mutt-chase-car',
        quality: 'DIAMOND' as const,
        area: 'EQUIPMENT' as const,
        x: index,
        y: 0,
      })),
    }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'SHIBA', wins: 0, losses: 0, round: 6, items: [] }
    const result = simulateBattle(player, opponent, 'plain-10')

    expect(result.events.some((event) => event.kind === 'ITEM' && event.text.includes('触发队列达到上限'))).toBe(true)
  })
})
