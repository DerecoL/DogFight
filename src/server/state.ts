import { randomUUID } from 'node:crypto'
import type { ItemInstance, Run } from '@prisma/client'
import { itemDef } from './game/data'
import { findSlot } from './game/grid'
import { normalizeQuality } from './game/quality'
import { createRng } from './game/rng'
import { createChoices, createShop } from './game/shop'
import type { DogType, FighterSnapshot, GameItem, Phase, ShopOffer, ShopType } from './game/types'

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

export function makeShop(type: ShopType, seed: string) {
  return createShop(type, createRng(seed))
}

export function makeChoices(seed: string) {
  return createChoices(createRng(seed))
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
  }
}

export function seedGhost(round: number, wins: number, losses: number): FighterSnapshot {
  const dogTypes: DogType[] = ['SHIBA', 'SAMOYED', 'MUTT', 'BULLY', 'EMPEROR']
  const dogType = dogTypes[(round + wins + losses) % dogTypes.length]
  const luckyNumber = dogType === 'EMPEROR' ? ((round + wins + losses) % 6) + 1 : null
  const items: GameItem[] = initialItems().map((item) => ({ ...item, id: randomUUID(), area: 'EQUIPMENT' }))
  const upgrades = ['small-bite', 'rubber-ball', 'spiked-collar', 'giant-bone']
  for (let i = 0; i < Math.min(round + wins, upgrades.length); i += 1) {
    const slot = findSlot(items, upgrades[i], 'EQUIPMENT')
    if (slot) items.push({ id: randomUUID(), defId: upgrades[i], quality: 'BRONZE', area: 'EQUIPMENT', ...slot })
  }
  return { name: `种子狗狗 R${round}`, dogType, luckyNumber, wins, losses, round, items }
}
