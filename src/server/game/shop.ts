import { randomUUID } from 'node:crypto'
import { SHOP_CHOICES, shopPool } from './data'
import { ITEM_QUALITIES, nextQuality, normalizeQuality } from './quality'
import { pick } from './rng'
import type { ItemDef, ItemQuality, ShopOffer, ShopType } from './types'

const QUALITY_VALUE_MULTIPLIER: Record<ItemQuality, number> = {
  BRONZE: 1,
  SILVER: 2,
  GOLD: 4,
  DIAMOND: 8,
}

function shopPrice(def: ItemDef, discount: number) {
  return Math.max(1, Math.floor(itemPurchaseValue(def) * discount))
}

export function itemPurchaseValue(def: ItemDef, quality: ItemQuality = normalizeQuality(def.defaultQuality)) {
  const currentQuality = normalizeQuality(quality)
  return Math.floor(def.price * QUALITY_VALUE_MULTIPLIER[currentQuality])
}

export function itemSellValue(def: ItemDef, quality?: ItemQuality | string | null, sellBonus = 0) {
  return Math.floor(itemPurchaseValue(def, normalizeQuality(quality ?? def.defaultQuality)) / 2) + Math.max(0, Math.floor(sellBonus))
}

export function createShop(type: ShopType, rng: () => number, round = 0): ShopOffer[] {
  const pool = shopPool(type, round)
  const offers: ShopOffer[] = Array.from({ length: 5 }, () => {
    const def = pick(rng, pool)
    const discount = rng() < 0.2 ? pick(rng, [0.5, 0.6, 0.7, 0.8]) : 1
    return {
      offerId: randomUUID(),
      defId: def.id,
      price: shopPrice(def, discount),
      discount,
      quality: def.defaultQuality ?? 'BRONZE' as const,
    }
  })
  if (type === 'GENERAL' && offers.every((offer) => offer.price > 5)) {
    const affordable = [...pool].sort((a, b) => shopPrice(a, 1) - shopPrice(b, 1))[0]
    offers[0] = { offerId: randomUUID(), defId: affordable.id, price: shopPrice(affordable, 1), discount: 1, quality: affordable.defaultQuality ?? 'BRONZE' }
  }
  return offers
}

export const UPGRADE_SHOP_TYPES = ['UPGRADE_SILVER', 'UPGRADE_GOLD', 'UPGRADE_DIAMOND'] as const satisfies readonly ShopType[]

const UPGRADE_SHOP_MAX_QUALITY: Partial<Record<ShopType, ItemQuality>> = {
  UPGRADE: 'DIAMOND',
  UPGRADE_SILVER: 'SILVER',
  UPGRADE_GOLD: 'GOLD',
  UPGRADE_DIAMOND: 'DIAMOND',
}

export function isUpgradeShopType(shopType: ShopType): boolean {
  return shopType in UPGRADE_SHOP_MAX_QUALITY
}

export function upgradeShopMaxQuality(shopType: ShopType): ItemQuality | null {
  return UPGRADE_SHOP_MAX_QUALITY[shopType] ?? null
}

export function canUseUpgradeShop(shopType: ShopType, item: QualityBearingItem) {
  const maxQuality = upgradeShopMaxQuality(shopType)
  if (!maxQuality) return false
  const currentIndex = ITEM_QUALITIES.indexOf(normalizeQuality(item.quality))
  const maxIndex = ITEM_QUALITIES.indexOf(maxQuality)
  return currentIndex >= 0 && currentIndex < maxIndex && nextQuality(item.quality) !== null
}

function replaceWithSpecialChoice(choices: ShopType[], shopType: ShopType, rng: () => number) {
  if (choices.includes(shopType)) return
  const specialChoices = new Set<ShopType>(['RELIC', 'UPGRADE', ...UPGRADE_SHOP_TYPES, 'POTION'])
  const candidates = choices
    .map((choice, index) => ({ choice, index }))
    .filter((entry) => !specialChoices.has(entry.choice))
  const target = candidates[Math.floor(rng() * candidates.length)] ?? candidates[0]
  if (target) choices[target.index] = shopType
}

type QualityBearingItem = { quality?: string | null }

function hasFreeUpgradeableItem<T extends QualityBearingItem>(items: readonly T[], shopType: ShopType) {
  return items.some((item) => canUseUpgradeShop(shopType, item))
}

function upgradeShopWeight(shopType: ShopType, round: number) {
  const currentRound = Math.max(0, Math.floor(round))
  if (shopType === 'UPGRADE_SILVER') return Math.max(1, 10 - currentRound)
  if (shopType === 'UPGRADE_GOLD') return currentRound >= 5 ? Math.min(8, currentRound - 3) : 0
  if (shopType === 'UPGRADE_DIAMOND') return currentRound >= 7 ? currentRound - 6 : 0
  return 0
}

function pickUpgradeShopType<T extends QualityBearingItem>(rng: () => number, round: number, items: readonly T[]): ShopType | null {
  const candidates = UPGRADE_SHOP_TYPES
    .map((shopType) => ({ shopType, weight: upgradeShopWeight(shopType, round) }))
    .filter((entry) => entry.weight > 0 && hasFreeUpgradeableItem(items, entry.shopType))
  const totalWeight = candidates.reduce((total, entry) => total + entry.weight, 0)
  if (totalWeight <= 0) return null
  let roll = rng() * totalWeight
  for (const entry of candidates) {
    roll -= entry.weight
    if (roll < 0) return entry.shopType
  }
  return candidates.at(-1)?.shopType ?? null
}

export function createChoices<T extends QualityBearingItem>(rng: () => number, round = 0, items: readonly T[] = []): ShopType[] {
  const choices: ShopType[] = []
  while (choices.length < 3) {
    const next = pick(rng, SHOP_CHOICES)
    if (!choices.includes(next)) choices.push(next)
  }
  if (round >= 4 && rng() < 0.33) {
    replaceWithSpecialChoice(choices, 'RELIC', rng)
  }
  if (round >= 4 && rng() < 0.33) {
    const upgradeShopType = pickUpgradeShopType(rng, round, items)
    if (upgradeShopType) replaceWithSpecialChoice(choices, upgradeShopType, rng)
  }
  if (round >= 4 && rng() < 0.33) {
    replaceWithSpecialChoice(choices, 'POTION', rng)
  }
  return choices
}
