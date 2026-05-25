import { describe, expect, it } from 'vitest'
import { simulateBattle } from './battle'
import type { FighterSnapshot } from './types'

const allDice = [1, 2, 3, 4, 5, 6]

function emptyOpponent(): FighterSnapshot {
  return {
    name: 'O',
    dogType: 'SHIBA',
    wins: 0,
    losses: 0,
    round: 8,
    items: [],
  }
}

describe('multi equipment', () => {
  it('fully triggers a multi item once per multi count', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'SHIBA',
      wins: 0,
      losses: 0,
      round: 8,
      items: [
        { id: 'disc', defId: 'training-disc', quality: 'BRONZE', area: 'EQUIPMENT', x: 0, y: 0, triggerDiceOverride: allDice },
      ],
    }
    const result = simulateBattle(player, emptyOpponent(), 'multi-basic')
    const firstRollTime = result.events.find((event) => event.kind === 'ROLL' && event.actor === 'player')?.time
    const discEvents = result.events.filter((event) =>
      event.kind === 'ITEM' && event.actor === 'player' && event.time === firstRollTime && event.itemId === 'disc',
    )

    expect(discEvents).toHaveLength(3)
    expect(discEvents.map((event) => event.amount)).toEqual([3, 3, 3])
    expect(discEvents.map((event) => (event as { multiIndex?: number }).multiIndex)).toEqual([1, 2, 3])
    expect(discEvents.map((event) => (event as { multiTotal?: number }).multiTotal)).toEqual([3, 3, 3])
  })

  it('counts each multi repeat as a successful trigger for boom counter', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'SHIBA',
      wins: 0,
      losses: 0,
      round: 8,
      items: [
        { id: 'disc', defId: 'training-disc', quality: 'BRONZE', area: 'EQUIPMENT', x: 0, y: 0, triggerDiceOverride: allDice },
        { id: 'boom', defId: 'v4-boom-counter', quality: 'GOLD', area: 'EQUIPMENT', x: 2, y: 0 },
      ],
    }
    const result = simulateBattle(player, emptyOpponent(), 'multi-boom')
    const firstRollTime = result.events.find((event) => event.kind === 'ROLL' && event.actor === 'player')?.time
    const boomEvents = result.events.filter((event) =>
      event.kind === 'ITEM' && event.actor === 'player' && event.time === firstRollTime && event.itemId === 'boom',
    )

    expect(boomEvents.map((event) => event.boomCounterValue)).toEqual([1, 2, 3])
  })

  it('spends one disabled layer per multi repeat', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'SHIBA',
      wins: 0,
      losses: 0,
      round: 8,
      items: [
        { id: 'disc', defId: 'training-disc', quality: 'BRONZE', area: 'EQUIPMENT', x: 0, y: 0, triggerDiceOverride: allDice },
      ],
    }
    const opponent: FighterSnapshot = {
      name: 'O',
      dogType: 'SHIBA',
      wins: 0,
      losses: 0,
      round: 8,
      items: [
        { id: 'trash', defId: 'v3-fermented-trash-bin', quality: 'GOLD', area: 'EQUIPMENT', x: 0, y: 0, triggerDiceOverride: allDice },
      ],
    }
    const result = simulateBattle(player, opponent, 'multi-disabled')
    const secondRollTime = result.events.filter((event) => event.kind === 'ROLL' && event.actor === 'player')[1]?.time
    const discEvents = result.events.filter((event) =>
      event.kind === 'ITEM' && event.actor === 'player' && event.time === secondRollTime && event.itemId === 'disc',
    )

    expect(discEvents.map((event) => event.target)).toEqual(['none', 'opponent', 'opponent'])
    expect(discEvents.map((event) => event.amount)).toEqual([0, 3, 3])
  })

  it('lets lotus sea increase adjacent multi count up to the cap', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'SHIBA',
      wins: 0,
      losses: 0,
      round: 8,
      items: [
        { id: 'left-lotus', defId: 'lotus-sea', quality: 'DIAMOND', area: 'EQUIPMENT', x: 0, y: 0 },
        { id: 'disc', defId: 'training-disc', quality: 'BRONZE', area: 'EQUIPMENT', x: 2, y: 0, triggerDiceOverride: allDice },
        { id: 'right-lotus', defId: 'lotus-sea', quality: 'DIAMOND', area: 'EQUIPMENT', x: 4, y: 0 },
      ],
    }
    const result = simulateBattle(player, emptyOpponent(), 'multi-lotus')
    const firstRollTime = result.events.find((event) => event.kind === 'ROLL' && event.actor === 'player')?.time
    const discEvents = result.events.filter((event) =>
      event.kind === 'ITEM' && event.actor === 'player' && event.time === firstRollTime && event.itemId === 'disc',
    )

    expect(discEvents).toHaveLength(5)
    expect(discEvents.every((event) => (event as { multiTotal?: number }).multiTotal === 5)).toBe(true)
  })

  it('lets kyushu bracer buff only repeat hits after the first hit', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'SHIBA',
      wins: 0,
      losses: 0,
      round: 8,
      items: [
        { id: 'disc', defId: 'training-disc', quality: 'BRONZE', area: 'EQUIPMENT', x: 0, y: 0, triggerDiceOverride: allDice },
        { id: 'bracer', defId: 'kyushu-bracer', quality: 'GOLD', area: 'EQUIPMENT', x: 2, y: 0 },
      ],
    }
    const result = simulateBattle(player, emptyOpponent(), 'multi-bracer')
    const firstRollTime = result.events.find((event) => event.kind === 'ROLL' && event.actor === 'player')?.time
    const damageEvents = result.events.filter((event) =>
      event.kind === 'ITEM'
      && event.actor === 'player'
      && event.time === firstRollTime
      && event.itemId === 'disc'
      && event.effectType === 'DAMAGE',
    )
    const shieldEvents = result.events.filter((event) =>
      event.kind === 'ITEM'
      && event.actor === 'player'
      && event.time === firstRollTime
      && event.itemId === 'bracer'
      && event.effectType === 'UTILITY',
    )

    expect(damageEvents.map((event) => event.amount)).toEqual([3, 5, 5])
    expect(shieldEvents.map((event) => event.amount)).toEqual([1, 1])
  })
})
