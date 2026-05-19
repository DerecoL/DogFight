export const STARTING_GOLD = 10
export const TRAINING_MATCH_ROUNDS = 2

export function isTrainingMatchRound(round: number) {
  return Math.max(0, Math.floor(round)) < TRAINING_MATCH_ROUNDS
}
