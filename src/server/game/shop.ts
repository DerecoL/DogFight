import { randomUUID } from 'node:crypto'
import { SHOP_CHOICES, shopPool } from './data'
import { normalizeQuality } from './quality'
import { pick } from './rng'
import type { ItemDef, ItemQuality, ShopOffer, ShopType } from './types'

const QUALITY_PRICE_MULTIPLIER: Record<ItemQuality, number> = {
  BRONZE: 1,
  SILVER: 1.5,
  GOLD: 2,
  DIAMOND: 4,
}

function shopPrice(def: ItemDef, discount: number) {
  const quality = normalizeQuality(def.defaultQuality)
  return Math.max(1, Math.floor(def.price * QUALITY_PRICE_MULTIPLIER[quality] * discount))
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

export function createChoices(rng: () => number, round = 0): ShopType[] {
  const choices: ShopType[] = []
  while (choices.length < 3) {
    const next = pick(rng, SHOP_CHOICES)
    if (!choices.includes(next)) choices.push(next)
  }
  if (round >= 4 && rng() < 0.33) {
    choices[Math.floor(rng() * choices.length)] = 'RELIC'
  }
  return choices
}
