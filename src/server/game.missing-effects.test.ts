import { describe, expect, it } from 'vitest'
import { simulateBattle } from './game/battle'
import type { FighterSnapshot } from './game/types'

describe('missing equipment effect regressions', () => {
  it('makes absolute zero freeze stop enemy rolls for two seconds', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'SAMOYED',
      wins: 0,
      losses: 0,
      round: 8,
      relics: [{ id: 'big-only', relicId: 'half-die-left', quality: 'SILVER', slot: 0 }],
      items: [
        { id: 'zero', defId: 'samoyed-absolute-zero', quality: 'DIAMOND', area: 'EQUIPMENT', x: 0, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = {
      name: 'O',
      dogType: 'SHIBA',
      wins: 0,
      losses: 0,
      round: 8,
      items: [
        { id: 'bite', defId: 'starter-1', quality: 'BRONZE', area: 'EQUIPMENT', x: 0, y: 0 },
      ],
    }
    const result = simulateBattle(player, opponent, 'freeze-audit')
    const freezeStackEvents = result.events.filter((event) =>
      event.kind === 'ITEM' && event.itemId === 'zero' && event.freezeStackChanged,
    )
    const firstFreezeCycle = freezeStackEvents.slice(0, 10)
    const freezeEvent = firstFreezeCycle.find((event) => event.freezeStackValue === 0)
    const enemyRollsDuringFreeze = result.events.filter(
      (event) => event.kind === 'ROLL' && event.actor === 'opponent' && event.time >= 10 && event.time < 12,
    )

    expect(firstFreezeCycle.map((event) => event.freezeStackValue)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 0])
    expect(firstFreezeCycle.every((event) => event.freezeStackItemId === 'zero' && event.freezeStackMax === 10)).toBe(true)
    expect(freezeEvent).toMatchObject({ time: 10, target: 'opponent', amount: 2 })
    expect(enemyRollsDuringFreeze).toEqual([])
  })

  it('makes bully demolish disable each enemy large item once', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'BULLY',
      wins: 0,
      losses: 0,
      round: 8,
      items: [
        { id: 'large', defId: 'giant-bone', quality: 'BRONZE', area: 'EQUIPMENT', x: 0, y: 0 },
        { id: 'demolish', defId: 'bully-demolish', quality: 'DIAMOND', area: 'EQUIPMENT', x: 4, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = {
      name: 'O',
      dogType: 'SHIBA',
      wins: 0,
      losses: 0,
      round: 8,
      items: [
        { id: 'opp-a', defId: 'dog-house', quality: 'BRONZE', area: 'EQUIPMENT', x: 0, y: 0 },
        { id: 'opp-b', defId: 'dog-house', quality: 'BRONZE', area: 'EQUIPMENT', x: 4, y: 0 },
      ],
    }
    const result = simulateBattle(player, opponent, 'plain-10')
    const firstEnemyLargeTriggers = result.events.filter(
      (event) => event.kind === 'ITEM' && event.actor === 'opponent' && event.time === 2,
    )

    expect(firstEnemyLargeTriggers.map((event) => event.itemId)).toEqual(['opp-a', 'opp-b'])
    expect(firstEnemyLargeTriggers.every((event) => event.amount === 0 && event.target === 'none')).toBe(true)
  })

  it('makes lucky foxtail safety trigger on the roll after the configured empty-roll streak', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'SHIBA',
      wins: 0,
      losses: 0,
      round: 8,
      relics: [{ id: 'foxtail', relicId: 'v3-lucky-foxtail', quality: 'GOLD', slot: 0 }],
      items: [
        { id: 'large', defId: 'giant-bone', quality: 'BRONZE', area: 'EQUIPMENT', x: 0, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'SHIBA', wins: 0, losses: 0, round: 8, items: [] }
    const result = simulateBattle(player, opponent, 'lucky-foxtail')
    const firstSafetyTrigger = result.events.find((event) => event.kind === 'ITEM' && event.actor === 'player')

    expect(firstSafetyTrigger).toMatchObject({ time: 3, itemId: 'large', roll: 3 })
  })

  it('makes chase tail increase damage during consecutive extra rolls', () => {
    const starters: FighterSnapshot['items'] = [1, 2, 3, 4, 5, 6].map((n, index) => ({
      id: `bite-${n}`,
      defId: `starter-${n}`,
      quality: 'BRONZE',
      area: 'EQUIPMENT',
      x: index,
      y: 0,
    }))
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'MUTT',
      wins: 0,
      losses: 0,
      round: 8,
      items: [
        ...starters,
        { id: 'counter', defId: 'mutt-counting-collar', quality: 'GOLD', area: 'EQUIPMENT', x: 6, y: 0 },
        { id: 'tail', defId: 'mutt-chase-tail', quality: 'DIAMOND', area: 'EQUIPMENT', x: 8, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'SHIBA', wins: 0, losses: 0, round: 8, items: [] }
    const result = simulateBattle(player, opponent, 'mutt-tail-boost')
    const timeFourDamage = result.events.filter(
      (event) => event.kind === 'ITEM' && event.actor === 'player' && event.time === 4 && event.effectType === 'DAMAGE',
    )

    expect(timeFourDamage.map((event) => [event.itemId, event.amount])).toEqual([
      ['bite-5', 5],
      ['bite-6', 6],
      ['bite-1', 6],
    ])
  })

  it('lets bully gym trigger a non-large item when a large item triggers', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'BULLY',
      wins: 0,
      losses: 0,
      round: 8,
      items: [
        { id: 'large', defId: 'giant-bone', quality: 'BRONZE', area: 'EQUIPMENT', x: 0, y: 0 },
        { id: 'gym', defId: 'bully-gym', quality: 'GOLD', area: 'EQUIPMENT', x: 4, y: 0 },
        { id: 'small', defId: 'small-bite', quality: 'BRONZE', area: 'EQUIPMENT', x: 7, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'SHIBA', wins: 0, losses: 0, round: 8, items: [] }
    const result = simulateBattle(player, opponent, 'plain-10')
    const firstPlayerRoll = result.events.find((event) => event.kind === 'ROLL' && event.actor === 'player')
    const firstRollEvents = result.events.filter(
      (event) => event.kind === 'ITEM' && event.actor === 'player' && event.time === firstPlayerRoll?.time,
    )
    const smallEvent = firstRollEvents.find((event) => event.itemId === 'small')

    expect(firstPlayerRoll?.roll).toBe(6)
    expect(firstRollEvents.map((event) => event.itemId)).toContain('large')
    expect(smallEvent).toMatchObject({ defId: 'small-bite', amount: 4, targetHpDelta: -4 })
  })

  it('prevents bully gym and night patrol light from recursively refiring the same large item', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'BULLY',
      wins: 0,
      losses: 0,
      round: 8,
      items: [
        { id: 'lamp', defId: 'v3-night-patrol-light', quality: 'GOLD', area: 'EQUIPMENT', x: 0, y: 0 },
        { id: 'large', defId: 'giant-bone', quality: 'BRONZE', area: 'EQUIPMENT', x: 2, y: 0 },
        { id: 'gym', defId: 'bully-gym', quality: 'GOLD', area: 'EQUIPMENT', x: 6, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'SHIBA', wins: 0, losses: 0, round: 8, items: [] }
    const result = simulateBattle(player, opponent, 'plain-10')
    const firstPlayerRoll = result.events.find((event) => event.kind === 'ROLL' && event.actor === 'player')
    const firstRollEvents = result.events.filter(
      (event) => event.kind === 'ITEM' && event.actor === 'player' && event.time === firstPlayerRoll?.time,
    )
    const largeDamageEvents = firstRollEvents.filter(
      (event) => event.itemId === 'large' && event.effectType === 'DAMAGE',
    )

    expect(firstPlayerRoll?.roll).toBe(6)
    expect(firstRollEvents.some((event) => event.text.includes('触发队列达到上限'))).toBe(false)
    expect(largeDamageEvents).toHaveLength(2)
  })

  it('makes bully demolish disable the enemy large item instead of the next allied large item', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'BULLY',
      wins: 0,
      losses: 0,
      round: 8,
      items: [
        { id: 'large', defId: 'giant-bone', quality: 'BRONZE', area: 'EQUIPMENT', x: 0, y: 0 },
        { id: 'demolish', defId: 'bully-demolish', quality: 'DIAMOND', area: 'EQUIPMENT', x: 4, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = {
      name: 'O',
      dogType: 'SHIBA',
      wins: 0,
      losses: 0,
      round: 8,
      items: [
        { id: 'opp-large', defId: 'giant-bone', quality: 'BRONZE', area: 'EQUIPMENT', x: 0, y: 0 },
      ],
    }
    const result = simulateBattle(player, opponent, 'plain-10')
    const enemyFollowup = result.events.find(
      (event) => event.kind === 'ITEM' && event.actor === 'opponent' && event.itemId === 'opp-large',
    )
    const alliedFollowup = result.events.find(
      (event) => event.kind === 'ITEM'
        && event.actor === 'player'
        && event.itemId === 'large'
        && event.effectType === 'DAMAGE'
        && event.time > (enemyFollowup?.time ?? 0),
    )

    expect(alliedFollowup?.amount).toBeGreaterThan(0)
    expect(alliedFollowup?.target).toBe('opponent')
    expect(enemyFollowup).toMatchObject({ amount: 0, target: 'none', targetHpDelta: 0 })
  })

  it('lets bully armband make three-slot items count as large for bully trait doubling', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'BULLY',
      wins: 0,
      losses: 0,
      round: 8,
      items: [
        { id: 'vest', defId: 'guard-vest', quality: 'BRONZE', area: 'EQUIPMENT', x: 0, y: 0 },
        { id: 'armband', defId: 'bully-armband', quality: 'GOLD', area: 'EQUIPMENT', x: 3, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'SHIBA', wins: 0, losses: 0, round: 8, items: [] }
    const result = simulateBattle(player, opponent, 'bully-audit-3')
    const vestEvent = result.events.find((event) => event.kind === 'ITEM' && event.actor === 'player' && event.itemId === 'vest')

    expect(vestEvent).toMatchObject({ defId: 'guard-vest', effectType: 'HEAL', amount: 16 })
  })

  it('lets bully colossus upgrade a successful large-item double to quadruple', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'BULLY',
      wins: 0,
      losses: 0,
      round: 8,
      items: [
        { id: 'large', defId: 'giant-bone', quality: 'BRONZE', area: 'EQUIPMENT', x: 0, y: 0 },
        { id: 'colossus', defId: 'bully-colossus', quality: 'DIAMOND', area: 'EQUIPMENT', x: 4, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'SHIBA', wins: 0, losses: 0, round: 8, items: [] }
    const result = simulateBattle(player, opponent, 'bully-quad-12')
    const quadrupled = result.events.find(
      (event) => event.kind === 'ITEM' && event.actor === 'player' && event.itemId === 'large' && event.amount === 64,
    )

    expect(quadrupled).toMatchObject({ defId: 'giant-bone', targetHpDelta: -64 })
  })

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
