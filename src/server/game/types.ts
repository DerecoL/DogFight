export type DogType = 'SHIBA' | 'SAMOYED' | 'MUTT' | 'BULLY' | 'EMPEROR'
export type Phase = 'SHOP' | 'CHOICE' | 'MATCH' | 'BATTLE' | 'COMPLETE'
export type ShopType = 'GENERAL' | 'LARGE' | 'MEDIUM' | 'SMALL' | 'SMALL_DICE' | 'BIG_DICE'
export type Area = 'EQUIPMENT' | 'BAG'
export type ItemQuality = 'BRONZE' | 'SILVER' | 'GOLD' | 'DIAMOND'

export type ItemDef = {
  id: string
  name: string
  size: 1 | 2 | 3 | 4
  width: number
  height: number
  price: number
  dice: number[]
  tags: string[]
  effect: {
    type: 'DAMAGE' | 'HEAL' | 'DAMAGE_SELF_SHIELD'
    amount: number
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

export type FighterSnapshot = {
  name: string
  dogType: DogType
  luckyNumber?: number | null
  wins: number
  losses: number
  round: number
  items: GameItem[]
}

export type BattleItemSnapshot = GameItem & { def: ItemDef }

export type BattleFighterSnapshot = Omit<FighterSnapshot, 'items'> & {
  items: BattleItemSnapshot[]
}

export type BattleEvent = {
  time: number
  actor: 'player' | 'opponent' | 'system'
  kind: 'ROLL' | 'ITEM' | 'POISON' | 'END'
  text: string
  playerHp: number
  opponentHp: number
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
  winner: 'player' | 'opponent' | 'draw'
  duration: number
  playerHp: number
  opponentHp: number
  events: BattleEvent[]
  playerSnapshot: BattleFighterSnapshot
  opponentSnapshot: BattleFighterSnapshot
}
