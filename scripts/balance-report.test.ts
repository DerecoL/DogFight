import { describe, expect, it } from 'vitest'
import { baselineFighters, buildBalanceReport, extractBattleLogSample, extractDogfightBattleSample } from './balance-report'
import { simulateBattle } from '../src/server/game/battle'
import type { BattleResult, DogType, FighterSnapshot } from '../src/server/game/types'

function fighter(dogType: DogType, round = 3): FighterSnapshot {
  return {
    name: dogType,
    dogType,
    luckyNumber: dogType === 'EMPEROR' ? 3 : null,
    wins: 0,
    losses: 0,
    round,
    items: [
      { id: `${dogType}-bite`, defId: 'starter-3', quality: 'BRONZE', area: 'EQUIPMENT', x: 0, y: 0 },
    ],
    relics: [],
  }
}

function battleResult(overrides: Partial<BattleResult> = {}): BattleResult {
  return {
    winner: 'player',
    duration: 12,
    playerHp: 80,
    opponentHp: 0,
    playerMaxHp: 100,
    opponentMaxHp: 100,
    events: [],
    playerSnapshot: fighter('SHIBA', 4),
    opponentSnapshot: fighter('MUTT', 4),
    ...overrides,
  }
}

describe('balance report extraction', () => {
  it('extracts combat fields from BattleLog.log', () => {
    const sample = extractBattleLogSample({
      id: 'battle-log-1',
      result: 'player',
      log: JSON.stringify(battleResult()),
      run: { mode: 'LADDER', dogType: 'SHIBA', round: 5, wins: 2, losses: 1 },
    })

    expect(sample).toMatchObject({
      source: 'BATTLE_LOG',
      sourceId: 'battle-log-1',
      mode: 'LADDER',
      round: 4,
      playerDog: 'SHIBA',
      opponentDog: 'MUTT',
      winner: 'player',
      winnerDog: 'SHIBA',
      duration: 12,
      playerItemCount: 1,
      opponentItemCount: 1,
    })
  })

  it('extracts DogfightBattle winner from the stored A-side battle perspective', () => {
    const sample = extractDogfightBattleSample({
      id: 'dogfight-battle-1',
      round: 3,
      opponentKind: 'PLAYER',
      winnerSide: 'opponent',
      result: JSON.stringify(battleResult({
        winner: 'opponent',
        playerSnapshot: fighter('MUTT', 3),
        opponentSnapshot: fighter('SAMOYED', 3),
      })),
    })

    expect(sample).toMatchObject({
      source: 'DOGFIGHT',
      mode: 'DOGFIGHT',
      round: 3,
      playerDog: 'MUTT',
      opponentDog: 'SAMOYED',
      winner: 'opponent',
      winnerDog: 'SAMOYED',
    })
  })

  it('marks small real-data samples as insufficient instead of making strong conclusions', () => {
    const report = buildBalanceReport([extractBattleLogSample({
      id: 'battle-log-1',
      result: 'player',
      log: JSON.stringify(battleResult()),
      run: { mode: 'CASUAL', dogType: 'SHIBA', round: 4, wins: 1, losses: 0 },
    })], { minSamples: 3, includeMatrices: false })

    expect(report.realData.sampleStatus).toBe('insufficient-sample')
    expect(report.realData.totalBattles).toBe(1)
    expect(report.realData.overallByDog.SHIBA).toMatchObject({ battles: 1, wins: 1, winRate: null })
  })

  it('keeps all manual baseline fighters simulatable', () => {
    for (const [dogType, phases] of Object.entries(baselineFighters)) {
      for (const [phase, snapshot] of Object.entries(phases)) {
        const result = simulateBattle(snapshot, fighter(dogType as DogType, snapshot.round), `baseline-${dogType}-${phase}`)
        expect(result.events.length).toBeGreaterThan(0)
        expect(['player', 'opponent']).toContain(result.winner)
      }
    }
  })
})
