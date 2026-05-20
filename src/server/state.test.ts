import { describe, expect, it } from 'vitest'
import { createFinishedBattleRecord, postBattleLargeItemReward, publicRelics, publicRunHistory } from './state'

describe('public run relic data', () => {
  it('returns quality-adjusted relic descriptions for upgraded relics', () => {
    const relics = publicRelics({
      relics: JSON.stringify([{ id: 'r1', relicId: 'midas-left', quality: 'GOLD', slot: 0 }]),
    })

    expect(relics[0].def.description).toContain('75%')
  })
})

describe('post-battle equipment rewards', () => {
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
