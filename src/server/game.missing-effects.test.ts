import { describe, expect, it } from 'vitest'
import { simulateBattle } from './game/battle'
import type { FighterSnapshot } from './game/types'

describe('missing equipment effect regressions', () => {
  it('lets shiba speed katana add extra rolls as it stacks attack speed', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'SHIBA',
      wins: 0,
      losses: 0,
      round: 8,
      items: [
        { id: 'speed', defId: 'shiba-speed-katana', quality: 'GOLD', area: 'EQUIPMENT', x: 0, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'SHIBA', wins: 0, losses: 0, round: 8, items: [] }
    const result = simulateBattle(player, opponent, 'shiba-speed-stacks')
    const openingRolls = result.events.filter((event) => event.kind === 'ROLL' && event.actor === 'player' && event.time <= 10)

    expect(openingRolls.length).toBeGreaterThan(10)
  })

  it('reschedules shiba speed rolls onto the real battle timeline', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'SHIBA',
      wins: 0,
      losses: 0,
      round: 8,
      relics: [{ id: 'small-only', relicId: 'half-die-right', quality: 'SILVER', slot: 0 }],
      items: [
        { id: 'speed', defId: 'shiba-speed-katana', quality: 'GOLD', area: 'EQUIPMENT', x: 0, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'SHIBA', wins: 0, losses: 0, round: 8, items: [] }
    const result = simulateBattle(player, opponent, 'shiba-speed-real-timeline')
    const playerRolls = result.events.filter((event) => event.kind === 'ROLL' && event.actor === 'player')
    const opponentRolls = result.events.filter((event) => event.kind === 'ROLL' && event.actor === 'opponent')

    expect(playerRolls[0].time).toBe(1)
    expect(opponentRolls[0].time).toBe(1)
    expect(playerRolls[1].time).toBeCloseTo(1.9)
    expect(playerRolls[1].time).toBeLessThan(opponentRolls[1].time)
  })

  it('makes mutt eat air double early rolls while blocking early recovery', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'MUTT',
      wins: 0,
      losses: 0,
      round: 8,
      items: [
        { id: 'eat-air', defId: 'mutt-eat-air', quality: 'DIAMOND', area: 'EQUIPMENT', x: 0, y: 0 },
        { id: 'heal', defId: 'milk-bone', quality: 'DIAMOND', area: 'EQUIPMENT', x: 4, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'SHIBA', wins: 0, losses: 0, round: 8, items: [] }
    const result = simulateBattle(player, opponent, 'mutt-eat-air-early')
    const openingRolls = result.events.filter((event) => event.kind === 'ROLL' && event.actor === 'player' && event.time <= 10)
    const blockedRecovery = result.events.filter((event) =>
      event.kind === 'ITEM'
      && event.actor === 'player'
      && event.time <= 10
      && ['HEAL', 'UTILITY'].includes(String(event.effectType)),
    )

    expect(openingRolls.length).toBeGreaterThan(10)
    expect(blockedRecovery).toEqual([])
  })

  it('lets curtain-adjacent emperor equipment trigger on the lucky number only', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'EMPEROR',
      luckyNumber: 5,
      wins: 0,
      losses: 0,
      round: 8,
      items: [
        { id: 'curtain', defId: 'emperor-curtain', quality: 'DIAMOND', area: 'EQUIPMENT', x: 0, y: 0 },
        { id: 'adjacent', defId: 'starter-1', quality: 'BRONZE', area: 'EQUIPMENT', x: 2, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'SHIBA', wins: 0, losses: 0, round: 8, items: [] }
    const result = simulateBattle(player, opponent, 'emperor-curtain-lucky')

    expect(result.events.some((event) => event.kind === 'ITEM' && event.itemId === 'adjacent' && event.roll === 5)).toBe(true)
    expect(result.events.some((event) => event.kind === 'ITEM' && event.itemId === 'adjacent' && event.roll === 1)).toBe(false)
  })

  it('forces the leftmost two items on both sides to use emperor edict lucky dice', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'EMPEROR',
      luckyNumber: 6,
      wins: 0,
      losses: 0,
      round: 8,
      items: [
        { id: 'left-a', defId: 'starter-1', quality: 'BRONZE', area: 'EQUIPMENT', x: 0, y: 0 },
        { id: 'left-b', defId: 'starter-2', quality: 'BRONZE', area: 'EQUIPMENT', x: 1, y: 0 },
        { id: 'edict', defId: 'emperor-edict', quality: 'DIAMOND', area: 'EQUIPMENT', x: 2, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = {
      name: 'O',
      dogType: 'SHIBA',
      wins: 0,
      losses: 0,
      round: 8,
      items: [
        { id: 'opp-left-a', defId: 'starter-1', quality: 'BRONZE', area: 'EQUIPMENT', x: 0, y: 0 },
        { id: 'opp-left-b', defId: 'starter-2', quality: 'BRONZE', area: 'EQUIPMENT', x: 1, y: 0 },
      ],
    }
    const result = simulateBattle(player, opponent, 'emperor-edict-force')

    expect(result.events.some((event) => event.kind === 'ITEM' && event.itemId === 'left-a' && event.roll === 6)).toBe(true)
    expect(result.events.some((event) => event.kind === 'ITEM' && event.itemId === 'left-b' && event.roll === 6)).toBe(true)
    expect(result.events.some((event) => event.kind === 'ITEM' && event.itemId === 'opp-left-a' && event.roll === 6)).toBe(true)
    expect(result.events.some((event) => event.kind === 'ITEM' && event.itemId === 'opp-left-b' && event.roll === 6)).toBe(true)
  })

  it('makes fallen emperor only trigger lucky-number equipment twice', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'EMPEROR',
      luckyNumber: 4,
      wins: 0,
      losses: 0,
      round: 8,
      items: [
        { id: 'fallen', defId: 'emperor-fallen', quality: 'DIAMOND', area: 'EQUIPMENT', x: 0, y: 0 },
        { id: 'non-lucky', defId: 'starter-1', quality: 'BRONZE', area: 'EQUIPMENT', x: 1, y: 0 },
        { id: 'lucky', defId: 'starter-4', quality: 'BRONZE', area: 'EQUIPMENT', x: 2, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'SHIBA', wins: 0, losses: 0, round: 8, items: [] }
    const result = simulateBattle(player, opponent, 'emperor-fallen-double')
    const luckyRollTime = result.events.find((event) => event.kind === 'ROLL' && event.actor === 'player' && event.roll === 4)?.time
    const luckyEvents = result.events.filter((event) =>
      event.kind === 'ITEM' && event.actor === 'player' && event.time === luckyRollTime && event.itemId === 'lucky',
    )

    expect(luckyEvents).toHaveLength(2)
    expect(result.events.some((event) => event.kind === 'ITEM' && event.itemId === 'non-lucky')).toBe(false)
  })
})
