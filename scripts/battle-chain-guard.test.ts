import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ALL_ITEM_DEFS } from '../src/server/game/data'
import type { BattleEvent, BattleResult, FighterSnapshot } from '../src/server/game/types'
import {
  evaluateGuardScenario,
  generateGuardScenarios,
  HIGH_RISK_EFFECTS,
  type BattleChainAllowlistEntry,
  type BattleChainGuardScenario,
} from './battle-chain-guard'

function fighter(items: FighterSnapshot['items'] = []): FighterSnapshot {
  return { name: 'P', dogType: 'SHIBA', wins: 0, losses: 0, round: 8, items }
}

function event(overrides: Partial<BattleEvent>): BattleEvent {
  return {
    time: 1,
    actor: 'player',
    kind: 'ITEM',
    text: 'event',
    playerHp: 100,
    opponentHp: 100,
    playerMaxHp: 100,
    opponentMaxHp: 100,
    playerShield: 0,
    opponentShield: 0,
    ...overrides,
  }
}

function battleResult(events: BattleEvent[]): BattleResult {
  return {
    winner: 'player',
    duration: 1,
    playerHp: 100,
    opponentHp: 50,
    playerMaxHp: 100,
    opponentMaxHp: 100,
    events,
    playerSnapshot: fighter(),
    opponentSnapshot: fighter(),
  }
}

function scenario(id = 'test-scenario'): BattleChainGuardScenario {
  return {
    id,
    seed: id,
    player: fighter([{ id: 'bite', defId: 'starter-1', quality: 'BRONZE', area: 'EQUIPMENT', x: 0, y: 0 }]),
    opponent: fighter(),
    tags: ['test'],
  }
}

describe('battle chain guard', () => {
  it('fails a scenario with a trigger queue safety cap event', () => {
    const report = evaluateGuardScenario({
      scenario: scenario(),
      result: battleResult([event({ safetyCode: 'TRIGGER_QUEUE_CAP', text: 'cap' })]),
      elapsedMs: 5,
      allowlist: [],
    })

    expect(report.allowed).toBe(false)
    expect(report.findings).toContainEqual(expect.objectContaining({ rule: 'TRIGGER_QUEUE_CAP' }))
  })

  it('allows an explicitly documented trigger queue cap scenario', () => {
    const allowlist: BattleChainAllowlistEntry[] = [{ scenarioId: 'allowed-cap', reason: 'intentional stress fixture' }]
    const report = evaluateGuardScenario({
      scenario: scenario('allowed-cap'),
      result: battleResult([event({ safetyCode: 'TRIGGER_QUEUE_CAP', text: 'cap' })]),
      elapsedMs: 5,
      allowlist,
    })

    expect(report.allowed).toBe(true)
    expect(report.findings).toContainEqual(expect.objectContaining({ rule: 'TRIGGER_QUEUE_CAP' }))
  })

  it('generates at least one guard scenario for every item definition', () => {
    const scenarios = generateGuardScenarios()
    const coveredItemIds = new Set(scenarios.flatMap((entry) => [entry.player.items, entry.opponent.items].flat().map((item) => item.defId)))

    expect(ALL_ITEM_DEFS.every((def) => coveredItemIds.has(def.id))).toBe(true)
  })

  it('covers the known high-risk advanced effects', () => {
    const scenarios = generateGuardScenarios()
    const coveredEffects = new Set(
      scenarios
        .flatMap((entry) => [entry.player.items, entry.opponent.items].flat())
        .map((item) => ALL_ITEM_DEFS.find((def) => def.id === item.defId)?.advancedEffect)
        .filter(Boolean),
    )

    for (const effect of HIGH_RISK_EFFECTS) expect(coveredEffects.has(effect)).toBe(true)
  })

  it('runs chain guard before the production build', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> }

    expect(pkg.scripts['guard:chains']).toBe('tsx scripts/battle-chain-guard.ts')
    expect(pkg.scripts.build).toContain('npm run guard:chains &&')
  })
})
