export type FeedbackSide = 'player' | 'opponent' | 'system'
export type FeedbackAnchor =
  | 'item'
  | 'dice'
  | 'dog'
  | 'dog-avatar'
  | 'hp'
  | 'status'
  | 'status-positive'
  | 'status-negative'
  | 'equipment-row'
  | 'log'
  | 'screen'
export type PresentationKind = 'none' | 'roll' | 'damage' | 'heal' | 'shield' | 'poison' | 'weak' | 'freeze' | 'thorns' | 'miss' | 'utility'
export type FxPhase = 'source' | 'trail' | 'impact' | 'result' | 'log'
export type UiFeedbackTone = 'success' | 'danger' | 'info' | 'reward'
export type UiFeedbackKind =
  | 'buy-success'
  | 'gold-shortage'
  | 'reroll-success'
  | 'place-success'
  | 'place-failed'
  | 'upgrade-success'
  | 'upgrade-failed'
  | 'sell-success'
  | 'relic-sold'
  | 'reward-picked'
  | 'relic-picked'
  | 'enchant-applied'
  | 'battle-start'
  | 'action-failed'

export type FxAnchor = {
  anchor: FeedbackAnchor
  side: FeedbackSide
  id?: string
}

export type FxCue = {
  phase: FxPhase
  atMs: number
  durationMs: number
}

export type PresentationEvent = {
  kind: PresentationKind
  source: FxAnchor
  target: FxAnchor
  amount: number | null
  statusChanged: string[]
  logTone: PresentationKind
  timeline: FxCue[]
}

export type UiFeedbackEvent = {
  id: string
  kind: UiFeedbackKind
  tone: UiFeedbackTone
  label: string
  durationMs: number
}

type StatusLike = { type: string }
type StatusRowsLike = { positive?: readonly StatusLike[]; negative?: readonly StatusLike[] }
type BattleEventLike = {
  time?: number
  actor?: FeedbackSide | string
  kind?: string
  text?: string
  itemId?: string
  effectType?: string
  amount?: number
  target?: 'player' | 'opponent' | 'both' | 'none' | string
  targetHpDelta?: number
  playerShield?: number
  opponentShield?: number
  playerStatuses?: StatusRowsLike
  opponentStatuses?: StatusRowsLike
  statusChanged?: readonly string[]
}

export const uiFeedbackDurationMs = 560

const feedbackToneByKind: Record<UiFeedbackKind, UiFeedbackTone> = {
  'buy-success': 'success',
  'gold-shortage': 'danger',
  'reroll-success': 'info',
  'place-success': 'success',
  'place-failed': 'danger',
  'upgrade-success': 'reward',
  'upgrade-failed': 'danger',
  'sell-success': 'success',
  'relic-sold': 'success',
  'reward-picked': 'reward',
  'relic-picked': 'reward',
  'enchant-applied': 'reward',
  'battle-start': 'info',
  'action-failed': 'danger',
}

const defaultFeedbackLabel: Record<UiFeedbackKind, string> = {
  'buy-success': '购买成功',
  'gold-shortage': '金币不足',
  'reroll-success': '商店刷新',
  'place-success': '放置成功',
  'place-failed': '不能放这里',
  'upgrade-success': '升级成功',
  'upgrade-failed': '无法升级',
  'sell-success': '出售成功',
  'relic-sold': '遗物已出售',
  'reward-picked': '奖励已收入背包',
  'relic-picked': '遗物已获得',
  'enchant-applied': '附魔完成',
  'battle-start': '战斗开始',
  'action-failed': '操作失败',
}

export function createBattlePresentation(event?: BattleEventLike | null): PresentationEvent {
  const kind = battlePresentationKind(event)
  const source = battlePresentationSource(event, kind)
  const target = battlePresentationTarget(event, kind)
  const presentation: PresentationEvent = {
    kind,
    source,
    target,
    amount: typeof event?.amount === 'number' ? event.amount : null,
    statusChanged: [...(event?.statusChanged ?? [])],
    logTone: kind,
    timeline: [],
  }
  presentation.timeline = buildFxTimeline(presentation, false)
  return presentation
}

export function buildFxTimeline(presentation: Pick<PresentationEvent, 'kind'>, reducedMotion: boolean): FxCue[] {
  const base: FxCue[] = [
    { phase: 'source', atMs: 0, durationMs: 170 },
    { phase: 'trail', atMs: 110, durationMs: 260 },
    { phase: 'impact', atMs: 300, durationMs: 180 },
    { phase: 'result', atMs: 390, durationMs: 260 },
    { phase: 'log', atMs: 460, durationMs: 220 },
  ]
  if (presentation.kind === 'none') return []
  if (reducedMotion) return base.filter((step) => step.phase !== 'trail')
  return base
}

export function createUiFeedbackEvent(kind: UiFeedbackKind, label = defaultFeedbackLabel[kind]): UiFeedbackEvent {
  const randomPart = Math.random().toString(36).slice(2, 8)
  return {
    id: `${kind}-${Date.now()}-${randomPart}`,
    kind,
    tone: feedbackToneByKind[kind],
    label,
    durationMs: uiFeedbackDurationMs,
  }
}

function battlePresentationKind(event?: BattleEventLike | null): PresentationKind {
  if (!event) return 'none'
  if (event.kind === 'ROLL') return 'roll'
  if (event.effectType === 'DAMAGE') return event.targetHpDelta === 0 ? 'miss' : 'damage'
  if (event.effectType === 'HEAL') return 'heal'
  if (event.effectType === 'POISON' || event.kind === 'POISON') return 'poison'
  if (event.effectType === 'UTILITY') {
    const eventKind = utilityKindFromEvent(event)
    if (eventKind) return eventKind
    return 'utility'
  }
  return event.kind === 'END' ? 'none' : 'utility'
}

function utilityKindFromEvent(event: BattleEventLike): PresentationKind | null {
  const text = event.text ?? ''
  if (text.includes('护盾') || event.statusChanged?.includes('shield')) return 'shield'
  if (text.includes('虚弱') || event.statusChanged?.includes('weak')) return 'weak'
  if (text.includes('冻结') || event.statusChanged?.includes('freeze')) return 'freeze'
  if (text.includes('荆棘') || event.statusChanged?.includes('thorns')) return 'thorns'
  if (text.includes('失效') || text.toLowerCase().includes('control') || event.statusChanged?.includes('disabled') || event.statusChanged?.includes('control')) return 'freeze'
  return null
}

function battlePresentationSource(event: BattleEventLike | null | undefined, kind: PresentationKind): FxAnchor {
  const side = normalizeSide(event?.actor)
  if (kind === 'roll') return { anchor: 'dice', side }
  if (event?.itemId) return { anchor: 'item', side, id: event.itemId }
  return { anchor: side === 'system' ? 'screen' : 'dog', side }
}

function battlePresentationTarget(event: BattleEventLike | null | undefined, kind: PresentationKind): FxAnchor {
  if (kind === 'roll') return { anchor: 'dice', side: normalizeSide(event?.actor) }
  const targetSide = battlePresentationTargetSide(event, kind)
  if (!targetSide) return { anchor: 'screen', side: 'system' }
  if (kind === 'heal' || kind === 'shield') return { anchor: 'hp', side: targetSide }
  if (kind === 'poison' || kind === 'weak' || kind === 'freeze') return { anchor: 'status-negative', side: targetSide }
  if (kind === 'thorns') return { anchor: 'status-positive', side: targetSide }
  if (kind === 'utility' && isPositiveStatusUtilityEvent(event)) return { anchor: 'status-positive', side: targetSide }
  return { anchor: 'dog-avatar', side: targetSide }
}

export function battlePresentationTargetSide(event?: BattleEventLike | null, kind = battlePresentationKind(event)): 'player' | 'opponent' | null {
  if (!event) return null
  if (event.target === 'player' || event.target === 'opponent') return event.target
  const actor = normalizeSide(event.actor)
  if (kind === 'utility' && isPositiveStatusUtilityEvent(event) && (actor === 'player' || actor === 'opponent')) return actor
  if ((kind === 'heal' || kind === 'shield' || kind === 'thorns') && (actor === 'player' || actor === 'opponent')) return actor
  if (actor === 'player') return 'opponent'
  if (actor === 'opponent') return 'player'
  return null
}

function isPositiveStatusUtilityEvent(event?: BattleEventLike | null) {
  const positiveStatusTypes = new Set(['thorns', 'extraRoll', 'fury'])
  const text = event?.text ?? ''
  return event?.effectType === 'UTILITY' && (
    (event.statusChanged ?? []).some((status) => positiveStatusTypes.has(status))
    || text.includes('荆棘')
    || text.includes('激昂')
    || text.includes('加速')
  )
}

function normalizeSide(side: string | undefined): FeedbackSide {
  return side === 'player' || side === 'opponent' ? side : 'system'
}
