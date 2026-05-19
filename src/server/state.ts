import { randomUUID } from 'node:crypto'
import type { ItemInstance, Run } from '@prisma/client'
import { CLASS_REWARD_DEFS, RELIC_DEFS, itemDef, relicDef } from './game/data'
import { buildOfflineFighter } from './game/offline-builder'
import { normalizeQuality } from './game/quality'
import { createRng } from './game/rng'
import { createChoices, createShop } from './game/shop'
import type { DogType, FighterSnapshot, GameItem, ItemQuality, Phase, RelicInstance, ShopOffer, ShopType } from './game/types'

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
  return relicsFromRun(run).map((relic) => ({ ...relic, def: relicDef(relic.relicId) }))
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
    shopItems: parseJson<ShopOffer[]>(run.shopItems, []).map((offer) => ({ ...offer, quality: normalizeQuality(offer.quality), def: itemDef(offer.defId) })),
    choices: parseJson<ShopType[]>(run.choices, []),
    classRewardChoices: parseJson<string[]>(run.classRewardChoices, []).map((defId) => ({ defId, def: itemDef(defId), quality: normalizeQuality(itemDef(defId).defaultQuality) })),
    relicChoices: parseJson<string[]>(run.relicChoices, []).map((relicId) => ({ relicId, def: relicDef(relicId), quality: relicDef(relicId).defaultQuality })),
    relics: publicRelics(run),
    refreshCost: run.refreshCost,
    matchedGhost: run.matchedGhost ? parseJson(run.matchedGhost, null) : null,
    lastBattle: run.lastBattle ? parseJson(run.lastBattle, null) : null,
    items: toGameItems(run.items).map((item) => ({ ...item, def: itemDef(item.defId) })),
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

export function seedGhost(round: number, wins: number, losses: number): FighterSnapshot {
  return buildOfflineFighter({ round, wins, losses })
}
