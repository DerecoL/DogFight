export const STARTING_GOLD = 10
export const TRAINING_MATCH_ROUNDS = 2

export type CasualGhostCandidate = {
  id: string
  runId: string | null
  userId: string | null
  wins: number
  losses: number
  createdAt: Date
}

export type CasualGhostSelectionInput = {
  wins: number
  seed: string
}

export function isTrainingMatchRound(round: number) {
  return Math.max(0, Math.floor(round)) < TRAINING_MATCH_ROUNDS
}

export function targetOpponentWins(wins: number) {
  return Math.max(0, Math.floor(wins) - 1)
}

function stableScore(seed: string) {
  let hash = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function selectCasualGhostSnapshot<T extends CasualGhostCandidate>(candidates: T[], input: CasualGhostSelectionInput) {
  const targetWins = targetOpponentWins(input.wins)
  return candidates
    .filter((candidate) => candidate.wins >= targetWins && candidate.wins <= input.wins)
    .slice()
    .sort((left, right) => {
      const leftDistance = Math.abs(left.wins - targetWins)
      const rightDistance = Math.abs(right.wins - targetWins)
      return leftDistance - rightDistance
        || stableScore(`${input.seed}-${left.id}`) - stableScore(`${input.seed}-${right.id}`)
        || left.createdAt.getTime() - right.createdAt.getTime()
    })[0] ?? null
}
