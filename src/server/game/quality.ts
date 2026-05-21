import type { Enchantment, GameItem, ItemQuality } from './types'

export const ITEM_QUALITIES: ItemQuality[] = ['BRONZE', 'SILVER', 'GOLD', 'DIAMOND']

export const QUALITY_LABELS: Record<ItemQuality, string> = {
  BRONZE: '青铜',
  SILVER: '白银',
  GOLD: '黄金',
  DIAMOND: '钻石',
}

export function normalizeQuality(quality?: string | null): ItemQuality {
  return ITEM_QUALITIES.includes(quality as ItemQuality) ? quality as ItemQuality : 'BRONZE'
}

export function nextQuality(quality?: string | null): ItemQuality | null {
  const current = normalizeQuality(quality)
  const index = ITEM_QUALITIES.indexOf(current)
  return ITEM_QUALITIES[index + 1] ?? null
}

export function qualityMultiplier(quality?: string | null) {
  return 1.5 ** ITEM_QUALITIES.indexOf(normalizeQuality(quality))
}

export function qualityAmount(amount: number, quality?: string | null) {
  return Math.round(amount * qualityMultiplier(quality))
}

export function qualityAmountFrom(amount: number, quality?: string | null, baseQuality?: string | null) {
  return Math.round(amount * qualityMultiplier(quality) / qualityMultiplier(baseQuality))
}

export function canUpgradePair(source: GameItem, target: GameItem) {
  return source.id !== target.id
    && source.defId === target.defId
    && normalizeQuality(source.quality) === normalizeQuality(target.quality)
    && nextQuality(target.quality) !== null
}

export function upgradeEnchant(targetEnchant?: Enchantment | null, sourceEnchant?: Enchantment | null) {
  return targetEnchant ?? sourceEnchant ?? null
}
