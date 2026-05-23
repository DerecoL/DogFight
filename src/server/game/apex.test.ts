import { describe, expect, it } from 'vitest'
import { buildApexSeedEntries, dailyApexBoardKey, resolveApexChallenge } from './apex'
import type { FighterSnapshot } from './types'

function fighter(name: string, round: number, wins = 12): FighterSnapshot {
  return {
    name,
    dogType: 'SHIBA',
    wins,
    losses: 0,
    round,
    items: [],
    relics: [],
  }
}

describe('apex arena logic', () => {
  it('builds exactly fifty deterministic seed entries from weakest rank to strongest rank', () => {
    const first = buildApexSeedEntries()
    const second = buildApexSeedEntries()

    expect(first).toHaveLength(50)
    expect(first.map((entry) => entry.rank)).toEqual(Array.from({ length: 50 }, (_, index) => index + 1))
    expect(first).toEqual(second)
    expect(first[0].fighter.round).toBeGreaterThan(first[49].fighter.round)
  })

  it('challenges downward from the top and places the challenger at the first beaten rank', () => {
    const report = resolveApexChallenge(
      fighter('challenger', 6),
      [
        { id: 'rank-1', rank: 1, fighter: fighter('boss', 20) },
        { id: 'rank-2', rank: 2, fighter: fighter('wall', 9) },
        { id: 'rank-3', rank: 3, fighter: fighter('gate', 1, 0) },
      ],
      'apex-test',
    )

    expect(report.battles.map((battle) => battle.opponentRank)).toEqual([1, 2, 3])
    expect(report).not.toHaveProperty('challengeWins')
    expect(report.placementRank).toBe(3)
    expect(report.battles.at(-1)?.winner).toBe('player')
  })

  it('rolls the daily board key at 05:00 in Asia/Shanghai', () => {
    expect(dailyApexBoardKey(new Date('2026-05-19T20:59:59.000Z'))).toBe('2026-05-19')
    expect(dailyApexBoardKey(new Date('2026-05-19T21:00:00.000Z'))).toBe('2026-05-20')
  })
})
