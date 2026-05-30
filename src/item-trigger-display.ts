type TriggerDisplayItem = {
  dice: number[]
  advancedEffect?: string
  triggerDiceOverride?: number[] | null
  enchant?: {
    kind?: string
    dice?: number[]
  } | null
}

type TriggerDisplayRelic = {
  def?: {
    effect?: string
  }
}

type TriggerCountEvent = {
  actor?: string
  kind?: string
  itemId?: string
  time?: number
  roll?: number
  itemTriggerCount?: number
}

const nonSelfTriggeredEffects = new Set([
  'ROLL_TWO_PICK_SMALL',
  'TRIGGER_BY_SIZE',
  'MAX_HP_ON_EXTRA_ROLL',
  'ADJACENT_ON_EXTRA_ROLL',
  'EXTRA_ROLL_RECURSE',
  'EXTRA_ROLL_TRIGGERS_ALL',
  'DOUBLE_RATE_FIRST_TEN',
  'POST_BATTLE_LARGE_ITEM',
  'LARGE_TRIGGERS_NON_LARGE',
  'SIZE_THREE_IS_LARGE',
  'SMALL_TRIGGERS_LARGE',
  'BULLY_QUADRUPLE_CHANCE',
  'DISABLE_ENEMY_LARGE',
  'LUCKY_NUMBER_PITY',
  'ADJACENT_USES_LUCKY',
  'OPENING_FORCE_LUCKY',
  'ONLY_LUCKY_DOUBLE',
  'GRANT_LIFESTEAL_ADJACENT',
  'MULTI_ADJACENT_BONUS',
  'MULTI_REPEAT_BONUS',
  'BOOM_COUNTER',
  'POISON_ON_ATTACK_HIT',
])

function shiftDieUp(die: number) {
  return die >= 6 ? 1 : die + 1
}

function shiftDieDown(die: number) {
  return die <= 1 ? 6 : die - 1
}

function triggerDiceText(dice: number[]) {
  const sortedDice = dice
    .filter((die) => Number.isInteger(die) && die >= 1 && die <= 6)
    .sort((left, right) => left - right)
  const uniqueDice = [...new Set(sortedDice)]
  const seen = new Map<number, number>()
  const extras: number[] = []
  for (const die of sortedDice) {
    const count = seen.get(die) ?? 0
    if (count > 0) extras.push(die)
    seen.set(die, count + 1)
  }
  const baseText = uniqueDice.join('/')
  return extras.length > 0 ? `${baseText} ${extras.map((die) => `+${die}`).join(' ')}` : baseText
}

function itemBaseDice(item: TriggerDisplayItem) {
  return item.triggerDiceOverride && item.triggerDiceOverride.length > 0 ? item.triggerDiceOverride : item.dice
}

function itemExtraDice(item: TriggerDisplayItem) {
  return item.enchant?.kind === 'EXTRA_DICE' && Array.isArray(item.enchant.dice) ? item.enchant.dice : []
}

function applyRelicDiceRemapping(dice: number[], relics: TriggerDisplayRelic[]) {
  if (relics.some((relic) => relic.def?.effect === 'SHIFT_TRIGGER_DICE_UP')) dice = dice.map(shiftDieUp)
  if (relics.some((relic) => relic.def?.effect === 'SHIFT_TRIGGER_DICE_DOWN')) dice = dice.map(shiftDieDown)
  return dice
}

function normalizedDiceLabel(dice: number[]) {
  return [...new Set(dice.filter((die) => Number.isInteger(die) && die >= 1 && die <= 6))].sort((left, right) => left - right).join('/')
}

export function triggerDiceLabel(item: TriggerDisplayItem, relics: TriggerDisplayRelic[] = []) {
  if (item.advancedEffect && nonSelfTriggeredEffects.has(item.advancedEffect)) return null
  const baseDice = applyRelicDiceRemapping([...itemBaseDice(item)], relics)
  const baseDiceSet = new Set(baseDice)
  const extraDice = applyRelicDiceRemapping([...itemExtraDice(item)], relics).filter((die) => !baseDiceSet.has(die))
  return triggerDiceText([...baseDice, ...extraDice])
}

export function extraTriggerDiceLabel(item: TriggerDisplayItem, relics: TriggerDisplayRelic[] = []) {
  if (item.advancedEffect && nonSelfTriggeredEffects.has(item.advancedEffect)) return null
  const baseDice = new Set(applyRelicDiceRemapping([...itemBaseDice(item)], relics))
  const extraDice = applyRelicDiceRemapping([...itemExtraDice(item)], relics).filter((die) => !baseDice.has(die))
  return extraDice.length > 0 ? normalizedDiceLabel(extraDice) : null
}

export function itemTriggerCount(events: TriggerCountEvent[], owner: string, itemId: string, displayIndex: number) {
  const visibleEvents = events.slice(0, Math.max(0, displayIndex) + 1)
  const structuredCount = [...visibleEvents]
    .reverse()
    .find((event) => event.kind === 'ITEM' && event.actor === owner && event.itemId === itemId && typeof event.itemTriggerCount === 'number')
    ?.itemTriggerCount
  if (typeof structuredCount === 'number') return Math.max(0, structuredCount)

  const groups = new Set<string>()
  for (const event of visibleEvents) {
    if (event.kind !== 'ITEM' || event.actor !== owner || event.itemId !== itemId) continue
    groups.add(`${event.time ?? 'na'}:${event.roll ?? 'na'}`)
  }
  return groups.size
}

export function itemTriggerCountLabel(events: TriggerCountEvent[], owner: string, itemId: string, displayIndex: number) {
  return `x${itemTriggerCount(events, owner, itemId, displayIndex)}`
}
