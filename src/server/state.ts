import { randomUUID } from 'node:crypto'
import type { ItemInstance, LadderSettlement, Run } from '@prisma/client'
import {
  CLASS_REWARD_DEFS,
  POST_BATTLE_CARRIED_SELL_BONUS_AMOUNT,
  POST_BATTLE_EQUIPPED_SELL_BONUS_AMOUNT,
  RELIC_DEFS,
  itemDef,
  itemDefForQuality,
  relicDef,
  relicDefForQuality,
  shopPool,
} from './game/data'
import { createEnchantChoices } from './game/enchant'
import { buildOfflineFighter } from './game/offline-builder'
import { findSlot } from './game/grid'
import { explorationMapPublicState, normalizeExplorationMapState } from './game/map'
import { createPotionChoices, normalizeTriggerDiceWithExtras } from './game/potion'
import { nextQuality, normalizeQuality } from './game/quality'
import { createRng } from './game/rng'
import { createChoices, createShop } from './game/shop'
import type { BattleResult, DogType, Enchantment, EnchantmentChoice, FighterSnapshot, GameItem, ItemQuality, Phase, PotionChoice, RelicInstance, ShopOffer, ShopType } from './game/types'

type RunMode = 'CASUAL' | 'LADDER'

export function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export function parseOptionalJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback
  return parseJson(value, fallback)
}

export function toGameItems(items: ItemInstance[]): GameItem[] {
  return items.map((item) => ({
    id: item.id,
    defId: item.defId,
    quality: normalizeQuality(item.quality),
    area: item.area as GameItem['area'],
    x: item.x,
    y: item.y,
    enchant: parseOptionalJson<Enchantment | null>(item.enchant, null),
    triggerDiceOverride: normalizeOptionalTriggerDice((item as ItemInstance & { triggerDiceOverride?: string | null }).triggerDiceOverride),
    sellBonus: item.sellBonus,
  }))
}

function normalizeOptionalTriggerDice(value: string | null | undefined) {
  if (!value) return null
  const dice = normalizeTriggerDiceWithExtras(parseJson<number[]>(value, []))
  return dice.length > 0 ? dice : null
}

export function normalizeRelics(relics: RelicInstance[]): RelicInstance[] {
  return relics
    .filter((relic) => RELIC_DEFS.some((def) => def.id === relic.relicId))
    .map((relic, index) => ({
      id: relic.id,
      relicId: relic.relicId,
      quality: normalizeQuality(relic.quality),
      slot: Number.isInteger(relic.slot) ? relic.slot : index,
    }))
    .slice(0, 6)
}

export function relicsFromRun(run: Pick<Run, 'relics'>) {
  return normalizeRelics(parseJson<RelicInstance[]>(run.relics, []))
}

export function publicRelics(run: Pick<Run, 'relics'>) {
  return relicsFromRun(run).map((relic) => ({ ...relic, def: relicDefForQuality(relic.relicId, relic.quality) }))
}

function relicChoiceQuality(relics: RelicInstance[], relicId: string) {
  const existing = relics.find((relic) => relic.relicId === relicId)
  return existing ? nextQuality(existing.quality) ?? existing.quality : relicDef(relicId).defaultQuality
}

export function publicLadderSettlement(settlement: LadderSettlement | null | undefined) {
  if (!settlement) return null
  return {
    id: settlement.id,
    beforeTier: settlement.beforeTier,
    beforeScore: settlement.beforeScore,
    afterTier: settlement.afterTier,
    afterScore: settlement.afterScore,
    delta: settlement.delta,
    rawDelta: settlement.rawDelta,
    baseScore: settlement.baseScore,
    tierTax: settlement.tierTax,
    lossPenalty: settlement.lossPenalty,
    perfectBonus: settlement.perfectBonus,
    newbieProtection: settlement.newbieProtection,
    wins: settlement.wins,
    losses: settlement.losses,
    createdAt: settlement.createdAt.toISOString(),
  }
}

export function publicRun(run: Run & { items: ItemInstance[]; ladderSettlement?: LadderSettlement | null }) {
  const mapState = normalizeExplorationMapState(parseOptionalJson((run as Run & { mapState?: string | null }).mapState, null))
  return {
    id: run.id,
    mode: (run.mode === 'LADDER' ? 'LADDER' : 'CASUAL') as RunMode,
    dogType: run.dogType as DogType,
    luckyNumber: run.luckyNumber,
    wins: run.wins,
    losses: run.losses,
    round: run.round,
    gold: run.gold,
    phase: run.phase as Phase,
    status: run.status,
    shopType: run.shopType as ShopType,
    shopItems: parseJson<ShopOffer[]>(run.shopItems, []).map((offer) => {
      const quality = normalizeQuality(offer.quality)
      return { ...offer, quality, def: itemDefForQuality(offer.defId, quality) }
    }),
    choices: parseJson<ShopType[]>(run.choices, []),
    enchantChoices: parseJson<EnchantmentChoice[]>(run.enchantChoices, []),
    potionChoices: parseOptionalJson<PotionChoice[]>((run as Run & { potionChoices?: string }).potionChoices, []),
    classRewardChoices: parseJson<string[]>(run.classRewardChoices, []).map((defId) => {
      const quality = normalizeQuality(itemDef(defId).defaultQuality)
      return { defId, def: itemDefForQuality(defId, quality), quality }
    }),
    relicChoices: parseJson<string[]>(run.relicChoices, []).map((relicId) => {
      const quality = relicChoiceQuality(relicsFromRun(run), relicId)
      return { relicId, def: relicDefForQuality(relicId, quality), quality }
    }),
    relics: publicRelics(run),
    refreshCost: run.refreshCost,
    matchedGhost: run.matchedGhost ? parseJson(run.matchedGhost, null) : null,
    lastBattle: run.lastBattle ? parseJson(run.lastBattle, null) : null,
    ladderSettlement: publicLadderSettlement(run.ladderSettlement),
    mapState: mapState ? explorationMapPublicState(mapState) : null,
    items: toGameItems(run.items).map((item) => ({ ...item, def: itemDefForQuality(item.defId, item.quality) })),
  }
}

type RunHistoryItemSource = Pick<ItemInstance, 'id' | 'runId' | 'defId' | 'quality' | 'area' | 'x' | 'y'> & { enchant?: string | null; triggerDiceOverride?: string | null; sellBonus?: number }
type RunHistorySource = Pick<Run, 'id' | 'mode' | 'dogType' | 'luckyNumber' | 'wins' | 'losses' | 'round' | 'status' | 'phase' | 'createdAt' | 'updatedAt'> & {
  relics?: string
  items?: RunHistoryItemSource[]
}

export type PublicRunHistoryEntry = {
  id: string
  mode: RunMode
  dogType: DogType
  luckyNumber: number | null
  wins: number
  losses: number
  round: number
  status: string
  phase: Phase
  items: Array<GameItem & { def: ReturnType<typeof itemDefForQuality> }>
  relics: ReturnType<typeof publicRelics>
  createdAt: string
  updatedAt: string
}

export type PublicRunHistory = {
  totalRuns: number
  activeRuns: number
  completedRuns: number
  abandonedRuns: number
  totalWins: number
  totalLosses: number
  bestRun: PublicRunHistoryEntry | null
  recentRuns: PublicRunHistoryEntry[]
}

function toHistoryEntry(run: RunHistorySource): PublicRunHistoryEntry {
  return {
    id: run.id,
    mode: run.mode === 'LADDER' ? 'LADDER' : 'CASUAL',
    dogType: run.dogType as DogType,
    luckyNumber: run.luckyNumber,
    wins: run.wins,
    losses: run.losses,
    round: run.round,
    status: run.status,
    phase: run.phase as Phase,
    items: (run.items ?? [])
      .map((item) => ({ id: item.id, defId: item.defId, quality: normalizeQuality(item.quality), area: item.area as GameItem['area'], x: item.x, y: item.y, enchant: parseOptionalJson<Enchantment | null>(item.enchant, null), triggerDiceOverride: normalizeOptionalTriggerDice(item.triggerDiceOverride), sellBonus: item.sellBonus ?? 0 }))
      .map((item) => ({ ...item, def: itemDefForQuality(item.defId, item.quality) })),
    relics: publicRelics({ relics: run.relics ?? '[]' }),
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
  }
}

export function publicRunHistory(runs: RunHistorySource[]): PublicRunHistory {
  const bestRun = runs.length > 0
    ? [...runs].sort((a, b) =>
      b.wins - a.wins
      || a.losses - b.losses
      || b.round - a.round
      || b.updatedAt.getTime() - a.updatedAt.getTime(),
    )[0]
    : null

  return {
    totalRuns: runs.length,
    activeRuns: runs.filter((run) => run.status === 'ACTIVE').length,
    completedRuns: runs.filter((run) => run.status === 'COMPLETE').length,
    abandonedRuns: runs.filter((run) => run.status === 'ABANDONED').length,
    totalWins: runs.reduce((sum, run) => sum + run.wins, 0),
    totalLosses: runs.reduce((sum, run) => sum + run.losses, 0),
    bestRun: bestRun ? toHistoryEntry(bestRun) : null,
    recentRuns: runs.map(toHistoryEntry),
  }
}

export function initialItems() {
  return [1, 2, 3, 4, 5, 6].map((n, index) => ({
    id: randomUUID(),
    defId: `starter-${n}`,
    quality: 'BRONZE' as const,
    area: 'EQUIPMENT',
    x: index,
    y: 0,
  }))
}

export function classRewardChoices(dogType: DogType, round: number) {
  return CLASS_REWARD_DEFS
    .filter((item) => item.classDog === dogType && item.unlockRound === round)
    .map((item) => item.id)
}

export function createRelicChoices(currentRelics: RelicInstance[], rng: () => number) {
  const normalized = normalizeRelics(currentRelics)
  const hasOpenSlot = normalized.length < 6
  const currentById = new Map(normalized.map((relic) => [relic.relicId, relic]))
  const pool = RELIC_DEFS.filter((relic) => {
    const owned = currentById.get(relic.id)
    if (owned?.quality === 'DIAMOND') return false
    return hasOpenSlot || Boolean(owned)
  })
  const choices: string[] = []
  while (choices.length < 3 && choices.length < pool.length) {
    const next = pool[Math.floor(rng() * pool.length)]
    if (!choices.includes(next.id)) choices.push(next.id)
  }
  return choices
}

export function applyRelicChoice(currentRelics: RelicInstance[], relicId: string) {
  const relicDefn = relicDef(relicId)
  const relics = normalizeRelics(currentRelics)
  const existing = relics.find((relic) => relic.relicId === relicId)
  if (existing) {
    const next: Record<ItemQuality, ItemQuality | null> = { BRONZE: 'SILVER', SILVER: 'GOLD', GOLD: 'DIAMOND', DIAMOND: null }
    const quality = next[existing.quality]
    if (!quality) return relics
    return relics.map((relic) => relic.id === existing.id ? { ...relic, quality } : relic)
  }
  if (relics.length >= 6) return relics
  return [...relics, { id: randomUUID(), relicId, quality: relicDefn.defaultQuality, slot: relics.length }]
}

export function removeRelicByInstanceId(currentRelics: RelicInstance[], relicInstanceId: string) {
  const relics = normalizeRelics(currentRelics)
  if (!relics.some((relic) => relic.id === relicInstanceId)) return null
  return relics
    .filter((relic) => relic.id !== relicInstanceId)
    .map((relic, index) => ({ ...relic, slot: index }))
}

export function makeShop(type: ShopType, seed: string, round = 0) {
  return createShop(type, createRng(seed), round)
}

export function makeNewRunShop(userId: string, nonce: string = randomUUID()) {
  return makeShop('GENERAL', `${userId}-new-shop-${nonce}`, 0)
}

type QualityBearingItem = { quality?: string | null }

export function makeChoices<T extends QualityBearingItem>(seed: string, round = 0, items: readonly T[] = []) {
  return createChoices(createRng(seed), round, items)
}

export function upgradeChoiceSkipPhase(run: { mapState?: string | null }): 'MAP' | 'PREP' {
  const mapState = normalizeExplorationMapState(parseOptionalJson(run.mapState, null))
  return mapState?.currentNodeId ? 'MAP' : 'PREP'
}

export function makeRelicChoices(run: Pick<Run, 'relics'>, seed: string) {
  return createRelicChoices(relicsFromRun(run), createRng(seed))
}

export function makePotionChoices(seed: string) {
  return createPotionChoices(seed)
}

function shouldCreateEnchantChoices(run: Pick<Run, 'losses' | 'enchantThirdLossGranted'>, nextRound: number, seed: string) {
  if (run.losses >= 3 && !run.enchantThirdLossGranted) return { trigger: true, thirdLossGranted: true }
  if (nextRound >= 4 && createRng(`${seed}-enchant-roll`)() < 0.1) return { trigger: true, thirdLossGranted: false }
  return { trigger: false, thirdLossGranted: false }
}

type NextPhaseRun = Pick<Run, 'id' | 'dogType' | 'losses' | 'enchantThirdLossGranted'> & { items?: readonly QualityBearingItem[] }
type NextPhaseData = {
  phase: Phase
  classRewardChoices: string
  choices: string
  shopItems: string
  shopType?: ShopType
  enchantChoices: string
  enchantThirdLossGranted?: boolean
}

export function nextPhaseData(run: NextPhaseRun, nextRound: number, seed = `${run.id}-round-${nextRound}`): NextPhaseData {
  const nextClassRewards = classRewardChoices(run.dogType as DogType, nextRound)
  const enchant = shouldCreateEnchantChoices(run, nextRound, seed)
  const enchantChoices = enchant.trigger
    ? JSON.stringify(createEnchantChoices(`${seed}-enchant-${nextRound}`, nextRound))
    : '[]'
  const enchantData = enchant.trigger
    ? {
      enchantChoices,
      ...(enchant.thirdLossGranted ? { enchantThirdLossGranted: true } : {}),
    }
    : { enchantChoices: '[]' }

  if (nextClassRewards.length > 0) {
    return {
      phase: 'CLASS_REWARD',
      classRewardChoices: JSON.stringify(nextClassRewards),
      choices: '[]',
      shopItems: '[]',
      ...enchantData,
    }
  }
  if (enchant.trigger) {
    return {
      phase: 'ENCHANT_CHOICE',
      classRewardChoices: '[]',
      choices: '[]',
      shopItems: '[]',
      ...enchantData,
    }
  }
  if (nextRound <= 2) {
    return {
      phase: 'SHOP',
      shopType: 'GENERAL',
      shopItems: JSON.stringify(makeShop('GENERAL', `${run.id}-round-${nextRound}`, nextRound)),
      choices: '[]',
      classRewardChoices: '[]',
      enchantChoices: '[]',
    }
  }
  return {
    phase: 'CHOICE',
    choices: JSON.stringify(makeChoices(`${run.id}-choices-${nextRound}`, nextRound, run.items ?? [])),
    shopItems: '[]',
    classRewardChoices: '[]',
    enchantChoices: '[]',
  }
}

export function phaseDataAfterEnchant(run: Pick<Run, 'id' | 'round'> & { items?: readonly QualityBearingItem[] }) {
  if (run.round <= 2) {
    return {
      phase: 'SHOP',
      shopType: 'GENERAL',
      shopItems: JSON.stringify(makeShop('GENERAL', `${run.id}-post-enchant-${run.round}`, run.round)),
      choices: '[]',
      enchantChoices: '[]',
    }
  }
  return {
    phase: 'CHOICE',
    choices: JSON.stringify(makeChoices(`${run.id}-post-enchant-${run.round}`, run.round, run.items ?? [])),
    shopItems: '[]',
    enchantChoices: '[]',
  }
}

export function snapshotFromRun(run: Run & { items: ItemInstance[] }, name = '玩家'): FighterSnapshot {
  return {
    name,
    dogType: run.dogType as DogType,
    luckyNumber: run.luckyNumber,
    wins: run.wins,
    losses: run.losses,
    round: run.round,
    items: toGameItems(run.items),
    relics: relicsFromRun(run),
  }
}

export function postBattleLargeItemReward(items: GameItem[], seed: string) {
  const hasVault = items.some((item) => item.area === 'EQUIPMENT' && itemDef(item.defId).advancedEffect === 'POST_BATTLE_LARGE_ITEM')
  if (!hasVault) return null

  const pool = shopPool('LARGE')
  const rng = createRng(seed)
  const def = pool[Math.floor(rng() * pool.length)]
  const slot = findSlot(items, def.id, 'BAG')
  if (!slot) return null

  return {
    defId: def.id,
    quality: normalizeQuality(def.defaultQuality),
    area: 'BAG' as const,
    x: slot.x,
    y: slot.y,
  }
}

export function postBattleSellBonusItemGrowths(items: GameItem[]) {
  return items
    .flatMap((item) => {
      const effect = itemDef(item.defId).advancedEffect
      if (effect === 'POST_BATTLE_EQUIPPED_SELL_BONUS' && item.area === 'EQUIPMENT') {
        return [{ id: item.id, increment: POST_BATTLE_EQUIPPED_SELL_BONUS_AMOUNT }]
      }
      if (effect === 'POST_BATTLE_CARRIED_SELL_BONUS' && (item.area === 'EQUIPMENT' || item.area === 'BAG')) {
        return [{ id: item.id, increment: POST_BATTLE_CARRIED_SELL_BONUS_AMOUNT }]
      }
      return []
    })
}

export function createFinishedBattleRecord(result: BattleResult, wins: number, losses: number): BattleResult {
  return {
    ...result,
    playerSnapshot: {
      ...result.playerSnapshot,
      wins,
      losses,
    },
  }
}

export function seedGhost(round: number, wins: number, losses: number, seed?: string): FighterSnapshot {
  return buildOfflineFighter({ round, wins, losses, seed })
}
