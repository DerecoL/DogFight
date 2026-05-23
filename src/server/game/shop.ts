import { randomUUID } from 'node:crypto'
import { SHOP_CHOICES, shopPool } from './data'
import { nextQuality, normalizeQuality } from './quality'
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

function replaceWithSpecialChoice(choices: ShopType[], shopType: ShopType, rng: () => number) {
  if (choices.includes(shopType)) return
  const specialChoices = new Set<ShopType>(['RELIC', 'UPGRADE', 'POTION'])
  const candidates = choices
    .map((choice, index) => ({ choice, index }))
    .filter((entry) => !specialChoices.has(entry.choice))
  const target = candidates[Math.floor(rng() * candidates.length)] ?? candidates[0]
  if (target) choices[target.index] = shopType
}

type QualityBearingItem = { quality?: string | null }

function hasFreeUpgradeableItem<T extends QualityBearingItem>(items: readonly T[]) {
  return items.some((item) => nextQuality(item.quality) !== null)
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
  if (round >= 4 && hasFreeUpgradeableItem(items) && rng() < 0.33) {
    replaceWithSpecialChoice(choices, 'UPGRADE', rng)
  }
  if (round >= 4 && rng() < 0.33) {
    replaceWithSpecialChoice(choices, 'POTION', rng)
  }
  return choices
}
