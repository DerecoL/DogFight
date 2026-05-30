import { prisma } from '../src/server/db'
import { itemDef } from '../src/server/game/data'
import { buildOfflineFighter } from '../src/server/game/offline-builder'
import { simulateBattle } from '../src/server/game/battle'
import type { BattleResult, DogType, FighterSnapshot, GameItem, RelicInstance } from '../src/server/game/types'

const DOG_TYPES = ['SHIBA', 'SAMOYED', 'MUTT', 'BULLY', 'EMPEROR', 'FROG'] as const satisfies readonly DogType[]
const BASELINE_PHASES = ['early', 'mid', 'late'] as const
const DEFAULT_MIN_SAMPLES = 30
const BOT_MATRIX_SAMPLES = 5
const BASELINE_MATRIX_SEEDS = 3

type BaselinePhase = typeof BASELINE_PHASES[number]
type BalanceSource = 'BATTLE_LOG' | 'DOGFIGHT' | 'BASELINE' | 'OFFLINE_BOT'
type BalanceMode = 'CASUAL' | 'LADDER' | 'DOGFIGHT' | 'BASELINE' | 'OFFLINE_BOT' | 'UNKNOWN'
type SampleStatus = 'ok' | 'insufficient-sample'
type ArchetypeTag = 'frequency' | 'poison' | 'shieldThorns' | 'reservoir' | 'lucky' | 'largeItem'

type BattleLogRecord = {
  id: string
  result: string
  log: string
  run?: {
    mode?: string | null
    dogType?: string | null
    round?: number | null
    wins?: number | null
    losses?: number | null
  } | null
}

type DogfightBattleRecord = {
  id: string
  round: number
  opponentKind: string
  winnerSide: string
  result: string
}

export type BalanceBattleSample = {
  source: BalanceSource
  sourceId: string
  mode: BalanceMode
  round: number
  playerDog: DogType
  opponentDog: DogType
  winner: 'player' | 'opponent'
  winnerDog: DogType
  duration: number
  playerHp: number
  opponentHp: number
  playerMaxHp: number
  opponentMaxHp: number
  playerItemCount: number
  opponentItemCount: number
  playerRelicCount: number
  opponentRelicCount: number
  playerTags: ArchetypeTag[]
  opponentTags: ArchetypeTag[]
}

type MutableDogStats = {
  battles: number
  wins: number
}

export type DogStats = {
  battles: number
  wins: number
  losses: number
  winRate: number | null
}

export type BalanceReport = {
  generatedAt: string
  realData: {
    sampleStatus: SampleStatus
    totalBattles: number
    minSamples: number
    overallByDog: Record<DogType, DogStats>
    byRoundBand: Record<string, Record<DogType, DogStats>>
    byMode: Record<string, Record<DogType, DogStats>>
    matchups: Record<DogType, Record<DogType, DogStats>>
    timing: {
      averageDuration: number | null
      after60sBattles: number
      after60sRate: number | null
      maxDurationBattles: number
      maxDurationRate: number | null
    }
    archetypeTagRates: Record<ArchetypeTag, { appearances: number; totalSides: number; rate: number | null }>
  }
  baselineMatrix: MatrixReport
  offlineBotMatrix: MatrixReport
}

type MatrixReport = {
  source: 'BASELINE' | 'OFFLINE_BOT'
  totalBattles: number
  overallByDog: Record<DogType, DogStats>
  matchups: Record<DogType, Record<DogType, DogStats>>
}

function gameItem(id: string, defId: string, quality: GameItem['quality'], x: number): GameItem {
  return { id, defId, quality, area: 'EQUIPMENT', x, y: 0 }
}

function relic(id: string, relicId: string, slot: number): RelicInstance {
  return { id, relicId, quality: 'SILVER', slot }
}

function fighterSnapshot(dogType: DogType, phase: BaselinePhase, round: number, items: GameItem[], relics: RelicInstance[] = []): FighterSnapshot {
  return {
    name: `${dogType}-${phase}`,
    dogType,
    luckyNumber: dogType === 'EMPEROR' ? 3 : null,
    wins: phase === 'late' ? 7 : phase === 'mid' ? 4 : 1,
    losses: phase === 'late' ? 2 : phase === 'mid' ? 1 : 0,
    round,
    items,
    relics,
  }
}

export const baselineFighters: Record<DogType, Record<BaselinePhase, FighterSnapshot>> = {
  SHIBA: {
    early: fighterSnapshot('SHIBA', 'early', 3, [
      gameItem('shiba-e-1', 'shiba-speed-katana', 'GOLD', 0),
      gameItem('shiba-e-2', 'small-bite', 'BRONZE', 1),
      gameItem('shiba-e-3', 'v3-flea-disc', 'BRONZE', 2),
      gameItem('shiba-e-4', 'starter-2', 'BRONZE', 3),
    ]),
    mid: fighterSnapshot('SHIBA', 'mid', 6, [
      gameItem('shiba-m-1', 'shiba-speed-katana', 'GOLD', 0),
      gameItem('shiba-m-2', 'shiba-swallow-katana', 'GOLD', 1),
      gameItem('shiba-m-3', 'v4-growing-chew-sword', 'SILVER', 2),
      gameItem('shiba-m-4', 'v3-cone-collar', 'SILVER', 4),
      gameItem('shiba-m-5', 'v3-broken-canine', 'SILVER', 5),
    ], [relic('shiba-m-r1', 'midas-right', 0)]),
    late: fighterSnapshot('SHIBA', 'late', 9, [
      gameItem('shiba-l-1', 'shiba-shadow-clone', 'DIAMOND', 0),
      gameItem('shiba-l-2', 'shiba-speed-katana', 'GOLD', 1),
      gameItem('shiba-l-3', 'v4-growing-chew-sword', 'GOLD', 2),
      gameItem('shiba-l-4', 'v3-flea-disc', 'GOLD', 4),
      gameItem('shiba-l-5', 'v4-boom-counter', 'GOLD', 5),
      gameItem('shiba-l-6', 'small-bite', 'GOLD', 7),
    ], [relic('shiba-l-r1', 'midas-right', 0), relic('shiba-l-r2', 'half-die-right', 1)]),
  },
  SAMOYED: {
    early: fighterSnapshot('SAMOYED', 'early', 3, [
      gameItem('sam-e-1', 'samoyed-soft-fur', 'GOLD', 0),
      gameItem('sam-e-2', 'spiked-collar', 'BRONZE', 2),
      gameItem('sam-e-3', 'v3-spiked-vest', 'BRONZE', 4),
      gameItem('sam-e-4', 'starter-5', 'BRONZE', 6),
    ]),
    mid: fighterSnapshot('SAMOYED', 'mid', 6, [
      gameItem('sam-m-1', 'samoyed-soft-fur', 'GOLD', 0),
      gameItem('sam-m-2', 'samoyed-absolute-zero', 'DIAMOND', 2),
      gameItem('sam-m-3', 'v3-hydrant-axe', 'SILVER', 4),
      gameItem('sam-m-4', 'v3-spiked-vest', 'SILVER', 7),
      gameItem('sam-m-5', 'spiked-collar', 'SILVER', 9),
    ], [relic('sam-m-r1', 'midas-left', 0)]),
    late: fighterSnapshot('SAMOYED', 'late', 9, [
      gameItem('sam-l-1', 'samoyed-absolute-zero', 'DIAMOND', 0),
      gameItem('sam-l-2', 'samoyed-avalanche-core', 'DIAMOND', 2),
      gameItem('sam-l-3', 'v3-hydrant-axe', 'GOLD', 5),
      gameItem('sam-l-4', 'v3-golden-kennel', 'DIAMOND', 8),
    ], [relic('sam-l-r1', 'midas-left', 0), relic('sam-l-r2', 'v3-fluffed-spike-collar', 1)]),
  },
  MUTT: {
    early: fighterSnapshot('MUTT', 'early', 3, [
      gameItem('mutt-e-1', 'mutt-counting-collar', 'GOLD', 0),
      gameItem('mutt-e-2', 'training-disc', 'BRONZE', 2),
      gameItem('mutt-e-3', 'rubber-ball', 'BRONZE', 4),
      gameItem('mutt-e-4', 'starter-6', 'BRONZE', 6),
    ]),
    mid: fighterSnapshot('MUTT', 'mid', 6, [
      gameItem('mutt-m-1', 'mutt-counting-collar', 'GOLD', 0),
      gameItem('mutt-m-2', 'mutt-charged-collar', 'GOLD', 2),
      gameItem('mutt-m-3', 'training-disc', 'SILVER', 3),
      gameItem('mutt-m-4', 'lotus-sea', 'GOLD', 5),
      gameItem('mutt-m-5', 'kyushu-bracer', 'GOLD', 7),
    ], [relic('mutt-m-r1', 'midas-right', 0)]),
    late: fighterSnapshot('MUTT', 'late', 9, [
      gameItem('mutt-l-1', 'mutt-chase-car', 'DIAMOND', 0),
      gameItem('mutt-l-2', 'mutt-counting-collar', 'GOLD', 1),
      gameItem('mutt-l-3', 'training-disc', 'GOLD', 3),
      gameItem('mutt-l-4', 'lotus-sea', 'DIAMOND', 5),
      gameItem('mutt-l-5', 'kyushu-bracer', 'GOLD', 7),
      gameItem('mutt-l-6', 'v4-boom-counter', 'GOLD', 9),
    ], [relic('mutt-l-r1', 'midas-left', 0), relic('mutt-l-r2', 'midas-right', 1)]),
  },
  BULLY: {
    early: fighterSnapshot('BULLY', 'early', 3, [
      gameItem('bully-e-1', 'bully-gym', 'GOLD', 0),
      gameItem('bully-e-2', 'giant-bone', 'BRONZE', 3),
      gameItem('bully-e-3', 'starter-5', 'BRONZE', 7),
      gameItem('bully-e-4', 'starter-6', 'BRONZE', 8),
    ]),
    mid: fighterSnapshot('BULLY', 'mid', 6, [
      gameItem('bully-m-1', 'bully-gym', 'GOLD', 0),
      gameItem('bully-m-2', 'bully-armband', 'GOLD', 3),
      gameItem('bully-m-3', 'giant-bone', 'SILVER', 4),
      gameItem('bully-m-4', 'v3-dinosaur-leg-bone', 'SILVER', 8),
    ], [relic('bully-m-r1', 'midas-left', 0)]),
    late: fighterSnapshot('BULLY', 'late', 9, [
      gameItem('bully-l-1', 'bully-sacrifice', 'DIAMOND', 0),
      gameItem('bully-l-2', 'bully-gym', 'GOLD', 4),
      gameItem('bully-l-3', 'v3-dinosaur-leg-bone', 'GOLD', 7),
      gameItem('bully-l-4', 'lucky-paw', 'GOLD', 11),
    ], [relic('bully-l-r1', 'midas-left', 0), relic('bully-l-r2', 'half-die-left', 1)]),
  },
  EMPEROR: {
    early: fighterSnapshot('EMPEROR', 'early', 3, [
      gameItem('emp-e-1', 'emperor-dice-cup', 'GOLD', 0),
      gameItem('emp-e-2', 'lucky-paw', 'BRONZE', 1),
      gameItem('emp-e-3', 'v3-cone-collar', 'BRONZE', 2),
      gameItem('emp-e-4', 'starter-3', 'BRONZE', 3),
    ]),
    mid: fighterSnapshot('EMPEROR', 'mid', 6, [
      gameItem('emp-m-1', 'emperor-dice-cup', 'GOLD', 0),
      gameItem('emp-m-2', 'emperor-curtain', 'DIAMOND', 1),
      gameItem('emp-m-3', 'lucky-paw', 'SILVER', 3),
      gameItem('emp-m-4', 'v3-wooden-shield', 'SILVER', 4),
      gameItem('emp-m-5', 'v3-fermented-trash-bin', 'GOLD', 6),
    ], [relic('emp-m-r1', 'midas-right', 0)]),
    late: fighterSnapshot('EMPEROR', 'late', 9, [
      gameItem('emp-l-1', 'emperor-fallen', 'DIAMOND', 0),
      gameItem('emp-l-2', 'emperor-dice-cup', 'GOLD', 1),
      gameItem('emp-l-3', 'emperor-curtain', 'DIAMOND', 2),
      gameItem('emp-l-4', 'v3-fermented-trash-bin', 'DIAMOND', 4),
      gameItem('emp-l-5', 'v3-wooden-shield', 'GOLD', 8),
    ], [relic('emp-l-r1', 'midas-left', 0), relic('emp-l-r2', 'midas-right', 1)]),
  },
  FROG: {
    early: fighterSnapshot('FROG', 'early', 3, [
      gameItem('frog-e-1', 'frog-croak-drum', 'GOLD', 0),
      gameItem('frog-e-2', 'v3-large-bone-sword', 'BRONZE', 1),
      gameItem('frog-e-3', 'small-bite', 'BRONZE', 3),
      gameItem('frog-e-4', 'v3-cone-collar', 'BRONZE', 4),
    ]),
    mid: fighterSnapshot('FROG', 'mid', 6, [
      gameItem('frog-m-1', 'frog-croak-drum', 'GOLD', 0),
      gameItem('frog-m-2', 'frog-rainy-season', 'DIAMOND', 1),
      gameItem('frog-m-3', 'v4-growing-chew-sword', 'SILVER', 3),
      gameItem('frog-m-4', 'v3-auto-waterer', 'SILVER', 5),
      gameItem('frog-m-5', 'v3-large-bone-sword', 'SILVER', 9),
    ], [relic('frog-m-r1', 'carrot', 0)]),
    late: fighterSnapshot('FROG', 'late', 9, [
      gameItem('frog-l-1', 'frog-full-pond-gate', 'DIAMOND', 0),
      gameItem('frog-l-2', 'frog-rainy-season', 'DIAMOND', 2),
      gameItem('frog-l-3', 'frog-croak-drum', 'GOLD', 4),
      gameItem('frog-l-4', 'v4-growing-chew-sword', 'GOLD', 5),
      gameItem('frog-l-5', 'v3-auto-waterer', 'GOLD', 7),
    ], [relic('frog-l-r1', 'carrot', 0), relic('frog-l-r2', 'midas-right', 1)]),
  },
}

function parseBattleResult(value: string): BattleResult | null {
  try {
    const parsed = JSON.parse(value) as Partial<BattleResult>
    if ((parsed.winner === 'player' || parsed.winner === 'opponent') && parsed.playerSnapshot && parsed.opponentSnapshot) {
      return parsed as BattleResult
    }
  } catch {
    return null
  }
  return null
}

function normalizeMode(value?: string | null): BalanceMode {
  if (value === 'CASUAL' || value === 'LADDER' || value === 'DOGFIGHT') return value
  return 'UNKNOWN'
}

function normalizeDog(value?: string | null): DogType | null {
  return DOG_TYPES.includes(value as DogType) ? value as DogType : null
}

function roundBand(round: number) {
  if (round <= 3) return 'early'
  if (round <= 6) return 'mid'
  return 'late'
}

function unique<T>(items: T[]) {
  return [...new Set(items)]
}

function tagsForFighter(fighter: FighterSnapshot): ArchetypeTag[] {
  const tags = new Set<ArchetypeTag>()
  if (fighter.dogType === 'SHIBA' || fighter.dogType === 'MUTT') tags.add('frequency')
  if (fighter.dogType === 'FROG') tags.add('reservoir')
  if (fighter.dogType === 'EMPEROR') tags.add('lucky')
  if (fighter.dogType === 'BULLY') tags.add('largeItem')
  for (const item of fighter.items) {
    const def = itemDef(item.defId)
    if (def.multi || def.tags.some((tag) => ['multi', 'trigger', 'extra-roll', 'attack-speed'].includes(tag))) tags.add('frequency')
    if (def.tags.includes('poison')) tags.add('poison')
    if (def.tags.some((tag) => ['shield', 'thorn', 'immune'].includes(tag))) tags.add('shieldThorns')
    if (def.tags.includes('reservoir')) tags.add('reservoir')
    if (def.tags.includes('lucky')) tags.add('lucky')
    if (def.tags.includes('large') || def.size === 4) tags.add('largeItem')
  }
  return [...tags]
}

function sampleFromResult(input: {
  source: BalanceSource
  sourceId: string
  mode: BalanceMode
  round?: number | null
  result: BattleResult
}): BalanceBattleSample | null {
  const playerDog = normalizeDog(input.result.playerSnapshot.dogType)
  const opponentDog = normalizeDog(input.result.opponentSnapshot.dogType)
  if (!playerDog || !opponentDog) return null
  const round = input.result.playerSnapshot.round ?? input.round ?? 0
  const winnerDog = input.result.winner === 'player' ? playerDog : opponentDog
  return {
    source: input.source,
    sourceId: input.sourceId,
    mode: input.mode,
    round,
    playerDog,
    opponentDog,
    winner: input.result.winner,
    winnerDog,
    duration: input.result.duration,
    playerHp: input.result.playerHp,
    opponentHp: input.result.opponentHp,
    playerMaxHp: input.result.playerMaxHp,
    opponentMaxHp: input.result.opponentMaxHp,
    playerItemCount: input.result.playerSnapshot.items.length,
    opponentItemCount: input.result.opponentSnapshot.items.length,
    playerRelicCount: input.result.playerSnapshot.relics?.length ?? 0,
    opponentRelicCount: input.result.opponentSnapshot.relics?.length ?? 0,
    playerTags: tagsForFighter(input.result.playerSnapshot),
    opponentTags: tagsForFighter(input.result.opponentSnapshot),
  }
}

export function extractBattleLogSample(record: BattleLogRecord): BalanceBattleSample | null {
  const result = parseBattleResult(record.log)
  if (!result) return null
  return sampleFromResult({
    source: 'BATTLE_LOG',
    sourceId: record.id,
    mode: normalizeMode(record.run?.mode),
    round: record.run?.round,
    result,
  })
}

export function extractDogfightBattleSample(record: DogfightBattleRecord): BalanceBattleSample | null {
  const result = parseBattleResult(record.result)
  if (!result) return null
  return sampleFromResult({
    source: 'DOGFIGHT',
    sourceId: record.id,
    mode: 'DOGFIGHT',
    round: record.round,
    result,
  })
}

function emptyMutableDogStats(): Record<DogType, MutableDogStats> {
  return Object.fromEntries(DOG_TYPES.map((dogType) => [dogType, { battles: 0, wins: 0 }])) as Record<DogType, MutableDogStats>
}

function emptyMutableMatchups(): Record<DogType, Record<DogType, MutableDogStats>> {
  return Object.fromEntries(DOG_TYPES.map((dogType) => [dogType, emptyMutableDogStats()])) as Record<DogType, Record<DogType, MutableDogStats>>
}

function addSide(stats: MutableDogStats, won: boolean) {
  stats.battles += 1
  if (won) stats.wins += 1
}

function finalizeDogStats(stats: MutableDogStats, minSamples: number): DogStats {
  return {
    battles: stats.battles,
    wins: stats.wins,
    losses: stats.battles - stats.wins,
    winRate: stats.battles >= minSamples ? Number((stats.wins / stats.battles).toFixed(3)) : null,
  }
}

function finalizeDogRecord(stats: Record<DogType, MutableDogStats>, minSamples: number): Record<DogType, DogStats> {
  return Object.fromEntries(DOG_TYPES.map((dogType) => [dogType, finalizeDogStats(stats[dogType], minSamples)])) as Record<DogType, DogStats>
}

function finalizeMatchups(stats: Record<DogType, Record<DogType, MutableDogStats>>, minSamples: number) {
  return Object.fromEntries(DOG_TYPES.map((dogType) => [
    dogType,
    finalizeDogRecord(stats[dogType], minSamples),
  ])) as Record<DogType, Record<DogType, DogStats>>
}

function addSampleToStats(sample: BalanceBattleSample, overall: Record<DogType, MutableDogStats>, matchups: Record<DogType, Record<DogType, MutableDogStats>>) {
  addSide(overall[sample.playerDog], sample.winner === 'player')
  addSide(overall[sample.opponentDog], sample.winner === 'opponent')
  addSide(matchups[sample.playerDog][sample.opponentDog], sample.winner === 'player')
  addSide(matchups[sample.opponentDog][sample.playerDog], sample.winner === 'opponent')
}

function buildMatrixReport(source: 'BASELINE' | 'OFFLINE_BOT', samples: BalanceBattleSample[], minSamples = 1): MatrixReport {
  const overall = emptyMutableDogStats()
  const matchups = emptyMutableMatchups()
  for (const sample of samples) addSampleToStats(sample, overall, matchups)
  return {
    source,
    totalBattles: samples.length,
    overallByDog: finalizeDogRecord(overall, minSamples),
    matchups: finalizeMatchups(matchups, minSamples),
  }
}

function baselineSamples(): BalanceBattleSample[] {
  const samples: BalanceBattleSample[] = []
  for (const phase of BASELINE_PHASES) {
    for (const playerDog of DOG_TYPES) {
      for (const opponentDog of DOG_TYPES) {
        for (let index = 0; index < BASELINE_MATRIX_SEEDS; index += 1) {
          const result = simulateBattle(
            baselineFighters[playerDog][phase],
            baselineFighters[opponentDog][phase],
            `baseline-${phase}-${playerDog}-${opponentDog}-${index}`,
          )
          const sample = sampleFromResult({ source: 'BASELINE', sourceId: `baseline-${phase}-${playerDog}-${opponentDog}-${index}`, mode: 'BASELINE', result })
          if (sample) samples.push(sample)
        }
      }
    }
  }
  return samples
}

function offlineBotSamples(): BalanceBattleSample[] {
  const samples: BalanceBattleSample[] = []
  for (const round of [3, 6, 9]) {
    for (const playerDog of DOG_TYPES) {
      for (const opponentDog of DOG_TYPES) {
        for (let index = 0; index < BOT_MATRIX_SAMPLES; index += 1) {
          const result = simulateBattle(
            buildOfflineFighter({ dogType: playerDog, round, wins: Math.max(0, round - 2), losses: 0, seed: `bot-p-${round}-${playerDog}-${index}` }),
            buildOfflineFighter({ dogType: opponentDog, round, wins: Math.max(0, round - 2), losses: 0, seed: `bot-o-${round}-${opponentDog}-${index}` }),
            `bot-${round}-${playerDog}-${opponentDog}-${index}`,
          )
          const sample = sampleFromResult({ source: 'OFFLINE_BOT', sourceId: `bot-${round}-${playerDog}-${opponentDog}-${index}`, mode: 'OFFLINE_BOT', result })
          if (sample) samples.push(sample)
        }
      }
    }
  }
  return samples
}

export function buildBalanceReport(realSamples: Array<BalanceBattleSample | null>, options: { minSamples?: number; includeMatrices?: boolean } = {}): BalanceReport {
  const minSamples = options.minSamples ?? DEFAULT_MIN_SAMPLES
  const includeMatrices = options.includeMatrices ?? true
  const samples = realSamples.filter((sample): sample is BalanceBattleSample => Boolean(sample))
  const overall = emptyMutableDogStats()
  const matchups = emptyMutableMatchups()
  const byRoundBand = new Map<string, Record<DogType, MutableDogStats>>()
  const byMode = new Map<string, Record<DogType, MutableDogStats>>()
  const tagAppearances = new Map<ArchetypeTag, number>()

  for (const sample of samples) {
    addSampleToStats(sample, overall, matchups)

    const band = roundBand(sample.round)
    byRoundBand.set(band, byRoundBand.get(band) ?? emptyMutableDogStats())
    addSide(byRoundBand.get(band)![sample.playerDog], sample.winner === 'player')
    addSide(byRoundBand.get(band)![sample.opponentDog], sample.winner === 'opponent')

    byMode.set(sample.mode, byMode.get(sample.mode) ?? emptyMutableDogStats())
    addSide(byMode.get(sample.mode)![sample.playerDog], sample.winner === 'player')
    addSide(byMode.get(sample.mode)![sample.opponentDog], sample.winner === 'opponent')

    for (const tag of unique([...sample.playerTags, ...sample.opponentTags])) {
      tagAppearances.set(tag, (tagAppearances.get(tag) ?? 0) + 1)
    }
  }

  const totalSides = samples.length * 2
  const after60sBattles = samples.filter((sample) => sample.duration > 60).length
  const maxDurationBattles = samples.filter((sample) => sample.duration >= 120).length
  const averageDuration = samples.length > 0
    ? Number((samples.reduce((total, sample) => total + sample.duration, 0) / samples.length).toFixed(2))
    : null

  return {
    generatedAt: new Date().toISOString(),
    realData: {
      sampleStatus: samples.length >= minSamples ? 'ok' : 'insufficient-sample',
      totalBattles: samples.length,
      minSamples,
      overallByDog: finalizeDogRecord(overall, minSamples),
      byRoundBand: Object.fromEntries([...byRoundBand.entries()].map(([band, stats]) => [band, finalizeDogRecord(stats, minSamples)])),
      byMode: Object.fromEntries([...byMode.entries()].map(([mode, stats]) => [mode, finalizeDogRecord(stats, minSamples)])),
      matchups: finalizeMatchups(matchups, minSamples),
      timing: {
        averageDuration,
        after60sBattles,
        after60sRate: samples.length > 0 ? Number((after60sBattles / samples.length).toFixed(3)) : null,
        maxDurationBattles,
        maxDurationRate: samples.length > 0 ? Number((maxDurationBattles / samples.length).toFixed(3)) : null,
      },
      archetypeTagRates: Object.fromEntries((['frequency', 'poison', 'shieldThorns', 'reservoir', 'lucky', 'largeItem'] as const).map((tag) => {
        const appearances = tagAppearances.get(tag) ?? 0
        return [tag, { appearances, totalSides, rate: totalSides > 0 ? Number((appearances / totalSides).toFixed(3)) : null }]
      })) as Record<ArchetypeTag, { appearances: number; totalSides: number; rate: number | null }>,
    },
    baselineMatrix: includeMatrices ? buildMatrixReport('BASELINE', baselineSamples()) : buildMatrixReport('BASELINE', []),
    offlineBotMatrix: includeMatrices ? buildMatrixReport('OFFLINE_BOT', offlineBotSamples()) : buildMatrixReport('OFFLINE_BOT', []),
  }
}

async function loadRealSamples() {
  const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || ''
  if (!/^postgres(?:ql)?:\/\//.test(databaseUrl)) {
    console.error('No usable DATABASE_URL found; real-data section will be marked insufficient-sample.')
    return []
  }

  try {
    const [battleLogs, dogfightBattles] = await Promise.all([
      prisma.battleLog.findMany({
        include: { run: { select: { mode: true, dogType: true, round: true, wins: true, losses: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10_000,
      }),
      prisma.dogfightBattle.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10_000,
      }),
    ])
    return [
      ...battleLogs.map(extractBattleLogSample),
      ...dogfightBattles.map(extractDogfightBattleSample),
    ]
  } catch (error) {
    console.error(`Failed to load real battle data: ${error instanceof Error ? error.message : String(error)}`)
    return []
  }
}

function printDogStats(title: string, stats: Record<DogType, DogStats>) {
  console.log(`\n${title}`)
  for (const dogType of DOG_TYPES) {
    const row = stats[dogType]
    const rate = row.winRate == null ? 'insufficient-sample' : `${Math.round(row.winRate * 100)}%`
    console.log(`- ${dogType}: ${row.wins}/${row.battles} (${rate})`)
  }
}

function printTextReport(report: BalanceReport) {
  console.log(`# Balance report (${report.generatedAt})`)
  console.log(`Real samples: ${report.realData.totalBattles}; status: ${report.realData.sampleStatus}; minSamples: ${report.realData.minSamples}`)
  printDogStats('Real data overall by dog', report.realData.overallByDog)
  const averageDuration = report.realData.timing.averageDuration == null ? 'n/a' : `${report.realData.timing.averageDuration}s`
  console.log(`\nTiming: avg=${averageDuration}, >60s=${report.realData.timing.after60sBattles}, >=120s=${report.realData.timing.maxDurationBattles}`)
  console.log('\nArchetype tag rates')
  for (const [tag, row] of Object.entries(report.realData.archetypeTagRates)) {
    console.log(`- ${tag}: ${row.appearances}/${row.totalSides} (${row.rate == null ? 'n/a' : `${Math.round(row.rate * 100)}%`})`)
  }
  printDogStats('Manual baseline matrix overall by dog', report.baselineMatrix.overallByDog)
  printDogStats('Offline bot matrix overall by dog', report.offlineBotMatrix.overallByDog)
}

async function main() {
  const json = process.argv.includes('--json')
  const realSamples = await loadRealSamples()
  const report = buildBalanceReport(realSamples)
  if (json) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    printTextReport(report)
  }
  await prisma.$disconnect()
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('/scripts/balance-report.ts')) {
  main().catch(async (error: unknown) => {
    console.error(error)
    await prisma.$disconnect()
    process.exitCode = 1
  })
}
