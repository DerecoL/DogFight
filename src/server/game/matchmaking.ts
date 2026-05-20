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

export type LadderGhostSelectionInput = {
  preferredWins: number
  seed: string
}

export type LadderOpponentRangeInput = {
  tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND' | 'MASTER' | 'DOG_KING'
  wins: number
  round: number
}

export function isTrainingMatchRound(round: number) {
  return Math.max(0, Math.floor(round)) < TRAINING_MATCH_ROUNDS
}

export function targetOpponentWins(wins: number) {
  return Math.max(0, Math.floor(wins) - 1)
}

export function targetLadderOpponentWinsRange(input: LadderOpponentRangeInput) {
  const wins = Math.max(0, Math.floor(input.wins))
  if (input.tier === 'BRONZE' || input.tier === 'SILVER') {
    const preferred = targetOpponentWins(wins)
    return { min: preferred, max: wins, preferred }
  }
  if ((input.tier === 'DIAMOND' || input.tier === 'MASTER' || input.tier === 'DOG_KING') && input.round >= 6) {
    return { min: wins, max: wins + 1, preferred: wins }
  }
  return { min: wins, max: wins, preferred: wins }
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

export function selectLadderGhostSnapshot<T extends CasualGhostCandidate>(candidates: T[], input: LadderGhostSelectionInput) {
  return candidates
    .slice()
    .sort((left, right) => {
      const leftDistance = Math.abs(left.wins - input.preferredWins)
      const rightDistance = Math.abs(right.wins - input.preferredWins)
      return leftDistance - rightDistance
        || stableScore(`${input.seed}-${left.id}`) - stableScore(`${input.seed}-${right.id}`)
        || left.createdAt.getTime() - right.createdAt.getTime()
    })[0] ?? null
}
