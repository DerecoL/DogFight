export type DogType = 'SHIBA' | 'SAMOYED' | 'MUTT' | 'BULLY' | 'EMPEROR'
export type Phase = 'SHOP' | 'CHOICE' | 'CLASS_REWARD' | 'RELIC_CHOICE' | 'PREP' | 'MATCH' | 'BATTLE' | 'COMPLETE'
export type ShopType = 'GENERAL' | 'LARGE' | 'MEDIUM' | 'SMALL' | 'SMALL_DICE' | 'BIG_DICE' | 'RELIC'
export type Area = 'EQUIPMENT' | 'BAG'
export type ItemQuality = 'BRONZE' | 'SILVER' | 'GOLD' | 'DIAMOND'
export type ItemKind = 'EQUIPMENT' | 'CLASS_EQUIPMENT'
export type AdvancedEffect =
  | 'NONE'
  | 'SHIBA_SPEED'
  | 'TRIGGER_ADJACENT'
  | 'EXTRA_ROLL_CHANCE'
  | 'ROLL_TWO_PICK_SMALL'
  | 'TRIGGER_BY_SIZE'
  | 'POISON_ON_ROLL'
  | 'GAIN_THORNS'
  | 'APPLY_WEAK'
  | 'AVALANCHE'
  | 'FREEZE_STACK'
  | 'TRIGGER_MINUS_THREE'
  | 'MAX_HP_ON_EXTRA_ROLL'
  | 'ROLL_COUNTER_EXTRA'
  | 'ADJACENT_ON_EXTRA_ROLL'
  | 'EXTRA_ROLL_RECURSE'
  | 'EXTRA_ROLL_TRIGGERS_ALL'
  | 'DOUBLE_RATE_FIRST_TEN'
  | 'POST_BATTLE_LARGE_ITEM'
  | 'LARGE_TRIGGERS_NON_LARGE'
  | 'SIZE_THREE_IS_LARGE'
  | 'SMALL_TRIGGERS_LARGE'
  | 'BULLY_QUADRUPLE_CHANCE'
  | 'DISABLE_ENEMY_LARGE'
  | 'LUCKY_NUMBER_PITY'
  | 'SHIELD_ON_NON_LUCKY'
  | 'CLEANSE_ON_LUCKY'
  | 'ADJACENT_USES_LUCKY'
  | 'OPENING_FORCE_LUCKY'
  | 'ONLY_LUCKY_DOUBLE'
  | 'TARGET_WEAK_BONUS_DAMAGE'
  | 'ADJACENT_DAMAGE_BONUS'
  | 'CLEANSE_ONE'
  | 'APPLY_POISON'
  | 'GAIN_SHIELD'
  | 'GAIN_SHIELD_THORNS'
  | 'APPLY_WEAK_ON_HIT'
  | 'DOUBLE_SHIELD_DAMAGE'
  | 'HEAL_OR_MAX_HP'
  | 'ADJACENT_TEMP_TRIGGER'
  | 'LIFESTEAL'
  | 'POISON_AND_DISABLE_RIGHTMOST'
  | 'SHIELD_IMMUNITY'
  | 'GRANT_LIFESTEAL_ADJACENT'
  | 'BOOM_COUNTER'
  | 'GROWTH_DAMAGE'
  | 'PURGE_ENEMY_BUFFS'

export type ItemDef = {
  id: string
  name: string
  kind?: ItemKind
  classDog?: DogType
  unlockRound?: 3 | 6
  size: 1 | 2 | 3 | 4
  width: number
  height: number
  price: number
  dice: number[]
  tags: string[]
  description?: string
  advancedEffect?: AdvancedEffect
  defaultQuality?: ItemQuality
  effect: {
    type: 'DAMAGE' | 'HEAL' | 'DAMAGE_SELF_SHIELD' | 'UTILITY'
    amount: number
    qualityBase?: ItemQuality
  }
}

export type GameItem = {
  id: string
  defId: string
  quality: ItemQuality
  area: Area
  x: number
  y: number
}

export type ShopOffer = {
  offerId: string
  defId: string
  price: number
  discount: number
  quality?: ItemQuality
}

export type RelicEffect =
  | 'MIRROR_BIG_TO_SMALL'
  | 'MIRROR_SMALL_TO_BIG'
  | 'ONLY_BIG_HALF_EFFECT'
  | 'ONLY_SMALL_HALF_EFFECT'
  | 'EXTREME_ROLL_BIAS'
  | 'MIDDLE_ROLL_BIAS'
  | 'EMPTY_ROLL_LARGE_SAFETY'
  | 'POISON_TICK_BONUS'
  | 'OPENING_THORNS'
  | 'HUSKY_ENGINE'
  | 'EXTRA_EQUIPMENT_REDUCED_EFFECT'

export type RelicDef = {
  id: string
  name: string
  unlockRound: number
  defaultQuality: ItemQuality
  tags: string[]
  description: string
  effect: RelicEffect
}

export type RelicInstance = {
  id: string
  relicId: string
  quality: ItemQuality
  slot: number
}

export type BattleRelicSnapshot = RelicInstance & { def: RelicDef }

export type FighterSnapshot = {
  name: string
  dogType: DogType
  luckyNumber?: number | null
  wins: number
  losses: number
  round: number
  items: GameItem[]
  relics?: RelicInstance[]
}

export type BattleItemSnapshot = GameItem & { def: ItemDef }

export type BattleFighterSnapshot = Omit<FighterSnapshot, 'items'> & {
  items: BattleItemSnapshot[]
  relics?: BattleRelicSnapshot[]
}

export type BattleStatusType = 'shield' | 'thorns' | 'extraRoll' | 'poison' | 'weak' | 'freeze' | 'disabled'

export type BattleStatusEntry = {
  type: BattleStatusType
  label: string
  tone: 'positive' | 'negative'
  amount?: number
  stacks?: number
  remaining?: number
  nextTickIn?: number
  tickDamage?: number
}

export type BattleStatusRows = {
  positive: BattleStatusEntry[]
  negative: BattleStatusEntry[]
}

export type BattleEvent = {
  time: number
  actor: 'player' | 'opponent' | 'system'
  kind: 'ROLL' | 'ITEM' | 'POISON' | 'END'
  text: string
  playerHp: number
  opponentHp: number
  playerMaxHp: number
  opponentMaxHp: number
  playerShield: number
  opponentShield: number
  playerStatuses?: BattleStatusRows
  opponentStatuses?: BattleStatusRows
  statusChanged?: BattleStatusType[]
  roll?: number
  itemId?: string
  defId?: string
  quality?: ItemQuality
  effectType?: ItemDef['effect']['type'] | 'POISON' | 'ROLL'
  amount?: number
  target?: 'player' | 'opponent' | 'both' | 'none'
  sourceHpDelta?: number
  targetHpDelta?: number
}

export type BattleResult = {
  winner: 'player' | 'opponent'
  duration: number
  playerHp: number
  opponentHp: number
  playerMaxHp: number
  opponentMaxHp: number
  events: BattleEvent[]
  playerSnapshot: BattleFighterSnapshot
  opponentSnapshot: BattleFighterSnapshot
}
