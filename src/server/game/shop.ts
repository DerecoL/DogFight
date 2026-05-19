import { randomUUID } from 'node:crypto'
import { SHOP_CHOICES, shopPool } from './data'
import { pick } from './rng'
import type { ShopOffer, ShopType } from './types'

export function createShop(type: ShopType, rng: () => number): ShopOffer[] {
  const pool = shopPool(type)
  const offers: ShopOffer[] = Array.from({ length: 5 }, () => {
    const def = pick(rng, pool)
    const discount = rng() < 0.2 ? pick(rng, [0.5, 0.6, 0.7, 0.8]) : 1
    return {
      offerId: randomUUID(),
      defId: def.id,
      price: Math.max(1, Math.floor(def.price * discount)),
      discount,
      quality: def.defaultQuality ?? 'BRONZE' as const,
    }
  })
  if (type === 'GENERAL' && offers.every((offer) => offer.price > 5)) {
    const affordable = [...pool].sort((a, b) => a.price - b.price)[0]
    offers[0] = { offerId: randomUUID(), defId: affordable.id, price: affordable.price, discount: 1, quality: affordable.defaultQuality ?? 'BRONZE' }
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
