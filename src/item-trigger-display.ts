type TriggerDisplayItem = {
  dice: number[]
  advancedEffect?: string
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
])

export function triggerDiceLabel(item: TriggerDisplayItem) {
  if (item.advancedEffect && nonSelfTriggeredEffects.has(item.advancedEffect)) return null
  return [...new Set(item.dice)].sort((left, right) => left - right).join('/')
}
