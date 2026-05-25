type TriggerDisplayItem = {
  dice: number[]
  advancedEffect?: string
  triggerDiceOverride?: number[] | null
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
  'BOOM_COUNTER',
  'POISON_ON_ATTACK_HIT',
  'MULTI_ADJACENT_BONUS',
  'MULTI_REPEAT_BONUS',
])

function shiftDieUp(die: number) {
  return die >= 6 ? 1 : die + 1
}

function shiftDieDown(die: number) {
  return die <= 1 ? 6 : die - 1
}

export function triggerDiceLabel(item: TriggerDisplayItem, relics: TriggerDisplayRelic[] = []) {
  if (item.advancedEffect && nonSelfTriggeredEffects.has(item.advancedEffect)) return null
  let dice = item.triggerDiceOverride && item.triggerDiceOverride.length > 0 ? item.triggerDiceOverride : item.dice
  if (relics.some((relic) => relic.def?.effect === 'SHIFT_TRIGGER_DICE_UP')) dice = dice.map(shiftDieUp)
  if (relics.some((relic) => relic.def?.effect === 'SHIFT_TRIGGER_DICE_DOWN')) dice = dice.map(shiftDieDown)
  return [...new Set(dice)].sort((left, right) => left - right).join('/')
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
