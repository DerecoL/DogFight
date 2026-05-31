import { describe, expect, it } from 'vitest'
import { createFinishedBattleRecord, nextPhaseData, playerBattleGoldIncome, postBattleLargeItemReward, postBattleSellBonusItemGrowths, publicRelics, publicRun, publicRunHistory, toGameItems, upgradeChoiceSkipPhase } from './state'

describe('public run relic data', () => {
  it('returns quality-adjusted relic descriptions for upgraded relics', () => {
    const relics = publicRelics({
      relics: JSON.stringify([{ id: 'r1', relicId: 'midas-left', quality: 'GOLD', slot: 0 }]),
    })

    expect(relics[0].def.description).toContain('75%')
  })
})

describe('public exploration map data', () => {
  it('exposes map state for new map-phase runs', () => {
    const run = {
      id: 'run-map',
      mode: 'CASUAL',
      dogType: 'SHIBA',
      luckyNumber: null,
      wins: 0,
      losses: 0,
      round: 0,
      gold: 10,
      phase: 'MAP',
      status: 'ACTIVE',
      shopType: 'GENERAL',
      shopItems: '[]',
      choices: '[]',
      enchantChoices: '[]',
      potionChoices: '[]',
      classRewardChoices: '[]',
      relicChoices: '[]',
      relics: '[]',
      refreshCost: 1,
      matchedGhost: null,
      lastBattle: null,
      ladderSettlement: null,
      mapState: JSON.stringify({
        version: 1,
        mapIndex: 0,
        currentNodeId: null,
        completedNodeIds: [],
        nodes: [
          { id: 'n-0-0', layer: 0, column: 0, kind: 'PLAYER_BATTLE', nextNodeIds: [] },
        ],
      }),
      items: [],
    } as never

    expect(publicRun(run)).toMatchObject({
      phase: 'MAP',
      mapState: {
        mapIndex: 0,
        availableNodeIds: ['n-0-0'],
        nodes: [{ id: 'n-0-0', kind: 'PLAYER_BATTLE' }],
      },
    })
  })
})

describe('upgrade choice skip flow', () => {
  it('continues the map when an upgrade choice belongs to a current map node', () => {
    const mapState = JSON.stringify({
      version: 1,
      mapIndex: 0,
      currentNodeId: 'shop-node',
      completedNodeIds: [],
      nodes: [
        { id: 'shop-node', layer: 0, column: 0, kind: 'SHOP_FIXED', shopType: 'UPGRADE_SILVER', nextNodeIds: [] },
      ],
    })

    expect(upgradeChoiceSkipPhase({ mapState })).toBe('MAP')
  })

  it('returns to prep when an upgrade choice is not tied to the map', () => {
    expect(upgradeChoiceSkipPhase({ mapState: '{}' })).toBe('PREP')
  })
})

describe('post-battle equipment rewards', () => {
  it('uses the tighter player battle income curve after exploration map rewards were added', () => {
    expect(playerBattleGoldIncome(1)).toBe(6)
    expect(playerBattleGoldIncome(6)).toBe(11)
    expect(playerBattleGoldIncome(12)).toBe(17)
    expect(Array.from({ length: 12 }, (_, index) => playerBattleGoldIncome(index + 1)).reduce((sum, income) => sum + income, 0)).toBe(138)
  })

  it('creates a bagged large item when bully vault is equipped', () => {
    const reward = postBattleLargeItemReward([
      { id: 'vault', defId: 'bully-vault', quality: 'GOLD', area: 'EQUIPMENT', x: 0, y: 0 },
    ], 'vault-reward')

    expect(reward).toMatchObject({ area: 'BAG', x: 0, y: 0, quality: expect.any(String) })
    expect(reward?.defId).toMatch(/^(giant-bone|dog-house|v3-dinosaur-leg-bone|v3-auto-waterer|v3-fermented-trash-bin|v3-golden-kennel)$/)
  })

  it('does not create a large item when bully vault is not equipped', () => {
    const reward = postBattleLargeItemReward([
      { id: 'vault', defId: 'bully-vault', quality: 'GOLD', area: 'BAG', x: 0, y: 0 },
    ], 'vault-reward')

    expect(reward).toBeNull()
  })

  it('assigns post-battle sell bonus growth by ingot type and carried area', () => {
    const growths = postBattleSellBonusItemGrowths([
      { id: 'gold-equipped', defId: 'dog-gold-ingot', quality: 'BRONZE', area: 'EQUIPMENT', x: 0, y: 0 },
      { id: 'gold-bagged', defId: 'dog-gold-ingot', quality: 'BRONZE', area: 'BAG', x: 0, y: 0 },
      { id: 'silver-equipped', defId: 'dog-silver-ingot', quality: 'BRONZE', area: 'EQUIPMENT', x: 1, y: 0 },
      { id: 'silver-bagged', defId: 'dog-silver-ingot', quality: 'BRONZE', area: 'BAG', x: 1, y: 0 },
      { id: 'bite', defId: 'small-bite', quality: 'BRONZE', area: 'EQUIPMENT', x: 2, y: 0 },
    ])

    expect(growths).toEqual([
      { id: 'gold-equipped', increment: 3 },
      { id: 'silver-equipped', increment: 1 },
      { id: 'silver-bagged', increment: 1 },
    ])
  })
})

describe('game item conversion', () => {
  it('exposes potion trigger dice overrides from item instances', () => {
    const [item] = toGameItems([{
      id: 'item-1',
      runId: 'run-1',
      defId: 'small-bite',
      quality: 'BRONZE',
      area: 'EQUIPMENT',
      x: 0,
      y: 0,
      enchant: null,
      triggerDiceOverride: JSON.stringify([2, 5]),
      sellBonus: 0,
      createdAt: new Date(),
    } as never])

    expect(item.triggerDiceOverride).toEqual([2, 5])
  })

  it('preserves duplicate extra potion points when exposing item instances', () => {
    const [item] = toGameItems([{
      id: 'item-1',
      runId: 'run-1',
      defId: 'small-bite',
      quality: 'BRONZE',
      area: 'EQUIPMENT',
      x: 0,
      y: 0,
      enchant: null,
      triggerDiceOverride: JSON.stringify([2, 2]),
      sellBonus: 0,
      createdAt: new Date(),
    } as never])

    expect(item.triggerDiceOverride).toEqual([2, 2])
  })
})

describe('finished battle records', () => {
  it('stores the player result with the post-battle win/loss record', () => {
    const record = createFinishedBattleRecord({
      winner: 'player',
      duration: 12,
      playerHp: 10,
      opponentHp: 0,
      playerMaxHp: 100,
      opponentMaxHp: 100,
      events: [],
      playerSnapshot: {
        name: 'Player',
        dogType: 'SHIBA',
        wins: 2,
        losses: 1,
        round: 3,
        items: [],
      },
      opponentSnapshot: {
        name: 'Opponent',
        dogType: 'MUTT',
        wins: 2,
        losses: 1,
        round: 3,
        items: [],
      },
    }, 3, 1)

    expect(record.winner).toBe('player')
    expect(record.playerSnapshot.wins).toBe(3)
    expect(record.playerSnapshot.losses).toBe(1)
    expect(record.opponentSnapshot.wins).toBe(2)
    expect(record.opponentSnapshot.losses).toBe(1)
  })
})

describe('post-battle phase flow', () => {
  it('runs class reward before a pending enchant shop and then returns to enchant choice after class reward', () => {
    const phase = nextPhaseData({
      id: 'run-1',
      dogType: 'SHIBA',
      losses: 3,
      enchantThirdLossGranted: false,
    }, 3, 'phase-seed')

    expect(phase.phase).toBe('CLASS_REWARD')
    expect(JSON.parse(phase.classRewardChoices)).toEqual([
      'shiba-speed-katana',
      'shiba-great-katana',
      'shiba-swallow-katana',
    ])
    expect(JSON.parse(phase.enchantChoices)).toHaveLength(3)
    expect(phase.enchantThirdLossGranted).toBe(true)
  })

  it('creates frog class reward choices on rounds 3 and 6', () => {
    const roundThree = nextPhaseData({
      id: 'frog-run',
      dogType: 'FROG' as never,
      losses: 0,
      enchantThirdLossGranted: false,
    }, 3, 'frog-round-3')
    const roundSix = nextPhaseData({
      id: 'frog-run',
      dogType: 'FROG' as never,
      losses: 0,
      enchantThirdLossGranted: false,
    }, 6, 'frog-round-6')

    expect(roundThree.phase).toBe('CLASS_REWARD')
    expect(JSON.parse(roundThree.classRewardChoices)).toEqual(['frog-lily-pump', 'frog-croak-drum', 'frog-raindrop-funnel'])
    expect(roundSix.phase).toBe('CLASS_REWARD')
    expect(JSON.parse(roundSix.classRewardChoices)).toEqual(['frog-lotus-echo', 'frog-rainy-season', 'frog-full-pond-gate'])
  })

  it('triggers the third-loss enchant shop once and records that it was granted', () => {
    const phase = nextPhaseData({
      id: 'run-2',
      dogType: 'MUTT',
      losses: 3,
      enchantThirdLossGranted: false,
    }, 5, 'third-loss-seed')

    expect(phase.phase).toBe('ENCHANT_CHOICE')
    expect(JSON.parse(phase.enchantChoices)).toHaveLength(3)
    expect(phase.enchantThirdLossGranted).toBe(true)

    const later = nextPhaseData({
      id: 'run-2',
      dogType: 'MUTT',
      losses: 3,
      enchantThirdLossGranted: true,
    }, 5, 'third-loss-seed')
    expect(later.phase).not.toBe('ENCHANT_CHOICE')
    expect(later.enchantThirdLossGranted).toBeUndefined()
  })
})

describe('player run history', () => {
  it('summarizes multiple runs for the current player', () => {
    const history = publicRunHistory([
      {
        id: 'active-run',
        mode: 'CASUAL',
        dogType: 'SHIBA',
        luckyNumber: null,
        wins: 2,
        losses: 1,
        round: 3,
        status: 'ACTIVE',
        phase: 'SHOP',
        relics: JSON.stringify([{ id: 'r1', relicId: 'midas-left', quality: 'BRONZE', slot: 0 }]),
        items: [{ id: 'item-1', runId: 'active-run', defId: 'small-bite', quality: 'SILVER', area: 'EQUIPMENT', x: 0, y: 0 }],
        createdAt: new Date('2026-05-19T10:00:00Z'),
        updatedAt: new Date('2026-05-19T10:10:00Z'),
      },
      {
        id: 'best-run',
        mode: 'CASUAL',
        dogType: 'EMPEROR',
        luckyNumber: 6,
        wins: 12,
        losses: 1,
        round: 13,
        status: 'COMPLETE',
        phase: 'COMPLETE',
        createdAt: new Date('2026-05-18T10:00:00Z'),
        updatedAt: new Date('2026-05-18T11:00:00Z'),
      },
      {
        id: 'abandoned-run',
        mode: 'CASUAL',
        dogType: 'MUTT',
        luckyNumber: null,
        wins: 1,
        losses: 2,
        round: 4,
        status: 'ABANDONED',
        phase: 'CHOICE',
        createdAt: new Date('2026-05-17T10:00:00Z'),
        updatedAt: new Date('2026-05-17T10:20:00Z'),
      },
    ])

    expect(history).toMatchObject({
      totalRuns: 3,
      activeRuns: 1,
      completedRuns: 1,
      abandonedRuns: 1,
      totalWins: 15,
      totalLosses: 4,
      bestRun: {
        id: 'best-run',
        dogType: 'EMPEROR',
        luckyNumber: 6,
        wins: 12,
        losses: 1,
        round: 13,
        status: 'COMPLETE',
      },
    })
    expect(history.recentRuns.map((run) => run.id)).toEqual(['active-run', 'best-run', 'abandoned-run'])
    expect(history.recentRuns[0]).toMatchObject({
      mode: 'CASUAL',
      items: [{ defId: 'small-bite', quality: 'SILVER', def: { id: 'small-bite' } }],
      relics: [{ relicId: 'midas-left', quality: 'BRONZE', def: { id: 'midas-left' } }],
    })
  })
})
