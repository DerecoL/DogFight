import { describe, expect, it } from 'vitest'
import { calculateLadderResult, ladderTierForScore } from './ladder'

describe('ladder scoring', () => {
  it('applies the run score formula with tier tax, loss penalty, and perfect bonus', () => {
    expect(calculateLadderResult({ tier: 'BRONZE', score: 0, gamesPlayed: 6 }, { wins: 8, losses: 4 }).delta).toBe(10)
    expect(calculateLadderResult({ tier: 'GOLD', score: 40, gamesPlayed: 6 }, { wins: 8, losses: 4 }).delta).toBe(2)
    expect(calculateLadderResult({ tier: 'DIAMOND', score: 40, gamesPlayed: 6 }, { wins: 8, losses: 4 }).delta).toBe(-16)
    expect(calculateLadderResult({ tier: 'MASTER', score: 120, gamesPlayed: 6 }, { wins: 10, losses: 3 }).delta).toBe(4)
    expect(calculateLadderResult({ tier: 'DOG_KING', score: 520, gamesPlayed: 6 }, { wins: 12, losses: 2 }).delta).toBe(25)
    expect(calculateLadderResult({ tier: 'MASTER', score: 120, gamesPlayed: 6 }, { wins: 12, losses: 0 }).breakdown.perfectBonus).toBe(8)
  })

  it('protects early bronze and silver games from negative score changes', () => {
    expect(calculateLadderResult({ tier: 'BRONZE', score: 0, gamesPlayed: 0 }, { wins: 2, losses: 5 }).delta).toBe(0)
    expect(calculateLadderResult({ tier: 'SILVER', score: 20, gamesPlayed: 4 }, { wins: 3, losses: 5 }).delta).toBe(0)
    expect(calculateLadderResult({ tier: 'GOLD', score: 20, gamesPlayed: 4 }, { wins: 3, losses: 5 }).delta).toBeLessThan(0)
  })

  it('promotes fixed-lp tiers at 100 points and enters the next tier at 20 points', () => {
    const result = calculateLadderResult({ tier: 'GOLD', score: 90, gamesPlayed: 10 }, { wins: 12, losses: 1 })

    expect(result.before).toMatchObject({ tier: 'GOLD', score: 90 })
    expect(result.after).toMatchObject({ tier: 'PLATINUM', score: 20 })
    expect(result.promoted).toBe(true)
  })

  it('uses master score for master and dog king, with dog king starting at 500 points', () => {
    expect(ladderTierForScore('MASTER', 499)).toBe('MASTER')
    expect(ladderTierForScore('MASTER', 500)).toBe('DOG_KING')

    const result = calculateLadderResult({ tier: 'MASTER', score: 490, gamesPlayed: 12 }, { wins: 12, losses: 1 })
    expect(result.after).toMatchObject({ tier: 'DOG_KING', score: 525 })
    expect(result.promoted).toBe(true)
  })
})
