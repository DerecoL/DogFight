import { createRng } from './rng'
import type { PotionCategory, PotionChoice } from './types'

const ALL_DICE = [1, 2, 3, 4, 5, 6]
const POTION_CATEGORY_WEIGHTS: Array<{ category: PotionCategory; weight: number }> = [
  { category: 'ADD_ONE', weight: 50 },
  { category: 'ADD_TWO', weight: 10 },
  { category: 'EXTRA_ONE', weight: 10 },
  { category: 'REPLACE_RANGE', weight: 10 },
  { category: 'REPLACE_ALL', weight: 1 },
]
const POTION_RANGES = [
  { label: '小点', dice: [1, 2, 3] },
  { label: '大点', dice: [4, 5, 6] },
  { label: '极值', dice: [1, 6] },
]

function pick<T>(rng: () => number, values: readonly T[]) {
  return values[Math.floor(rng() * values.length)] ?? values[0]
}

function pickWeightedCategory(rng: () => number) {
  const total = POTION_CATEGORY_WEIGHTS.reduce((sum, entry) => sum + entry.weight, 0)
  let roll = rng() * total
  for (const entry of POTION_CATEGORY_WEIGHTS) {
    roll -= entry.weight
    if (roll < 0) return entry.category
  }
  return POTION_CATEGORY_WEIGHTS[0].category
}

function pickUniqueDice(rng: () => number, count: number) {
  const pool = [...ALL_DICE]
  const dice: number[] = []
  while (dice.length < count && pool.length > 0) {
    const index = Math.floor(rng() * pool.length)
    const [die] = pool.splice(index, 1)
    dice.push(die)
  }
  return normalizeTriggerDice(dice)
}

export function normalizeTriggerDice(dice: readonly number[]) {
  return [...new Set(dice.filter((die) => Number.isInteger(die) && die >= 1 && die <= 6))]
    .sort((left, right) => left - right)
}

export function normalizeTriggerDiceWithExtras(dice: readonly number[]) {
  return dice
    .filter((die) => Number.isInteger(die) && die >= 1 && die <= 6)
    .sort((left, right) => left - right)
}

export function potionChoiceText(choice: Pick<PotionChoice, 'category' | 'dice'>) {
  const diceText = normalizeTriggerDice(choice.dice).join('/')
  if (choice.category === 'ADD_ONE') return `增加 ${diceText} 点触发`
  if (choice.category === 'ADD_TWO') return `增加 ${diceText} 点触发`
  if (choice.category === 'EXTRA_ONE') return `额外增加 ${diceText} 点触发`
  if (choice.category === 'REPLACE_ALL') return '改为全点数 1/2/3/4/5/6 触发'
  const range = POTION_RANGES.find((entry) => entry.dice.join('/') === normalizeTriggerDice(choice.dice).join('/'))
  return `改为${range?.label ?? '指定点数'} ${diceText} 触发`
}

export function createPotionChoices(seed: string): PotionChoice[] {
  return Array.from({ length: 3 }, (_, index) => {
    const category = pickWeightedCategory(createRng(`${seed}-category-${index}`))
    const valueRng = createRng(`${seed}-value-${index}`)
    const dice = category === 'ADD_TWO'
      ? pickUniqueDice(valueRng, 2)
      : category === 'REPLACE_RANGE'
        ? pick(valueRng, POTION_RANGES).dice
        : category === 'REPLACE_ALL'
          ? ALL_DICE
          : pickUniqueDice(valueRng, 1)
    const choice = {
      id: `${seed}-potion-${index}-${category}-${dice.join('-')}`,
      category,
      dice: normalizeTriggerDice(dice),
      description: '',
    }
    return { ...choice, description: potionChoiceText(choice) }
  })
}

export function applyPotionToBaseDice(baseDice: readonly number[], choice: Pick<PotionChoice, 'category' | 'dice'>) {
  if (choice.category === 'REPLACE_RANGE' || choice.category === 'REPLACE_ALL') {
    return normalizeTriggerDice(choice.dice)
  }
  const base = normalizeTriggerDiceWithExtras(baseDice)
  const existing = new Set(base)
  const additions = normalizeTriggerDice(choice.dice).filter((die) => choice.category === 'EXTRA_ONE' || !existing.has(die))
  return normalizeTriggerDiceWithExtras([...base, ...additions])
}
