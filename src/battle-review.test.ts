import { describe, expect, it } from 'vitest'
import {
  battleLogCategory,
  buildBattleReview,
  filterBattleEvents,
  type BattleLogFilter,
} from './battle-review'

const playerSword = {
  id: 'player-sword',
  defId: 'v4-growing-chew-sword',
  quality: 'SILVER',
  area: 'EQUIPMENT',
  x: 0,
  y: 0,
  def: { id: 'v4-growing-chew-sword', name: '磨牙成长剑' },
}

const playerVest = {
  id: 'player-vest',
  defId: 'guard-vest',
  quality: 'SILVER',
  area: 'EQUIPMENT',
  x: 1,
  y: 0,
  def: { id: 'guard-vest', name: '护卫背心' },
}

const opponentBone = {
  id: 'opponent-bone',
  defId: 'giant-bone',
  quality: 'SILVER',
  area: 'EQUIPMENT',
  x: 0,
  y: 0,
  def: { id: 'giant-bone', name: '巨型骨棒' },
}

const baseBattle = {
  winner: 'player',
  duration: 12,
  playerHp: 10,
  opponentHp: 0,
  playerMaxHp: 24,
  opponentMaxHp: 24,
  playerSnapshot: {
    name: '玩家',
    dogType: 'SHIBA',
    wins: 0,
    losses: 0,
    round: 3,
    items: [playerSword, playerVest],
  },
  opponentSnapshot: {
    name: '对手',
    dogType: 'BULLY',
    wins: 0,
    losses: 0,
    round: 3,
    items: [opponentBone],
  },
}

describe('battle review derivation', () => {
  it('summarizes direct damage, healing, shield, status events, and top item contribution', () => {
    const review = buildBattleReview({
      ...baseBattle,
      events: [
        {
          time: 1,
          actor: 'player',
          kind: 'ITEM',
          itemId: 'player-sword',
          effectType: 'DAMAGE',
          amount: 9,
          target: 'opponent',
          sourceHpDelta: 0,
          targetHpDelta: -9,
          text: '磨牙成长剑 造成 9 点伤害',
        },
        {
          time: 2,
          actor: 'player',
          kind: 'ITEM',
          itemId: 'player-vest',
          effectType: 'HEAL',
          amount: 6,
          target: 'player',
          sourceHpDelta: 6,
          targetHpDelta: 0,
          text: '护卫背心 回复 6 点生命',
        },
        {
          time: 3,
          actor: 'player',
          kind: 'ITEM',
          itemId: 'player-vest',
          effectType: 'UTILITY',
          amount: 8,
          target: 'player',
          sourceHpDelta: 0,
          targetHpDelta: 0,
          statusChanged: ['shield'],
          text: '护卫背心 获得 8 点【护盾】',
        },
        {
          time: 4,
          actor: 'player',
          kind: 'ITEM',
          itemId: 'player-sword',
          effectType: 'UTILITY',
          amount: 1,
          target: 'opponent',
          sourceHpDelta: 0,
          targetHpDelta: 0,
          statusChanged: ['weak'],
          text: '磨牙成长剑 施加 1 层【虚弱】',
        },
        {
          time: 5,
          actor: 'opponent',
          kind: 'ITEM',
          itemId: 'opponent-bone',
          effectType: 'DAMAGE',
          amount: 7,
          target: 'player',
          sourceHpDelta: 0,
          targetHpDelta: -7,
          text: '巨型骨棒 造成 7 点伤害',
        },
      ],
    })

    expect(review.player).toMatchObject({
      damage: 9,
      healing: 6,
      shield: 8,
      poisonDamage: 0,
      statusEvents: 1,
    })
    expect(review.player.topItem).toEqual({
      itemId: 'player-vest',
      name: '护卫背心',
      contribution: 14,
    })
    expect(review.opponent.damage).toBe(7)
    expect(review.opponent.topItem).toEqual({
      itemId: 'opponent-bone',
      name: '巨型骨棒',
      contribution: 7,
    })
  })

  it('attributes single-target poison tick damage to the opposite side without assigning it to an item', () => {
    const review = buildBattleReview({
      ...baseBattle,
      events: [
        {
          time: 3,
          actor: 'system',
          kind: 'POISON',
          effectType: 'POISON',
          amount: 5,
          target: 'opponent',
          sourceHpDelta: 0,
          targetHpDelta: -5,
          text: '【中毒】结算，对手受到 5 点伤害',
        },
      ],
    })

    expect(review.player.poisonDamage).toBe(5)
    expect(review.player.damage).toBe(0)
    expect(review.player.topItem).toBeNull()
  })

  it('keeps shared late battle poison as system damage instead of equipment contribution', () => {
    const review = buildBattleReview({
      ...baseBattle,
      events: [
        {
          time: 61,
          actor: 'system',
          kind: 'POISON',
          effectType: 'POISON',
          amount: 1,
          target: 'both',
          sourceHpDelta: -1,
          targetHpDelta: -1,
          text: '毒伤加深，双方受到 1 点伤害',
        },
      ],
    })

    expect(review.player.poisonDamage).toBe(0)
    expect(review.opponent.poisonDamage).toBe(0)
    expect(review.systemDamage).toBe(2)
    expect(review.player.topItem).toBeNull()
    expect(review.opponent.topItem).toBeNull()
  })

  it('classifies and filters battle log events by first-version review categories', () => {
    const events = [
      { kind: 'ROLL', actor: 'player', text: '玩家掷出 4', time: 1 },
      { kind: 'ITEM', actor: 'player', effectType: 'DAMAGE', targetHpDelta: -4, text: '造成 4 点伤害', time: 2 },
      { kind: 'ITEM', actor: 'player', effectType: 'HEAL', sourceHpDelta: 5, text: '回复 5 点生命', time: 3 },
      { kind: 'ITEM', actor: 'player', effectType: 'UTILITY', statusChanged: ['shield'], amount: 6, text: '获得 6 点【护盾】', time: 4 },
      { kind: 'ITEM', actor: 'player', effectType: 'POISON', amount: 2, text: '叠加 2 层【中毒】', time: 5 },
      { kind: 'ITEM', actor: 'player', effectType: 'UTILITY', targetItemId: 'enemy-right', text: '使敌方最右侧装备【失效】一次', time: 6 },
    ]

    expect(events.map((event) => battleLogCategory(event))).toEqual([
      'all',
      'damage',
      'sustain',
      'sustain',
      'status',
      'equipment',
    ])

    const filters: Record<Exclude<BattleLogFilter, 'all'>, number[]> = {
      damage: [2],
      sustain: [3, 4],
      status: [5],
      equipment: [6],
    }

    for (const [filter, expectedTimes] of Object.entries(filters) as Array<[Exclude<BattleLogFilter, 'all'>, number[]]>) {
      expect(filterBattleEvents(events, filter).map((event) => event.time)).toEqual(expectedTimes)
    }
    expect(filterBattleEvents(events, 'all')).toHaveLength(events.length)
  })
})
