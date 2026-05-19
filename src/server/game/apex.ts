import { buildOfflineFighter } from './offline-builder'
import { simulateBattle } from './battle'
import type { BattleResult, DogType, FighterSnapshot } from './types'

const APEX_SEED_COUNT = 50
const DOG_TYPES: DogType[] = ['SHIBA', 'SAMOYED', 'MUTT', 'BULLY', 'EMPEROR']

export type ApexSeedEntry = {
  rank: number
  fighter: FighterSnapshot
}

export type ApexOpponent = {
  id: string
  rank: number
  fighter: FighterSnapshot
}

export type ApexBattleSummary = {
  opponentId: string
  opponentRank: number
  opponentName: string
  winner: BattleResult['winner']
  duration: number
  playerHp: number
  opponentHp: number
}

export type ApexChallengeReport = {
  placementRank: number
  challengeWins: number
  battles: ApexBattleSummary[]
}

export function buildApexSeedEntries(): ApexSeedEntry[] {
  return Array.from({ length: APEX_SEED_COUNT }, (_, index) => {
    const rank = index + 1
    const strength = APEX_SEED_COUNT - index
    const round = Math.max(1, Math.ceil(strength / 4))
    const wins = Math.min(12, Math.max(0, Math.floor((strength - 1) / 4)))
    const losses = Math.max(0, 2 - Math.floor(strength / 18))
    const dogType = DOG_TYPES[index % DOG_TYPES.length]
    const fighter = buildOfflineFighter({
      dogType,
      round,
      wins,
      losses,
      seed: `apex-seed-${rank}`,
    })

    return {
      rank,
      fighter: {
        ...fighter,
        name: `Apex Seed ${rank}`,
      },
    }
  })
}

export function resolveApexChallenge(challenger: FighterSnapshot, opponents: ApexOpponent[], seed: string): ApexChallengeReport {
  const battles: ApexBattleSummary[] = []
  const ordered = [...opponents].sort((a, b) => b.rank - a.rank)
  let challengeWins = 0

  for (const opponent of ordered) {
    const result = simulateBattle(challenger, opponent.fighter, `${seed}-${opponent.rank}-${opponent.id}`)
    battles.push({
      opponentId: opponent.id,
      opponentRank: opponent.rank,
      opponentName: opponent.fighter.name,
      winner: result.winner,
      duration: result.duration,
      playerHp: result.playerHp,
      opponentHp: result.opponentHp,
    })

    if (result.winner !== 'player') {
      return {
        placementRank: opponent.rank + 1,
        challengeWins,
        battles,
      }
    }

    challengeWins += 1
  }

  return {
    placementRank: 1,
    challengeWins,
    battles,
  }
}
