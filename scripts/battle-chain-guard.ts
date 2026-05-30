import { existsSync, readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { ALL_ITEM_DEFS, RELIC_DEFS, itemDef } from '../src/server/game/data'
import { simulateBattle } from '../src/server/game/battle'
import type {
  AdvancedEffect,
  BattleEvent,
  BattleResult,
  DogType,
  Enchantment,
  FighterSnapshot,
  GameItem,
  ItemQuality,
  RelicInstance,
} from '../src/server/game/types'

export const HIGH_RISK_EFFECTS = [
  'TRIGGER_ADJACENT',
  'TRIGGER_MINUS_THREE',
  'ADJACENT_ON_EXTRA_ROLL',
  'EXTRA_ROLL_RECURSE',
  'EXTRA_ROLL_TRIGGERS_ALL',
  'LARGE_TRIGGERS_NON_LARGE',
  'SMALL_TRIGGERS_LARGE',
  'FROG_CHARGE_ADJACENT',
  'FROG_TRIGGER_HIGHEST_RESERVOIR',
  'BOOM_COUNTER',
] satisfies AdvancedEffect[]

const ALL_DICE = [1, 2, 3, 4, 5, 6]
const MAX_ITEM_EVENTS_PER_ACTOR_TIME = 40
const MAX_ITEM_TRIGGERS_PER_ACTOR_TIME = 15
const MAX_SCENARIO_EVENTS = 1500
const MAX_SCENARIO_MS = 250
const ALLOWLIST_PATH = 'scripts/battle-chain-allowlist.json'

export type BattleChainAllowlistEntry = {
  scenarioId: string
  reason: string
}

export type BattleChainGuardScenario = {
  id: string
  seed: string
  player: FighterSnapshot
  opponent: FighterSnapshot
  tags: string[]
}

export type GuardFindingRule =
  | 'TRIGGER_QUEUE_CAP'
  | 'EXTRA_ROLL_CHAIN_CAP'
  | 'ITEM_EVENTS_PER_ACTOR_TIME'
  | 'ITEM_TRIGGERS_PER_ACTOR_TIME'
  | 'SCENARIO_EVENT_COUNT'
  | 'SCENARIO_RUNTIME_MS'
  | 'SIMULATION_ERROR'
  | 'INVALID_RESULT'
  | 'INVALID_EVENT'
  | 'ALLOWLIST_CONFIG'

export type GuardFinding = {
  rule: GuardFindingRule
  message: string
  actor?: BattleEvent['actor']
  time?: number
  itemId?: string
  count?: number
  lastEvents: Array<Pick<BattleEvent, 'time' | 'actor' | 'kind' | 'itemId' | 'defId' | 'safetyCode' | 'text'>>
}

export type GuardScenarioReport = {
  scenario: BattleChainGuardScenario
  elapsedMs: number
  allowed: boolean
  allowReason?: string
  findings: GuardFinding[]
}

type EvaluateInput = {
  scenario: BattleChainGuardScenario
  result: BattleResult
  elapsedMs: number
  allowlist: BattleChainAllowlistEntry[]
}

type RunInput = {
  scenarioId?: string
  allowlistPath?: string
}

type RunOutput = {
  reports: GuardScenarioReport[]
  configFindings: GuardFinding[]
}

function qualityFor(defId: string): ItemQuality {
  return itemDef(defId).defaultQuality ?? 'BRONZE'
}

function equipment(id: string, defId: string, x: number, overrides: Partial<GameItem> = {}): GameItem {
  return {
    id,
    defId,
    quality: overrides.quality ?? qualityFor(defId),
    area: 'EQUIPMENT',
    x,
    y: 0,
    triggerDiceOverride: overrides.triggerDiceOverride ?? ALL_DICE,
    enchant: overrides.enchant,
    sellBonus: overrides.sellBonus,
  }
}

function relic(relicId: string, slot: number): RelicInstance {
  const def = RELIC_DEFS.find((entry) => entry.id === relicId)
  if (!def) throw new Error(`Unknown relic ${relicId}`)
  return { id: `${relicId}-${slot}`, relicId, quality: def.defaultQuality, slot }
}

function dogFor(defIds: string[], fallback: DogType = 'SHIBA'): DogType {
  const classDog = defIds.map((id) => itemDef(id).classDog).find(Boolean)
  return classDog ?? fallback
}

function fighter(name: string, dogType: DogType, items: GameItem[], relics: RelicInstance[] = []): FighterSnapshot {
  return { name, dogType, luckyNumber: dogType === 'EMPEROR' ? 1 : null, wins: 0, losses: 0, round: 8, items, relics }
}

function scenarioId(parts: string[]) {
  return parts.join('-').replace(/[^a-zA-Z0-9_-]+/g, '-').toLowerCase()
}

function eventSummary(events: BattleEvent[]) {
  return events.slice(-8).map((event) => ({
    time: event.time,
    actor: event.actor,
    kind: event.kind,
    itemId: event.itemId,
    defId: event.defId,
    safetyCode: event.safetyCode,
    text: event.text,
  }))
}

function addScenario(target: Map<string, BattleChainGuardScenario>, scenario: BattleChainGuardScenario) {
  if (target.has(scenario.id)) throw new Error(`Duplicate battle chain guard scenario id: ${scenario.id}`)
  target.set(scenario.id, scenario)
}

function makeScenario(idParts: string[], items: GameItem[], options: Partial<Pick<BattleChainGuardScenario, 'tags'>> & { dogType?: DogType; relics?: RelicInstance[]; opponentItems?: GameItem[] } = {}): BattleChainGuardScenario {
  const dogType = options.dogType ?? dogFor(items.map((item) => item.defId))
  const id = scenarioId(idParts)
  return {
    id,
    seed: `guard-${id}`,
    player: fighter('P', dogType, items, options.relics ?? []),
    opponent: fighter('O', 'SHIBA', options.opponentItems ?? []),
    tags: options.tags ?? [],
  }
}

function layout(defIds: string[], prefix: string, enchant?: Enchantment) {
  let x = 0
  return defIds.map((defId, index) => {
    const item = equipment(`${prefix}-${index}`, defId, x, enchant ? { enchant } : {})
    x += Math.max(1, itemDef(defId).width)
    return item
  })
}

const triggerAdjacentEnchant: Enchantment = { kind: 'TRIGGER_NEIGHBOR', target: 'ADJACENT', label: 'trigger adjacent' }
const triggerLeftEnchant: Enchantment = { kind: 'TRIGGER_NEIGHBOR', target: 'LEFT', label: 'trigger left' }
const triggerRightEnchant: Enchantment = { kind: 'TRIGGER_NEIGHBOR', target: 'RIGHT', label: 'trigger right' }

export function generateGuardScenarios(): BattleChainGuardScenario[] {
  const scenarios = new Map<string, BattleChainGuardScenario>()

  for (const def of ALL_ITEM_DEFS) {
    addScenario(scenarios, makeScenario(['single', def.id], [equipment('subject', def.id, 0)], { tags: ['single', def.advancedEffect ?? 'NONE'] }))
  }

  for (const def of ALL_ITEM_DEFS.filter((entry) => HIGH_RISK_EFFECTS.includes(entry.advancedEffect as AdvancedEffect))) {
    addScenario(scenarios, makeScenario(['risk-left', def.id], layout([def.id, 'starter-1'], 'risk-left'), { tags: ['risk-pair', def.advancedEffect ?? 'NONE'] }))
    addScenario(scenarios, makeScenario(['risk-right', def.id], layout(['starter-1', def.id], 'risk-right'), { tags: ['risk-pair', def.advancedEffect ?? 'NONE'] }))
  }

  const fixtures: Array<{ id: string; dogType?: DogType; defIds: string[]; tags: string[]; enchant?: Enchantment; relics?: RelicInstance[] }> = [
    { id: 'shiba-adjacent-trigger-chain', dogType: 'SHIBA', defIds: ['shiba-great-katana', 'starter-1', 'starter-2', 'starter-3'], tags: ['class', 'adjacent'] },
    { id: 'night-patrol-repeat-chain', defIds: ['v3-night-patrol-light', 'starter-1', 'starter-2', 'starter-3'], tags: ['adjacent', 'repeat'] },
    { id: 'bully-large-small-fanout', dogType: 'BULLY', defIds: ['bully-sacrifice', 'bully-gym', 'giant-bone', 'small-bite'], tags: ['bully', 'fanout'] },
    { id: 'mutt-extra-roll-fanout', dogType: 'MUTT', defIds: ['mutt-chase-car', 'mutt-counting-collar', 'mutt-chase-tail', 'starter-1'], tags: ['extra-roll'] },
    { id: 'frog-reservoir-fanout', dogType: 'FROG', defIds: ['frog-raindrop-funnel', 'frog-full-pond-gate', 'frog-croak-drum', 'starter-1'], tags: ['frog', 'reservoir'] },
    { id: 'multi-boom-counter', defIds: ['training-disc', 'lotus-sea', 'kyushu-bracer', 'v4-boom-counter'], tags: ['multi', 'counter'] },
    { id: 'left-neighbor-enchant-chain', defIds: ['starter-1', 'starter-2', 'starter-3'], tags: ['enchant'], enchant: triggerLeftEnchant },
    { id: 'right-neighbor-enchant-chain', defIds: ['starter-1', 'starter-2', 'starter-3'], tags: ['enchant'], enchant: triggerRightEnchant },
    { id: 'adjacent-neighbor-enchant-chain', defIds: ['starter-1', 'starter-2', 'starter-3', 'starter-4'], tags: ['enchant'], enchant: triggerAdjacentEnchant },
    { id: 'relic-trigger-remap', defIds: ['starter-1', 'starter-4', 'lucky-paw'], tags: ['relic'], relics: [relic('carrot', 0), relic('tissue', 1)] },
    { id: 'half-die-relic-scale', defIds: ['starter-1', 'starter-4', 'giant-bone'], tags: ['relic'], relics: [relic('half-die-left', 0), relic('midas-left', 1)] },
    { id: 'potion-all-dice-trigger-override', defIds: ['small-bite', 'v3-hydrant-axe', 'v4-growing-chew-sword'], tags: ['potion'] },
  ]

  for (const fixture of fixtures) {
    addScenario(scenarios, makeScenario(
      ['fixture', fixture.id],
      layout(fixture.defIds, fixture.id, fixture.enchant),
      { dogType: fixture.dogType, tags: fixture.tags, relics: fixture.relics },
    ))
  }

  return [...scenarios.values()]
}

function allowReasonFor(scenarioId: string, allowlist: BattleChainAllowlistEntry[]) {
  const entry = allowlist.find((candidate) => candidate.scenarioId === scenarioId)
  const reason = entry?.reason.trim()
  return reason ? reason : null
}

function finding(rule: GuardFindingRule, message: string, events: BattleEvent[], extra: Partial<GuardFinding> = {}): GuardFinding {
  return { rule, message, lastEvents: eventSummary(events), ...extra }
}

export function evaluateGuardScenario(input: EvaluateInput): GuardScenarioReport {
  const findings: GuardFinding[] = []
  const { result, elapsedMs, scenario, allowlist } = input
  const events = Array.isArray(result.events) ? result.events : []

  if (result.winner !== 'player' && result.winner !== 'opponent') {
    findings.push(finding('INVALID_RESULT', 'Battle result did not resolve to a valid winner.', events))
  }
  if (events.length === 0) findings.push(finding('INVALID_RESULT', 'Battle result produced no events.', events))
  if (events.length > MAX_SCENARIO_EVENTS) {
    findings.push(finding('SCENARIO_EVENT_COUNT', `Scenario produced ${events.length} events.`, events, { count: events.length }))
  }
  if (elapsedMs > MAX_SCENARIO_MS) {
    findings.push(finding('SCENARIO_RUNTIME_MS', `Scenario took ${elapsedMs}ms.`, events, { count: elapsedMs }))
  }

  for (const event of events) {
    if (typeof event.time !== 'number' || !event.actor || !event.kind || typeof event.text !== 'string') {
      findings.push(finding('INVALID_EVENT', 'Battle event is missing required structured fields.', events, { time: event.time, actor: event.actor }))
      break
    }
    if (event.safetyCode === 'TRIGGER_QUEUE_CAP' || event.safetyCode === 'EXTRA_ROLL_CHAIN_CAP') {
      findings.push(finding(event.safetyCode, `Scenario emitted ${event.safetyCode}.`, events, { time: event.time, actor: event.actor, itemId: event.itemId }))
    }
  }

  const itemEventsByActorTime = new Map<string, BattleEvent[]>()
  const itemTriggersByActorTimeItem = new Map<string, BattleEvent[]>()
  for (const event of events.filter((entry) => entry.kind === 'ITEM')) {
    const actorTimeKey = `${event.actor}:${event.time}`
    itemEventsByActorTime.set(actorTimeKey, [...(itemEventsByActorTime.get(actorTimeKey) ?? []), event])
    if (event.itemId) {
      const itemKey = `${actorTimeKey}:${event.itemId}`
      itemTriggersByActorTimeItem.set(itemKey, [...(itemTriggersByActorTimeItem.get(itemKey) ?? []), event])
    }
  }

  for (const group of itemEventsByActorTime.values()) {
    if (group.length > MAX_ITEM_EVENTS_PER_ACTOR_TIME) {
      findings.push(finding('ITEM_EVENTS_PER_ACTOR_TIME', `Scenario produced ${group.length} item events at one actor/time.`, group, {
        actor: group[0]?.actor,
        time: group[0]?.time,
        count: group.length,
      }))
    }
  }
  for (const group of itemTriggersByActorTimeItem.values()) {
    if (group.length > MAX_ITEM_TRIGGERS_PER_ACTOR_TIME) {
      findings.push(finding('ITEM_TRIGGERS_PER_ACTOR_TIME', `Item triggered ${group.length} times at one actor/time.`, group, {
        actor: group[0]?.actor,
        time: group[0]?.time,
        itemId: group[0]?.itemId,
        count: group.length,
      }))
    }
  }

  const allowReason = allowReasonFor(scenario.id, allowlist)
  return {
    scenario,
    elapsedMs,
    findings,
    allowed: findings.length === 0 || Boolean(allowReason),
    allowReason: allowReason ?? undefined,
  }
}

export function loadAllowlist(path = ALLOWLIST_PATH): BattleChainAllowlistEntry[] {
  if (!existsSync(path)) return []
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown
  if (!Array.isArray(parsed)) throw new Error(`${path} must contain a JSON array.`)
  return parsed.map((entry) => {
    const candidate = entry as Partial<BattleChainAllowlistEntry>
    return { scenarioId: String(candidate.scenarioId ?? ''), reason: String(candidate.reason ?? '') }
  })
}

function validateAllowlist(allowlist: BattleChainAllowlistEntry[], scenarioIds: Set<string>): GuardFinding[] {
  const findings: GuardFinding[] = []
  const seen = new Set<string>()
  for (const entry of allowlist) {
    if (!entry.scenarioId.trim() || !entry.reason.trim()) {
      findings.push(finding('ALLOWLIST_CONFIG', 'Allowlist entries must include non-empty scenarioId and reason.', []))
    }
    if (seen.has(entry.scenarioId)) findings.push(finding('ALLOWLIST_CONFIG', `Duplicate allowlist scenarioId: ${entry.scenarioId}.`, []))
    if (entry.scenarioId && !scenarioIds.has(entry.scenarioId)) findings.push(finding('ALLOWLIST_CONFIG', `Unknown allowlist scenarioId: ${entry.scenarioId}.`, []))
    seen.add(entry.scenarioId)
  }
  return findings
}

export function runBattleChainGuard(input: RunInput = {}): RunOutput {
  const scenarios = generateGuardScenarios()
  const scenarioIds = new Set(scenarios.map((scenario) => scenario.id))
  const allowlist = loadAllowlist(input.allowlistPath)
  const selected = input.scenarioId ? scenarios.filter((scenario) => scenario.id === input.scenarioId) : scenarios
  const configFindings = validateAllowlist(allowlist, scenarioIds)
  if (input.scenarioId && selected.length === 0) {
    configFindings.push(finding('ALLOWLIST_CONFIG', `Unknown scenario id: ${input.scenarioId}.`, []))
  }

  const reports = selected.map((scenario) => {
    const start = performance.now()
    try {
      const result = simulateBattle(scenario.player, scenario.opponent, scenario.seed)
      return evaluateGuardScenario({ scenario, result, elapsedMs: Math.round(performance.now() - start), allowlist })
    } catch (error) {
      const elapsedMs = Math.round(performance.now() - start)
      return {
        scenario,
        elapsedMs,
        allowed: false,
        findings: [finding('SIMULATION_ERROR', error instanceof Error ? error.message : String(error), [])],
      } satisfies GuardScenarioReport
    }
  })

  return { reports, configFindings }
}

function formatScenario(report: GuardScenarioReport) {
  const playerItems = report.scenario.player.items.map((item) => item.defId).join(', ')
  const relics = report.scenario.player.relics?.map((entry) => entry.relicId).join(', ') || 'none'
  return [
    `Scenario: ${report.scenario.id}`,
    `Reproduce: npm run guard:chains -- --scenario ${report.scenario.id}`,
    `Dog: ${report.scenario.player.dogType}`,
    `Seed: ${report.scenario.seed}`,
    `Items: ${playerItems}`,
    `Relics: ${relics}`,
    `Elapsed: ${report.elapsedMs}ms`,
    report.allowReason ? `Allowlisted: ${report.allowReason}` : '',
    ...report.findings.map((entry) => [
      `Rule: ${entry.rule}`,
      `Message: ${entry.message}`,
      entry.actor ? `Actor/time: ${entry.actor} @ ${entry.time}` : '',
      entry.itemId ? `Item: ${entry.itemId}` : '',
      entry.count != null ? `Count: ${entry.count}` : '',
      `Last events: ${entry.lastEvents.map((event) => `${event.time}:${event.actor}:${event.itemId ?? '-'}:${event.safetyCode ?? event.kind}`).join(' | ')}`,
    ].filter(Boolean).join('\n')),
  ].filter(Boolean).join('\n')
}

function parseArgs(argv: string[]) {
  const scenarioIndex = argv.indexOf('--scenario')
  return { scenarioId: scenarioIndex >= 0 ? argv[scenarioIndex + 1] : undefined }
}

export function main(argv = process.argv.slice(2)) {
  const { scenarioId } = parseArgs(argv)
  const { reports, configFindings } = runBattleChainGuard({ scenarioId })
  const failedReports = reports.filter((report) => !report.allowed)

  if (configFindings.length > 0 || failedReports.length > 0) {
    console.error('[battle-chain-guard] FAILED')
    for (const entry of configFindings) console.error(`${entry.rule}: ${entry.message}`)
    for (const report of failedReports) console.error(`\n${formatScenario(report)}`)
    process.exitCode = 1
    return
  }

  const allowedFindings = reports.filter((report) => report.findings.length > 0)
  console.log(`[battle-chain-guard] scanned ${reports.length} scenarios; no unapproved chain risks found.`)
  if (allowedFindings.length > 0) {
    console.log(`[battle-chain-guard] ${allowedFindings.length} allowlisted scenario(s) contained findings.`)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
