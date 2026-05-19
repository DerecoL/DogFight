import { CLASS_REWARD_DEFS, RELIC_DEFS, itemDef, shopPool } from './data'
import { canPlace } from './grid'
import { nextQuality, normalizeQuality } from './quality'
import { createRng } from './rng'
import type { DogType, FighterSnapshot, GameItem, ItemDef, ItemQuality, RelicInstance, ShopType } from './types'

export type OfflineBuildInput = {
  dogType?: DogType
  round: number
  wins: number
  losses: number
  seed?: string
}

type OfflineBuildProfile = {
  shopPreference: ShopType[]
  itemTags: string[]
  classRewards: string[]
  relics: string[]
  keepStarterDice: number[]
  preferredDice: number[]
}

const DOG_TYPES: DogType[] = ['SHIBA', 'SAMOYED', 'MUTT', 'BULLY', 'EMPEROR']

const PROFILES: Record<DogType, OfflineBuildProfile> = {
  SHIBA: {
    shopPreference: ['SMALL', 'SMALL_DICE', 'GENERAL'],
    itemTags: ['small', 'attack-speed', 'trigger', 'extra-roll', 'poison'],
    classRewards: ['shiba-shadow-clone', 'shiba-break', 'shiba-speed-katana', 'shiba-swallow-katana'],
    relics: ['midas-right', 'half-die-right'],
    keepStarterDice: [1, 2, 3],
    preferredDice: [1, 2, 3],
  },
  SAMOYED: {
    shopPreference: ['BIG_DICE', 'MEDIUM', 'GENERAL'],
    itemTags: ['big', 'heal', 'thorn', 'weak'],
    classRewards: ['samoyed-absolute-zero', 'samoyed-soft-fur', 'samoyed-avalanche-core', 'samoyed-frost-fur'],
    relics: ['midas-left', 'half-die-left'],
    keepStarterDice: [4, 5, 6],
    preferredDice: [4, 5, 6],
  },
  MUTT: {
    shopPreference: ['GENERAL', 'MEDIUM', 'SMALL'],
    itemTags: ['extra-roll', 'medium', 'late'],
    classRewards: ['mutt-eat-air', 'mutt-chase-tail', 'mutt-counting-collar', 'mutt-charged-collar'],
    relics: ['midas-left', 'midas-right'],
    keepStarterDice: [1, 3, 6],
    preferredDice: [1, 2, 3, 4, 5, 6],
  },
  BULLY: {
    shopPreference: ['LARGE', 'MEDIUM', 'BIG_DICE'],
    itemTags: ['large', 'big', 'medium'],
    classRewards: ['bully-sacrifice', 'bully-colossus', 'bully-gym', 'bully-vault'],
    relics: ['midas-left', 'half-die-left'],
    keepStarterDice: [4, 5],
    preferredDice: [4, 5, 6],
  },
  EMPEROR: {
    shopPreference: ['GENERAL', 'BIG_DICE', 'SMALL_DICE'],
    itemTags: ['lucky', 'big', 'small'],
    classRewards: ['emperor-curtain', 'emperor-edict', 'emperor-dice-cup', 'emperor-minister'],
    relics: ['midas-left', 'midas-right'],
    keepStarterDice: [1, 4, 6],
    preferredDice: [1, 2, 3, 4, 5, 6],
  },
}

function dogTypeFor(input: OfflineBuildInput) {
  return input.dogType ?? DOG_TYPES[(input.round + input.wins + input.losses) % DOG_TYPES.length]
}

function upgradeQuality(base: ItemQuality, steps: number) {
  let quality = normalizeQuality(base)
  for (let i = 0; i < steps; i += 1) {
    const next = nextQuality(quality)
    if (!next) break
    quality = next
  }
  return quality
}

function scoreDef(def: ItemDef, profile: OfflineBuildProfile, rng: () => number) {
  const tagScore = def.tags.reduce((score, tag) => score + (profile.itemTags.includes(tag) ? 12 : 0), 0)
  const diceScore = def.dice.reduce((score, die) => score + (profile.preferredDice.includes(die) ? 3 : 0), 0)
  const classScore = def.kind === 'CLASS_EQUIPMENT' ? 50 : 0
  return classScore + tagScore + diceScore + def.size * 2 + rng()
}

function uniqueById<T extends { id: string }>(defs: T[]) {
  const seen = new Set<string>()
  return defs.filter((def) => {
    if (seen.has(def.id)) return false
    seen.add(def.id)
    return true
  })
}

function starterDefs(profile: OfflineBuildProfile, round: number) {
  const dice = round <= 1 ? profile.keepStarterDice.slice(0, 3) : profile.keepStarterDice.slice(0, 2)
  return dice.map((n) => itemDef(`starter-${n}`))
}

function classRewardDefs(dogType: DogType, profile: OfflineBuildProfile, round: number) {
  if (round < 3) return []
  const unlocked = CLASS_REWARD_DEFS.filter((def) => def.classDog === dogType && def.unlockRound && def.unlockRound <= round)

  const byUnlockRound = new Map<number, ItemDef[]>()
  for (const def of unlocked) {
    if (!def.unlockRound) continue
    byUnlockRound.set(def.unlockRound, [...(byUnlockRound.get(def.unlockRound) ?? []), def])
  }

  return [...byUnlockRound.entries()].sort(([roundA], [roundB]) => roundA - roundB).map(([, defs]) => defs.sort((a, b) => {
    const preferredA = profile.classRewards.indexOf(a.id)
    const preferredB = profile.classRewards.indexOf(b.id)
    return (preferredA === -1 ? 99 : preferredA) - (preferredB === -1 ? 99 : preferredB)
  })[0])
}

function shopDefs(profile: OfflineBuildProfile, round: number) {
  const pools = profile.shopPreference.flatMap((shopType) => shopPool(shopType))
  return uniqueById(pools).slice(0, Math.max(2, round + 1))
}

function qualityFor(def: ItemDef, input: OfflineBuildInput) {
  const base = normalizeQuality(def.defaultQuality)
  if (def.kind === 'CLASS_EQUIPMENT') return base
  if (input.round <= 1) return def.tags.includes('starter') ? 'BRONZE' : 'SILVER'

  const strength = input.round + input.wins - input.losses
  const steps = Math.max(0, Math.floor((strength - 5) / 4))
  return upgradeQuality(base, steps)
}

function placeEquipment(defs: ItemDef[], input: OfflineBuildInput, rng: () => number, profile: OfflineBuildProfile) {
  const scored = uniqueById(defs)
    .map((def) => ({ def, score: scoreDef(def, profile, rng) }))
    .sort((a, b) => b.score - a.score)

  const items: GameItem[] = []
  for (const { def } of scored) {
    const item: GameItem = {
      id: `offline-${items.length}-${def.id}`,
      defId: def.id,
      quality: qualityFor(def, input),
      area: 'EQUIPMENT',
      x: 0,
      y: 0,
    }

    for (let x = 0; x <= 12 - def.width; x += 1) {
      if (canPlace(items, item, 'EQUIPMENT', x, 0)) {
        items.push({ ...item, x, y: 0 })
        break
      }
    }
  }
  return items
}

function buildRelics(profile: OfflineBuildProfile, input: OfflineBuildInput, rng: () => number) {
  if (input.round < 4) return []
  const count = input.round >= 7 || input.wins >= 6 ? 2 : 1
  const preferred = profile.relics
    .map((id) => RELIC_DEFS.find((def) => def.id === id))
    .filter((def): def is NonNullable<typeof def> => Boolean(def))
    .filter((def) => def.unlockRound <= input.round)
  const fallback = RELIC_DEFS.filter((def) => def.unlockRound <= input.round)
  const pool = uniqueById([...preferred, ...fallback])

  const relics: RelicInstance[] = []
  const rankRelic = (id: string) => {
    const index = profile.relics.indexOf(id)
    return index === -1 ? 99 : index
  }

  for (const def of pool.sort((a, b) => (rankRelic(a.id) - rankRelic(b.id)) || rng() - 0.5)) {
    if (relics.length >= count) break
    relics.push({ id: `offline-relic-${relics.length}-${def.id}`, relicId: def.id, quality: def.defaultQuality, slot: relics.length })
  }
  return relics
}

export function buildOfflineFighter(input: OfflineBuildInput): FighterSnapshot {
  const dogType = dogTypeFor(input)
  const profile = PROFILES[dogType]
  const rng = createRng(input.seed ?? `offline-${dogType}-${input.round}-${input.wins}-${input.losses}`)
  const luckyNumber = dogType === 'EMPEROR' ? Math.floor(rng() * 6) + 1 : null

  const defs = [
    ...starterDefs(profile, input.round),
    ...classRewardDefs(dogType, profile, input.round),
    ...shopDefs(profile, input.round),
  ]

  return {
    name: `种子狗狗 R${input.round}`,
    dogType,
    luckyNumber,
    wins: input.wins,
    losses: input.losses,
    round: input.round,
    items: placeEquipment(defs, input, rng, profile),
    relics: buildRelics(profile, input, rng),
  }
}
