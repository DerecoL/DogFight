export type ItemVisualTone =
  | 'damage'
  | 'poison'
  | 'shield'
  | 'heal'
  | 'weak'
  | 'freeze'
  | 'thorns'
  | 'economy'
  | 'growth'
  | 'counter'
  | 'trigger'
  | 'utility'

export type ItemArtAspect = 'square' | 'portrait' | 'wide' | 'panorama'

export type ItemVisualProfile = {
  tone: ItemVisualTone
  className: `item-tone-${ItemVisualTone}`
  artSrc: string | null
  hasCustomArt: boolean
  artAspect: ItemArtAspect
}

type VisualItemDef = {
  id: string
  size: number
  tags: string[]
  advancedEffect?: string
  effect: { type: string }
}

export const itemCardArtManifest: Record<string, { src: string; aspect: ItemArtAspect }> = {
  'dog-gold-ingot': { src: '/assets/item-card-art/dog-gold-ingot.webp', aspect: 'square' },
  'milk-bone': { src: '/assets/item-card-art/milk-bone.webp', aspect: 'square' },
  'samoyed-absolute-zero': { src: '/assets/item-card-art/samoyed-absolute-zero.webp', aspect: 'portrait' },
  'v3-auto-waterer': { src: '/assets/item-card-art/v3-auto-waterer.webp', aspect: 'wide' },
  'v3-fermented-trash-bin': { src: '/assets/item-card-art/v3-fermented-trash-bin.webp', aspect: 'panorama' },
  'v3-flea-disc': { src: '/assets/item-card-art/v3-flea-disc.webp', aspect: 'portrait' },
  'v3-hydrant-axe': { src: '/assets/item-card-art/v3-hydrant-axe.webp', aspect: 'portrait' },
  'v3-large-bone-sword': { src: '/assets/item-card-art/v3-large-bone-sword.webp', aspect: 'wide' },
  'v3-spiked-vest': { src: '/assets/item-card-art/v3-spiked-vest.webp', aspect: 'wide' },
  'v3-wooden-shield': { src: '/assets/item-card-art/v3-wooden-shield.webp', aspect: 'wide' },
  'v4-boom-counter': { src: '/assets/item-card-art/v4-boom-counter.webp', aspect: 'square' },
  'v4-growing-chew-sword': { src: '/assets/item-card-art/v4-growing-chew-sword.webp', aspect: 'wide' },
}

const explicitTones: Record<string, ItemVisualTone> = {
  'dog-gold-ingot': 'economy',
  'samoyed-absolute-zero': 'freeze',
  'v3-boom-counter': 'counter',
  'v4-boom-counter': 'counter',
  'v4-growing-chew-sword': 'growth',
}

function visualTone(def: VisualItemDef): ItemVisualTone {
  if (explicitTones[def.id]) return explicitTones[def.id]
  if (def.tags.includes('poison')) return 'poison'
  if (def.tags.includes('freeze')) return 'freeze'
  if (def.tags.includes('weak')) return 'weak'
  if (def.tags.includes('thorn') || def.tags.includes('thorns')) return 'thorns'
  if (def.tags.includes('shield')) return 'shield'
  if (
    def.tags.includes('heal') ||
    def.tags.includes('lifesteal') ||
    def.effect.type === 'HEAL' ||
    def.advancedEffect === 'LIFESTEAL' ||
    def.advancedEffect === 'HEAL_OR_MAX_HP' ||
    def.advancedEffect === 'MAX_HP_ON_EXTRA_ROLL'
  ) return 'heal'
  if (def.tags.includes('economy') || def.tags.includes('sell')) return 'economy'
  if (def.tags.includes('growth')) return 'growth'
  if (def.tags.includes('counter')) return 'counter'
  if (def.tags.includes('multi')) return 'trigger'
  if (def.tags.includes('trigger')) return 'trigger'
  if (def.tags.includes('damage') || def.effect.type === 'DAMAGE') return 'damage'
  return 'utility'
}

function fallbackAspect(def: VisualItemDef): ItemArtAspect {
  if (def.size >= 4) return 'panorama'
  if (def.size >= 3) return 'wide'
  return 'square'
}

export function itemVisualProfile(def: VisualItemDef): ItemVisualProfile {
  const tone = visualTone(def)
  const art = itemCardArtManifest[def.id] ?? null
  return {
    tone,
    className: `item-tone-${tone}`,
    artSrc: art?.src ?? null,
    hasCustomArt: Boolean(art),
    artAspect: art?.aspect ?? fallbackAspect(def),
  }
}
