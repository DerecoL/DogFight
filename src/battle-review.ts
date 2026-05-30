export type BattleLogCategory = 'all' | 'damage' | 'sustain' | 'status' | 'equipment'
export type BattleLogFilter = BattleLogCategory

export type BattleReviewTopItem = {
  itemId: string
  name: string
  contribution: number
}

export type BattleReviewSideStats = {
  side: 'player' | 'opponent'
  label: string
  damage: number
  healing: number
  shield: number
  poisonDamage: number
  statusEvents: number
  topItem: BattleReviewTopItem | null
}

export type BattleReview = {
  winner: 'player' | 'opponent' | string
  systemDamage: number
  player: BattleReviewSideStats
  opponent: BattleReviewSideStats
}

type ReviewSide = 'player' | 'opponent'

type BattleReviewItem = {
  id: string
  defId?: string
  def?: {
    name?: string
  }
}

type BattleReviewSnapshot = {
  name?: string
  items?: BattleReviewItem[]
}

export type BattleReviewEvent = {
  actor?: ReviewSide | 'system' | string
  kind?: string
  text?: string
  itemId?: string
  targetItemId?: string
  effectType?: string
  amount?: number
  target?: ReviewSide | 'both' | 'none' | string
  sourceHpDelta?: number
  targetHpDelta?: number
  statusChanged?: readonly string[]
  time?: number
}

export type BattleReviewInput = {
  winner: 'player' | 'opponent' | string
  events: BattleReviewEvent[]
  playerSnapshot?: BattleReviewSnapshot
  opponentSnapshot?: BattleReviewSnapshot
}

type MutableSideStats = BattleReviewSideStats & {
  itemContribution: Map<string, number>
  itemNames: Map<string, string>
}

export function buildBattleReview(battle: BattleReviewInput): BattleReview {
  const player = createSideStats('player', battle.playerSnapshot)
  const opponent = createSideStats('opponent', battle.opponentSnapshot)
  let systemDamage = 0

  for (const event of battle.events) {
    const actor = normalizeReviewSide(event.actor)
    if (event.kind === 'POISON' || event.effectType === 'POISON') {
      if (event.kind === 'POISON') {
        if (event.target === 'both') {
          systemDamage += Math.abs(Math.min(0, hpDeltaForSide(event, 'player')))
          systemDamage += Math.abs(Math.min(0, hpDeltaForSide(event, 'opponent')))
        } else if (event.target === 'player') {
          opponent.poisonDamage += Math.abs(Math.min(0, hpDeltaForSide(event, 'player')))
        } else if (event.target === 'opponent') {
          player.poisonDamage += Math.abs(Math.min(0, hpDeltaForSide(event, 'opponent')))
        }
      } else if (actor) {
        statsForSide(actor, player, opponent).statusEvents += 1
      }
      continue
    }

    if (!actor) continue
    const actorStats = statsForSide(actor, player, opponent)
    const actorDelta = hpDeltaForSide(event, actor)
    const targetSide = event.target === 'player' || event.target === 'opponent' ? event.target : oppositeSide(actor)
    const targetDelta = hpDeltaForSide(event, targetSide)

    if (event.effectType === 'DAMAGE') {
      const damage = Math.abs(Math.min(0, targetDelta))
      actorStats.damage += damage
      addItemContribution(actorStats, event, damage)
      continue
    }

    if (event.effectType === 'HEAL') {
      const healing = Math.max(0, actorDelta)
      actorStats.healing += healing
      addItemContribution(actorStats, event, healing)
      continue
    }

    if (isShieldEvent(event)) {
      const shield = positiveAmount(event)
      actorStats.shield += shield
      addItemContribution(actorStats, event, shield)
      continue
    }

    if (isStatusEvent(event)) actorStats.statusEvents += 1
  }

  return {
    winner: battle.winner,
    systemDamage,
    player: finalizeSideStats(player),
    opponent: finalizeSideStats(opponent),
  }
}

export function battleLogCategory(event: BattleReviewEvent): BattleLogCategory {
  if (event.targetItemId || isEquipmentLinkEvent(event)) return 'equipment'
  if (event.effectType === 'DAMAGE') return 'damage'
  if (event.kind === 'POISON' && hasHpLoss(event)) return 'damage'
  if (event.effectType === 'HEAL' || isShieldEvent(event)) return 'sustain'
  if (event.effectType === 'POISON' || isStatusEvent(event)) return 'status'
  return 'all'
}

export function filterBattleEvents<T extends BattleReviewEvent>(events: T[], filter: BattleLogFilter): T[] {
  if (filter === 'all') return events
  return events.filter((event) => battleLogCategory(event) === filter)
}

function createSideStats(side: ReviewSide, snapshot?: BattleReviewSnapshot): MutableSideStats {
  const itemNames = new Map<string, string>()
  for (const item of snapshot?.items ?? []) {
    itemNames.set(item.id, item.def?.name ?? item.defId ?? item.id)
  }
  return {
    side,
    label: snapshot?.name ?? (side === 'player' ? '我方' : '对手'),
    damage: 0,
    healing: 0,
    shield: 0,
    poisonDamage: 0,
    statusEvents: 0,
    topItem: null,
    itemContribution: new Map(),
    itemNames,
  }
}

function finalizeSideStats(stats: MutableSideStats): BattleReviewSideStats {
  let topItem: BattleReviewTopItem | null = null
  for (const [itemId, contribution] of stats.itemContribution.entries()) {
    if (!topItem || contribution > topItem.contribution) {
      topItem = {
        itemId,
        contribution,
        name: stats.itemNames.get(itemId) ?? itemId,
      }
    }
  }
  return {
    side: stats.side,
    label: stats.label,
    damage: stats.damage,
    healing: stats.healing,
    shield: stats.shield,
    poisonDamage: stats.poisonDamage,
    statusEvents: stats.statusEvents,
    topItem,
  }
}

function statsForSide(side: ReviewSide, player: MutableSideStats, opponent: MutableSideStats) {
  return side === 'player' ? player : opponent
}

function normalizeReviewSide(side?: string): ReviewSide | null {
  return side === 'player' || side === 'opponent' ? side : null
}

function oppositeSide(side: ReviewSide): ReviewSide {
  return side === 'player' ? 'opponent' : 'player'
}

function hpDeltaForSide(event: BattleReviewEvent, side: ReviewSide) {
  if (event.target === 'both') return side === 'player' ? event.sourceHpDelta ?? 0 : event.targetHpDelta ?? 0
  if (event.actor === 'system') {
    if (event.target === side) {
      return side === 'player' ? event.sourceHpDelta ?? 0 : event.targetHpDelta ?? 0
    }
    return 0
  }
  if (event.actor === side) return event.sourceHpDelta ?? 0
  if (event.target === side) return event.targetHpDelta ?? 0
  return 0
}

function addItemContribution(stats: MutableSideStats, event: BattleReviewEvent, amount: number) {
  if (!event.itemId || amount <= 0) return
  stats.itemContribution.set(event.itemId, (stats.itemContribution.get(event.itemId) ?? 0) + amount)
}

function positiveAmount(event: BattleReviewEvent) {
  return Math.max(0, event.amount ?? 0)
}

function hasHpLoss(event: BattleReviewEvent) {
  return (event.sourceHpDelta ?? 0) < 0 || (event.targetHpDelta ?? 0) < 0
}

function isShieldEvent(event: BattleReviewEvent) {
  const text = event.text ?? ''
  return event.effectType === 'UTILITY' && (
    event.statusChanged?.includes('shield')
    || text.includes('护盾')
    || text.toLowerCase().includes('shield')
  )
}

function isStatusEvent(event: BattleReviewEvent) {
  const text = event.text ?? ''
  return Boolean(
    event.statusChanged?.length
    || event.effectType === 'POISON'
    || text.includes('中毒')
    || text.includes('虚弱')
    || text.includes('冻结')
    || text.includes('荆棘')
    || text.includes('伤口')
    || text.toLowerCase().includes('poison')
    || text.toLowerCase().includes('weak')
    || text.toLowerCase().includes('freeze'),
  )
}

function isEquipmentLinkEvent(event: BattleReviewEvent) {
  const text = event.text ?? ''
  return text.includes('相邻')
    || text.includes('装备')
    || text.includes('触发')
    || text.includes('失效')
    || text.toLowerCase().includes('adjacent')
    || text.toLowerCase().includes('item')
}
