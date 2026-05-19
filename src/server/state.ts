import { randomUUID } from 'node:crypto'
import type { ItemInstance, Run } from '@prisma/client'
import { CLASS_REWARD_DEFS, RELIC_DEFS, itemDef, itemDefForQuality, relicDef, relicDefForQuality, shopPool } from './game/data'
import { buildOfflineFighter } from './game/offline-builder'
import { findSlot } from './game/grid'
import { nextQuality, normalizeQuality } from './game/quality'
import { createRng } from './game/rng'
import { createChoices, createShop } from './game/shop'
import type { BattleResult, DogType, FighterSnapshot, GameItem, ItemQuality, Phase, RelicInstance, ShopOffer, ShopType } from './game/types'

export function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export function toGameItems(items: ItemInstance[]): GameItem[] {
  return items.map((item) => ({ id: item.id, defId: item.defId, quality: normalizeQuality(item.quality), area: item.area as GameItem['area'], x: item.x, y: item.y }))
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

export function publicRun(run: Run & { items: ItemInstance[] }) {
  return {
    id: run.id,
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
    items: toGameItems(run.items).map((item) => ({ ...item, def: itemDefForQuality(item.defId, item.quality) })),
  }
}

type RunHistoryItemSource = Pick<ItemInstance, 'id' | 'runId' | 'defId' | 'quality' | 'area' | 'x' | 'y'>
type RunHistorySource = Pick<Run, 'id' | 'dogType' | 'luckyNumber' | 'wins' | 'losses' | 'round' | 'status' | 'phase' | 'createdAt' | 'updatedAt'> & {
  relics?: string
  items?: RunHistoryItemSource[]
}

export type PublicRunHistoryEntry = {
  id: string
  mode: 'CASUAL'
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
    mode: 'CASUAL',
    dogType: run.dogType as DogType,
    luckyNumber: run.luckyNumber,
    wins: run.wins,
    losses: run.losses,
    round: run.round,
    status: run.status,
    phase: run.phase as Phase,
    items: (run.items ?? [])
      .map((item) => ({ id: item.id, defId: item.defId, quality: normalizeQuality(item.quality), area: item.area as GameItem['area'], x: item.x, y: item.y }))
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

export function makeShop(type: ShopType, seed: string) {
  return createShop(type, createRng(seed))
}

export function makeChoices(seed: string, round = 0) {
  return createChoices(createRng(seed), round)
}

export function makeRelicChoices(run: Pick<Run, 'relics'>, seed: string) {
  return createRelicChoices(relicsFromRun(run), createRng(seed))
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

export function seedGhost(round: number, wins: number, losses: number): FighterSnapshot {
  return buildOfflineFighter({ round, wins, losses })
}
