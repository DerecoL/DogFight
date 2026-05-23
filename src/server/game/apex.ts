import { buildOfflineFighter } from './offline-builder'
import { simulateBattle } from './battle'
import type { BattleResult, DogType, FighterSnapshot } from './types'

const APEX_SEED_COUNT = 50
const DOG_TYPES: DogType[] = ['SHIBA', 'SAMOYED', 'MUTT', 'BULLY', 'EMPEROR']
const SHANGHAI_DAILY_RESET_OFFSET_MS = 3 * 60 * 60 * 1000

export type ApexSeedEntry = {
  rank: number
  fighter: FighterSnapshot
}

export type ApexBoardType = 'OVERALL' | 'DAILY'

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

export function dailyApexBoardKey(date = new Date()): string {
  const shifted = new Date(date.getTime() + SHANGHAI_DAILY_RESET_OFFSET_MS)
  const year = shifted.getUTCFullYear()
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0')
  const day = String(shifted.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function resolveApexChallenge(challenger: FighterSnapshot, opponents: ApexOpponent[], seed: string): ApexChallengeReport {
  const battles: ApexBattleSummary[] = []
  const ordered = [...opponents].sort((a, b) => a.rank - b.rank)

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

    if (result.winner === 'player') {
      return {
        placementRank: opponent.rank,
        battles,
      }
    }
  }

  return {
    placementRank: ordered.at(-1)?.rank ? ordered.at(-1)!.rank + 1 : 1,
    battles,
  }
}
