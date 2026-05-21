import { createRng } from './rng'
import type {
  Enchantment,
  EnchantmentBaseEffect,
  EnchantmentChoice,
  EnchantmentGrantEffect,
  EnchantmentSpecialEffect,
  EnchantmentTarget,
} from './types'

const ENCHANT_CHOICE_COUNT = 3

const targets: EnchantmentTarget[] = ['LEFT', 'RIGHT', 'ADJACENT']
const baseEffects: EnchantmentBaseEffect[] = ['DAMAGE', 'HEAL', 'SHIELD']
const specialEffects: EnchantmentSpecialEffect[] = ['THORNS', 'FURY', 'POISON', 'WEAK']
const grantEffects: EnchantmentGrantEffect[] = ['LIFESTEAL', 'THORNS', 'CLEANSE']

function pick<T>(rng: () => number, values: T[]) {
  return values[Math.floor(rng() * values.length)]
}

function targetText(target: EnchantmentTarget) {
  if (target === 'LEFT') return '左侧'
  if (target === 'RIGHT') return '右侧'
  return '相邻'
}

function baseEffectText(effect: EnchantmentBaseEffect) {
  if (effect === 'DAMAGE') return '攻击'
  if (effect === 'HEAL') return '回复生命'
  return '增加护盾'
}

function specialEffectText(effect: EnchantmentSpecialEffect) {
  if (effect === 'THORNS') return '荆棘'
  if (effect === 'FURY') return '激昂'
  if (effect === 'POISON') return '中毒'
  return '虚弱'
}

function grantEffectText(effect: EnchantmentGrantEffect) {
  if (effect === 'LIFESTEAL') return '吸血'
  if (effect === 'THORNS') return '荆棘'
  return '净化'
}

function amountFor(rng: () => number, round: number, kind: 'BASE' | 'SPECIAL' | 'BUFF' | 'GRANT') {
  const roundBonus = Math.max(0, Math.floor((round - 4) / 3))
  if (kind === 'BASE') return pick(rng, [8, 10, 12, 14]) + roundBonus * 2
  if (kind === 'BUFF') return pick(rng, [4, 5, 6, 7]) + roundBonus
  return pick(rng, [1, 2, 3])
}

function extraDiceFor(rng: () => number) {
  const roll = rng()
  if (roll < 0.34) return [pick(rng, [1, 2, 3, 4, 5, 6])]
  if (roll < 0.67) return [1, 2, 3]
  return [4, 5, 6]
}

function makeEnchant(rng: () => number, round: number, index: number): Enchantment {
  const kind = index < 6 ? index : Math.floor(rng() * 6)
  if (kind === 0) {
    const dice = extraDiceFor(rng)
    const label = dice.length === 1 ? `额外在 ${dice[0]} 点触发` : dice[0] === 1 ? '额外在小点触发' : '额外在大点触发'
    return { kind: 'EXTRA_DICE', dice, label }
  }
  if (kind === 1) {
    const effect = pick(rng, baseEffects)
    const amount = amountFor(rng, round, 'BASE')
    return { kind: 'BASE_EFFECT', effect, amount, label: `触发时${baseEffectText(effect)} ${amount}` }
  }
  if (kind === 2) {
    const effect = pick(rng, specialEffects)
    const amount = amountFor(rng, round, 'SPECIAL')
    return { kind: 'SPECIAL', effect, amount, label: `触发时触发 ${amount} 层${specialEffectText(effect)}` }
  }
  if (kind === 3) {
    const target = pick(rng, targets)
    return { kind: 'TRIGGER_NEIGHBOR', target, label: `触发时额外触发${targetText(target)}装备` }
  }
  if (kind === 4) {
    const target = pick(rng, targets)
    const effect = pick(rng, baseEffects)
    const amount = amountFor(rng, round, 'BUFF')
    return { kind: 'BUFF_NEIGHBOR_EFFECT', target, effect, amount, label: `触发时使${targetText(target)}装备下次${baseEffectText(effect)} +${amount}` }
  }
  const target = pick(rng, targets)
  const effect = pick(rng, grantEffects)
  const amount = amountFor(rng, round, 'GRANT')
  return { kind: 'GRANT_NEIGHBOR_EFFECT', target, effect, amount, label: `触发时使${targetText(target)}装备获得${grantEffectText(effect)} ${amount}` }
}

export function enchantmentText(enchant: Enchantment) {
  if (enchant.kind === 'EXTRA_DICE') {
    const dice = enchant.dice.length === 1 ? `${enchant.dice[0]} 点` : enchant.dice[0] === 1 ? '小点' : '大点'
    return `附魔：该装备额外在${dice}时生效。`
  }
  if (enchant.kind === 'BASE_EFFECT') return `附魔：该装备触发时额外${baseEffectText(enchant.effect)} ${enchant.amount}。`
  if (enchant.kind === 'SPECIAL') return `附魔：该装备触发时额外触发 ${enchant.amount} 层${specialEffectText(enchant.effect)}。`
  if (enchant.kind === 'TRIGGER_NEIGHBOR') return `附魔：该装备触发时额外触发${targetText(enchant.target)}装备。`
  if (enchant.kind === 'BUFF_NEIGHBOR_EFFECT') return `附魔：该装备触发时使${targetText(enchant.target)}装备下次${baseEffectText(enchant.effect)} +${enchant.amount}。`
  return `附魔：该装备触发时使${targetText(enchant.target)}装备获得${grantEffectText(enchant.effect)} ${enchant.amount}。`
}

export function createEnchantChoices(seed: string, round: number): EnchantmentChoice[] {
  const rng = createRng(seed)
  const offset = Math.floor(rng() * 6)
  return Array.from({ length: ENCHANT_CHOICE_COUNT }, (_, index) => {
    const enchant = makeEnchant(rng, round, (offset + index) % 6)
    return {
      id: `${seed}-${index}`,
      enchant,
      description: enchantmentText(enchant),
    }
  })
}
