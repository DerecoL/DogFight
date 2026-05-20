import { describe, expect, it } from 'vitest'
import { selectCasualGhostSnapshot, selectLadderGhostSnapshot, targetLadderOpponentWinsRange, targetOpponentWins, type CasualGhostCandidate } from './matchmaking'

function candidate(id: string, wins: number, createdAt: string): CasualGhostCandidate {
  return {
    id,
    runId: `run-${id}`,
    userId: `user-${id}`,
    wins,
    losses: 1,
    createdAt: new Date(createdAt),
  }
}

describe('casual matchmaking', () => {
  it('targets one fewer win without going below zero', () => {
    expect(targetOpponentWins(5)).toBe(4)
    expect(targetOpponentWins(1)).toBe(0)
    expect(targetOpponentWins(0)).toBe(0)
  })

  it('prefers a one-win-lower ghost over a newer same-win ghost', () => {
    const selected = selectCasualGhostSnapshot(
      [
        candidate('same-newest', 5, '2026-05-20T10:04:00.000Z'),
        candidate('lower-older', 4, '2026-05-20T10:01:00.000Z'),
      ],
      { wins: 5, seed: 'run-a-round-6' },
    )

    expect(selected?.id).toBe('lower-older')
  })

  it('uses stable candidate scoring instead of always choosing the newest ghost', () => {
    const newest = candidate('newest', 4, '2026-05-20T10:04:00.000Z')
    const selected = selectCasualGhostSnapshot(
      [
        candidate('older-a', 4, '2026-05-20T10:01:00.000Z'),
        newest,
        candidate('older-b', 4, '2026-05-20T10:02:00.000Z'),
      ],
      { wins: 5, seed: 'run-b-round-6' },
    )

    expect(selected?.id).not.toBe(newest.id)
    expect(selectCasualGhostSnapshot([candidate('older-a', 4, '2026-05-20T10:01:00.000Z'), newest], { wins: 5, seed: 'run-b-round-6' })?.id)
      .toBe(selectCasualGhostSnapshot([candidate('older-a', 4, '2026-05-20T10:01:00.000Z'), newest], { wins: 5, seed: 'run-b-round-6' })?.id)
  })
})

describe('ladder matchmaking', () => {
  it('keeps bronze and silver relaxed by targeting one fewer win first', () => {
    expect(targetLadderOpponentWinsRange({ tier: 'BRONZE', wins: 5, round: 6 })).toEqual({ min: 4, max: 5, preferred: 4 })
    expect(targetLadderOpponentWinsRange({ tier: 'SILVER', wins: 1, round: 6 })).toEqual({ min: 0, max: 1, preferred: 0 })
  })

  it('targets same-win opponents for gold and platinum', () => {
    expect(targetLadderOpponentWinsRange({ tier: 'GOLD', wins: 5, round: 6 })).toEqual({ min: 5, max: 5, preferred: 5 })
    expect(targetLadderOpponentWinsRange({ tier: 'PLATINUM', wins: 5, round: 6 })).toEqual({ min: 5, max: 5, preferred: 5 })
  })

  it('allows one higher win in late diamond and above while preferring same-win opponents', () => {
    expect(targetLadderOpponentWinsRange({ tier: 'DIAMOND', wins: 7, round: 7 })).toEqual({ min: 7, max: 8, preferred: 7 })
    expect(targetLadderOpponentWinsRange({ tier: 'MASTER', wins: 7, round: 5 })).toEqual({ min: 7, max: 7, preferred: 7 })
  })

  it('selects the candidate closest to the ladder preferred win target', () => {
    const selected = selectLadderGhostSnapshot(
      [
        candidate('higher', 8, '2026-05-20T10:04:00.000Z'),
        candidate('same', 7, '2026-05-20T10:01:00.000Z'),
      ],
      { preferredWins: 7, seed: 'ladder-run' },
    )

    expect(selected?.id).toBe('same')
  })
})
