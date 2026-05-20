import { describe, expect, it } from 'vitest'
import { selectCasualGhostSnapshot, targetOpponentWins, type CasualGhostCandidate } from './matchmaking'

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
