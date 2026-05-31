import {
  DOGS,
  itemDef,
  relicDef,
  relicDefForQuality,
  relicEffectScale,
  relicEmptyRollMisses,
  relicEquipmentEffectScale,
  relicOpeningThorns,
  relicPoisonTickBonus,
  relicRollBiasChance,
  SHIBA_POISON_ON_ROLL_AMOUNT,
  BOOM_COUNTER_TRIGGER_THRESHOLD,
  MULTI_TRIGGER_CAP,
  growthDamageBase,
  growthDamageStep,
  itemDefForQuality,
  kyushuBracerDamageBonus,
  kyushuBracerShieldBonus,
  nightPatrolLightTriggerCount,
  shatteredToothGearDamage,
  poisonBloodPumpHealPerTier,
  bitebackShieldGain,
  bitebackShieldDamageRatio,
  bitebackShieldDamageCap,
  barkproofEarmuffsThreshold,
  offbeatMetronomeReduction,
  offbeatMetronomeCooldown,
  bitterKibbleCleanseLimit,
  bitterKibbleShieldPerPoison,
  thornbreakerThornsRemoved,
  thornbreakerShieldDamageMultiplier,
  THORNS_DAMAGE_PER_STACK,
} from './data'
import { triggerOrder } from './grid'
import { normalizeQuality, qualityAmount, qualityAmountFrom, QUALITY_LABELS } from './quality'
import { createRng } from './rng'
import type {
  BattleEvent,
  BattleFighterSnapshot,
  BattleResult,
  BattleStatusRows,
  DogType,
  Enchantment,
  EnchantmentBaseEffect,
  EnchantmentGrantEffect,
  EnchantmentTarget,
  FighterSnapshot,
  GameItem,
  ItemDef,
  ItemQuality,
  BattleSafetyCode,
  BattleReservoirRows,
} from './types'

type Side = 'player' | 'opponent'
const BULLY_LARGE_EFFECT_CHANCE = 0.4
const EMPEROR_LUCKY_EFFECT_CHANCE = 0.5
const TRIGGER_QUEUE_CAP = 40
const EXTRA_ROLL_CHAIN_CAP = 12
const FREEZE_STACK_TRIGGER_THRESHOLD = 10
const MAX_BATTLE_TIME = 120
const TIME_EPSILON = 0.000001
const BASE_MAX_HP = 100
const EARLY_ROUND_HP_GROWTH = 20
const EARLY_HP_GROWTH_ROUNDS = 6
const MID_ROUND_HP_GROWTH = 60
const MID_HP_GROWTH_ROUNDS = 2
const LATE_ROUND_HP_GROWTH = 70

type HealthForDecision = {
  hp: number
  maxHp: number
}

type ItemTrigger = {
  itemId: string
  defId: string
  quality: ItemQuality
  effectType: ItemDef['effect']['type'] | 'POISON' | 'ROLL'
  amount: number
  target: Side | 'both' | 'none'
  sourceHp: number
  targetHp: number
  sourceHpDelta: number
  targetHpDelta: number
  text: string
  roll?: number
  multiIndex?: number
  multiTotal?: number
  targetItemId?: string
  boomCounterItemId?: string
  boomCounterValue?: number
  boomCounterMax?: number
  boomCounterChanged?: boolean
  freezeStackItemId?: string
  freezeStackValue?: number
  freezeStackMax?: number
  freezeStackChanged?: boolean
  safetyCode?: BattleSafetyCode
}

type TriggerQueueEntry = {
  item: GameItem
  allowExtraRollFanout: boolean
  allowLargeTriggerFanout: boolean
  multiIndex: number
  multiTotal: number
  chainEdgeIds: Set<string>
  source: 'roll' | 'reservoir' | 'fanout'
}

type MultiCountTransform = (item: GameItem, multiTotal: number) => number

type BattleSideState = {
  shield: number
  thorns: number
  weak: number
  wound: number
  poison: number
  maxHp: number
  rollCount: number
  emptyRolls: number
  missedLucky: number
  avalanche: number
  avalancheDamage: number
  freezeStacks: number
  frozenUntil: number
  disabledLarge: number
  disabledItemIds: string[]
  adjacentDamageBonus: Record<string, number>
  growthDamageByItemId: Record<string, number>
  lifestealItemIds: string[]
  itemTriggerCounts: Record<string, number>
  itemEffectBonus: Record<string, Partial<Record<EnchantmentBaseEffect, number>>>
  itemGrantedEffects: Record<string, { effect: EnchantmentGrantEffect; amount: number }[]>
  forcedItemDice: Record<string, number>
  shibaSpeedStacks: number
  furyStacks: number
  boomCountersByItemId: Record<string, number>
  smallTriggerCountersByItemId: Record<string, number>
  antiFrequencyStreak: number
  antiFrequencyLastAt: number | null
  disabledNextSmall: number
  antiMultiNextReadyByItemId: Record<string, number>
  frogRainyUntil: number
}

function maxHealthForRound(round: number) {
  const completedRounds = Math.max(0, Math.floor(round))
  const earlyRounds = Math.min(completedRounds, EARLY_HP_GROWTH_ROUNDS)
  const midRounds = Math.min(Math.max(0, completedRounds - EARLY_HP_GROWTH_ROUNDS), MID_HP_GROWTH_ROUNDS)
  const lateRounds = Math.max(0, completedRounds - EARLY_HP_GROWTH_ROUNDS - MID_HP_GROWTH_ROUNDS)
  return BASE_MAX_HP + earlyRounds * EARLY_ROUND_HP_GROWTH + midRounds * MID_ROUND_HP_GROWTH + lateRounds * LATE_ROUND_HP_GROWTH
}

function createSideState(maxHp: number): BattleSideState {
  return {
    shield: 0,
    thorns: 0,
    weak: 0,
    wound: 0,
    poison: 0,
    maxHp,
    rollCount: 0,
    emptyRolls: 0,
    missedLucky: 0,
    avalanche: 0,
    avalancheDamage: 50,
    freezeStacks: 0,
    frozenUntil: 0,
    disabledLarge: 0,
    disabledItemIds: [],
    adjacentDamageBonus: {},
    growthDamageByItemId: {},
    lifestealItemIds: [],
    itemTriggerCounts: {},
    itemEffectBonus: {},
    itemGrantedEffects: {},
    forcedItemDice: {},
    shibaSpeedStacks: 0,
    furyStacks: 0,
    boomCountersByItemId: {},
    smallTriggerCountersByItemId: {},
    antiFrequencyStreak: 0,
    antiFrequencyLastAt: null,
    disabledNextSmall: 0,
    antiMultiNextReadyByItemId: {},
    frogRainyUntil: 0,
  }
}

function roundBattleTime(time: number) {
  return Number(time.toFixed(3))
}

function rollDog(dogType: DogType, rng: () => number) {
  let roll = Math.floor(rng() * 6) + 1
  if (dogType === 'SHIBA' && rng() < 0.2) roll = Math.floor(rng() * 3) + 1
  if (dogType === 'SAMOYED' && rng() < 0.2) roll = Math.floor(rng() * 3) + 4
  return roll
}

function opponentOf(actor: Side): Side {
  return actor === 'player' ? 'opponent' : 'player'
}

export function resolveWinnerByHealthPercent(player: HealthForDecision, opponent: HealthForDecision): Side {
  const playerPercent = player.maxHp > 0 ? player.hp / player.maxHp : 0
  const opponentPercent = opponent.maxHp > 0 ? opponent.hp / opponent.maxHp : 0
  if (playerPercent !== opponentPercent) return playerPercent > opponentPercent ? 'player' : 'opponent'
  if (player.hp !== opponent.hp) return player.hp > opponent.hp ? 'player' : 'opponent'
  return 'player'
}

function relicsOf(fighter: FighterSnapshot) {
  return fighter.relics ?? []
}

function hasRelic(fighter: FighterSnapshot, effect: string) {
  return relicsOf(fighter).some((relic) => relicDef(relic.relicId).effect === effect)
}

function relicWithEffect(fighter: FighterSnapshot, effect: string) {
  return relicsOf(fighter).find((relic) => relicDef(relic.relicId).effect === effect) ?? null
}

function hasShieldStatusImmunity(fighter: FighterSnapshot, shield: number) {
  return shield > 0 && triggerOrder(fighter.items).some((item) => itemDef(item.defId).advancedEffect === 'SHIELD_IMMUNITY')
}

function toBattleSnapshot(fighter: FighterSnapshot): BattleFighterSnapshot {
  return {
    ...fighter,
    items: fighter.items.map((item) => {
      const quality = normalizeQuality(item.quality)
      return { ...item, quality, def: itemDefForQuality(item.defId, quality) }
    }),
    relics: relicsOf(fighter).map((relic) => ({ ...relic, quality: normalizeQuality(relic.quality), def: relicDefForQuality(relic.relicId, relic.quality) })),
  }
}

function isLarge(def: ItemDef, actor: FighterSnapshot) {
  const sizeThreeIsLarge = hasEquippedEffect(actor, 'SIZE_THREE_IS_LARGE')
  return def.size === 4 || (sizeThreeIsLarge && def.size === 3)
}

function equippedItemsWithEffect(actor: FighterSnapshot, effect: string) {
  return triggerOrder(actor.items).filter((item) => itemDef(item.defId).advancedEffect === effect)
}

function hasEquippedEffect(actor: FighterSnapshot, effect: string) {
  return equippedItemsWithEffect(actor, effect).length > 0
}

function isAdjacentToEffect(actor: FighterSnapshot, item: GameItem, effect: string) {
  return equippedItemsWithEffect(actor, effect).some((source) => adjacentItems(actor, source).some((adjacent) => adjacent.id === item.id))
}

function extraEnchantDice(enchant?: Enchantment | null) {
  return enchant?.kind === 'EXTRA_DICE' ? enchant.dice : []
}

function itemBaseTriggerDice(item: GameItem, def: ItemDef) {
  return item.triggerDiceOverride && item.triggerDiceOverride.length > 0 ? item.triggerDiceOverride : def.dice
}

function shiftDieUp(die: number) {
  return die >= 6 ? 1 : die + 1
}

function shiftDieDown(die: number) {
  return die <= 1 ? 6 : die - 1
}

function triggerDiceContext(actor: FighterSnapshot, item: GameItem) {
  const def = itemDef(item.defId)
  let dice = [...itemBaseTriggerDice(item, def), ...extraEnchantDice(item.enchant)]
  const notes: string[] = []
  if (hasRelic(actor, 'SHIFT_TRIGGER_DICE_UP')) {
    dice = dice.map(shiftDieUp)
    notes.push('（胡萝卜改点）')
  }
  if (hasRelic(actor, 'SHIFT_TRIGGER_DICE_DOWN')) {
    dice = dice.map(shiftDieDown)
    notes.push('（纸巾改点）')
  }
  return { dice: [...new Set(dice)], note: notes.join('') }
}

function matchingContext(actor: FighterSnapshot, item: GameItem, roll: number, forcedItemDice: Record<string, number> = {}) {
  const def = itemDef(item.defId)
  if (def.advancedEffect === 'GRANT_LIFESTEAL_ADJACENT') return { matches: false, scale: 1, note: '', triggeredBySize: false }
  const triggerDice = triggerDiceContext(actor, item)
  const forcedDie = forcedItemDice[item.id]
  if (forcedDie != null) return { matches: roll === forcedDie, scale: 1, note: roll === forcedDie ? '（圣旨改点）' : '', triggeredBySize: false }

  if (actor.dogType === 'EMPEROR' && actor.luckyNumber && isAdjacentToEffect(actor, item, 'ADJACENT_USES_LUCKY')) {
    return { matches: roll === actor.luckyNumber, scale: 1, note: roll === actor.luckyNumber ? '（垂帘听政）' : '', triggeredBySize: false }
  }

  if (triggerDice.dice.includes(roll)) return { matches: true, scale: 1, note: triggerDice.note || (item.enchant?.kind === 'EXTRA_DICE' && !def.dice.includes(roll) ? '（附魔改点）' : ''), triggeredBySize: false }

  const bigToSmall = relicWithEffect(actor, 'MIRROR_BIG_TO_SMALL')
  if (bigToSmall && roll <= 3 && triggerDice.dice.includes(roll + 3)) {
    return { matches: true, scale: relicEffectScale(bigToSmall.relicId, bigToSmall.quality), note: '（点金手·左映射）', triggeredBySize: false }
  }
  const smallToBig = relicWithEffect(actor, 'MIRROR_SMALL_TO_BIG')
  if (smallToBig && roll >= 4 && triggerDice.dice.includes(roll - 3)) {
    return { matches: true, scale: relicEffectScale(smallToBig.relicId, smallToBig.quality), note: '（点金手·右映射）', triggeredBySize: false }
  }
  if (triggerOrder(actor.items).some((item) => itemDef(item.defId).advancedEffect === 'TRIGGER_BY_SIZE') && def.size === roll) {
    return { matches: true, scale: 1, note: '（按容量触发）', triggeredBySize: true }
  }
  return { matches: false, scale: 1, note: '', triggeredBySize: false }
}

function restrictRollByRelic(fighter: FighterSnapshot, roll: number) {
  if (hasRelic(fighter, 'ONLY_BIG_HALF_EFFECT') && roll <= 3) return roll + 3
  if (hasRelic(fighter, 'ONLY_SMALL_HALF_EFFECT') && roll >= 4) return roll - 3
  return roll
}

function biasRollByRelic(fighter: FighterSnapshot, roll: number, rng: () => number) {
  const extremeBias = relicWithEffect(fighter, 'EXTREME_ROLL_BIAS')
  if (extremeBias && rng() < relicRollBiasChance(extremeBias.relicId, extremeBias.quality)) return rng() < 0.5 ? 1 : 6
  const middleBias = relicWithEffect(fighter, 'MIDDLE_ROLL_BIAS')
  if (middleBias && rng() < relicRollBiasChance(middleBias.relicId, middleBias.quality)) return rng() < 0.5 ? 3 : 4
  return roll
}

function globalEffectScale(actor: FighterSnapshot) {
  const halfDie = relicWithEffect(actor, 'ONLY_BIG_HALF_EFFECT') ?? relicWithEffect(actor, 'ONLY_SMALL_HALF_EFFECT')
  let scale = halfDie ? relicEffectScale(halfDie.relicId, halfDie.quality) : 1
  const extraEquipment = relicWithEffect(actor, 'EXTRA_EQUIPMENT_REDUCED_EFFECT')
  if (extraEquipment) scale *= relicEquipmentEffectScale(extraEquipment.relicId, extraEquipment.quality)
  return scale
}

function adjacentItems(actor: FighterSnapshot, item: GameItem) {
  const ordered = triggerOrder(actor.items)
  return ordered.filter((candidate) => candidate.id !== item.id && Math.abs(candidate.x - item.x) <= itemDef(item.defId).width)
}

function bloodContractAdjacentItems(actor: FighterSnapshot, item: GameItem, quality: ItemQuality) {
  const itemLeft = item.x
  const itemRight = item.x + itemDef(item.defId).width
  return triggerOrder(actor.items).filter((candidate) => {
    if (candidate.id === item.id) return false
    const candidateLeft = candidate.x
    const candidateRight = candidate.x + itemDef(candidate.defId).width
    const touchesLeft = candidateRight === itemLeft
    const touchesRight = candidateLeft === itemRight
    return quality === 'DIAMOND' ? touchesLeft || touchesRight : touchesLeft
  })
}

function isMultiItem(item: GameItem) {
  return (itemDef(item.defId).multi ?? 1) > 1
}

function multiAdjacentBonusApplies(source: GameItem, target: GameItem) {
  const sourceQuality = normalizeQuality(source.quality)
  const sourceLeft = source.x
  const sourceRight = source.x + itemDef(source.defId).width
  const targetLeft = target.x
  const targetRight = target.x + itemDef(target.defId).width
  const targetTouchesSourceLeft = targetRight === sourceLeft
  const targetTouchesSourceRight = targetLeft === sourceRight
  return sourceQuality === 'DIAMOND'
    ? targetTouchesSourceLeft || targetTouchesSourceRight
    : targetTouchesSourceLeft
}

function effectiveMultiCount(actor: FighterSnapshot, item: GameItem) {
  const base = itemDef(item.defId).multi ?? 1
  if (base <= 1) return 1
  const bonus = triggerOrder(actor.items).filter((source) =>
    itemDef(source.defId).advancedEffect === 'MULTI_ADJACENT_BONUS' && multiAdjacentBonusApplies(source, item),
  ).length
  return Math.min(MULTI_TRIGGER_CAP, base + bonus)
}

function neighborItems(actor: FighterSnapshot, item: GameItem, target: EnchantmentTarget) {
  if (target === 'ADJACENT') return adjacentItems(actor, item)
  const ordered = triggerOrder(actor.items)
  const index = ordered.findIndex((candidate) => candidate.id === item.id)
  if (index < 0) return []
  const neighbor = target === 'LEFT' ? ordered[index - 1] : ordered[index + 1]
  return neighbor ? [neighbor] : []
}

function queueItems(
  queue: TriggerQueueEntry[],
  actor: FighterSnapshot,
  items: GameItem[],
  allowExtraRollFanout = true,
  allowLargeTriggerFanout = true,
  chainEdgeIds?: Set<string>,
  sourceItemId?: string,
  multiCountTransform?: MultiCountTransform,
  source: TriggerQueueEntry['source'] = sourceItemId ? 'fanout' : 'roll',
) {
  const transformedMultiCount = (item: GameItem) => {
    const base = effectiveMultiCount(actor, item)
    const transformed = multiCountTransform ? multiCountTransform(item, base) : base
    return Math.max(1, Math.min(MULTI_TRIGGER_CAP, Math.floor(transformed)))
  }

  if (!sourceItemId) {
    for (const item of items) {
      const multiTotal = transformedMultiCount(item)
      for (let multiIndex = 1; multiIndex <= multiTotal; multiIndex += 1) {
        queue.push({ item, allowExtraRollFanout, allowLargeTriggerFanout, multiIndex, multiTotal, chainEdgeIds: new Set(), source })
      }
    }
    return
  }

  const rootChainEdgeIds = chainEdgeIds ?? new Set<string>()
  const blockedEdgeIds = new Set(rootChainEdgeIds)
  const newEdgeIds = new Set<string>()
  for (const item of items) {
    const edgeId = `${sourceItemId}->${item.id}`
    if (blockedEdgeIds.has(edgeId)) continue
    newEdgeIds.add(edgeId)
    const multiTotal = transformedMultiCount(item)
    for (let multiIndex = 1; multiIndex <= multiTotal; multiIndex += 1) {
      queue.push({ item, allowExtraRollFanout, allowLargeTriggerFanout, multiIndex, multiTotal, chainEdgeIds: rootChainEdgeIds, source: 'fanout' })
    }
  }
  for (const edgeId of newEdgeIds) rootChainEdgeIds.add(edgeId)
}

function itemBaseEffectKind(def: ItemDef): EnchantmentBaseEffect | null {
  if (def.effect.type === 'DAMAGE' || def.effect.type === 'DAMAGE_SELF_SHIELD') return 'DAMAGE'
  if (def.effect.type === 'HEAL') return 'HEAL'
  if (def.advancedEffect === 'GAIN_SHIELD' || def.advancedEffect === 'GAIN_SHIELD_THORNS' || def.advancedEffect === 'SHIELD_ON_NON_LUCKY' || def.advancedEffect === 'SHIELD_IMMUNITY') return 'SHIELD'
  return null
}

function itemName(def: ItemDef, quality: ItemQuality) {
  return quality === 'BRONZE' ? def.name : `${QUALITY_LABELS[quality]}${def.name}`
}

function roundScaled(amount: number, scale: number) {
  return Math.max(0, Math.round(amount * scale))
}

type ReservoirRuntime = {
  item: GameItem
  nextAt: number
  duration: number
  lastResetAt: number
}

const FROG_STARTING_RESERVOIR_PROGRESS = 0.5

export function simulateBattle(player: FighterSnapshot, opponent: FighterSnapshot, seed: string): BattleResult {
  const rng = createRng(seed)
  const playerMaxHp = maxHealthForRound(player.round)
  const opponentMaxHp = maxHealthForRound(opponent.round)
  const state: Record<Side, BattleSideState> = { player: createSideState(playerMaxHp), opponent: createSideState(opponentMaxHp) }
  let playerHp = playerMaxHp
  let opponentHp = opponentMaxHp
  const events: BattleEvent[] = []
  const playerSnapshot = toBattleSnapshot(player)
  const opponentSnapshot = toBattleSnapshot(opponent)
  const reservoirs: Record<Side, Record<string, ReservoirRuntime>> = { player: {}, opponent: {} }

  const reservoirSpeedMultiplier = (side: Side, time: number) => {
    const fighter = side === 'player' ? player : opponent
    if (fighter.dogType !== 'FROG') return 1
    let speed = hasEquippedEffect(fighter, 'FROG_RESERVOIR_SPEED') ? 1.15 : 1
    if (state[side].frogRainyUntil > time + TIME_EPSILON) speed *= 1.5
    return speed
  }

  const reservoirDuration = (side: Side, item: GameItem, time: number) => {
    const fighter = side === 'player' ? player : opponent
    const diceCount = triggerDiceContext(fighter, item).dice.length
    if (diceCount <= 0) return null
    const speed = reservoirSpeedMultiplier(side, time)
    return Math.max(0.5, 6 / diceCount / speed)
  }

  const refreshReservoir = (side: Side, item: GameItem, time: number, progress = 0) => {
    const duration = reservoirDuration(side, item, time)
    if (duration == null) return
    const clampedProgress = Math.max(0, progress)
    reservoirs[side][item.id] = {
      item,
      duration,
      lastResetAt: roundBattleTime(time - duration * clampedProgress),
      nextAt: roundBattleTime(clampedProgress >= 1 ? time : time + duration * (1 - clampedProgress)),
    }
  }

  const reservoirProgress = (entry: ReservoirRuntime, time: number) => Math.max(0, (time - entry.lastResetAt) / entry.duration)

  const reservoirRows = (time: number): BattleReservoirRows => {
    const rows = (side: Side) => Object.values(reservoirs[side])
      .sort((left, right) => left.item.x - right.item.x)
      .map((entry) => {
        const duration = reservoirDuration(side, entry.item, time) ?? entry.duration
        const progress = Math.max(0, Math.min(1, reservoirProgress(entry, time)))
        return {
          itemId: entry.item.id,
          duration: roundBattleTime(duration),
          progress: roundBattleTime(progress),
          nextAt: entry.nextAt,
          speedMultiplier: roundBattleTime(reservoirSpeedMultiplier(side, time)),
        }
      })
    return { player: rows('player'), opponent: rows('opponent') }
  }

  const resetReservoir = (side: Side, item: GameItem, time: number) => {
    const entry = reservoirs[side][item.id]
    const overflowProgress = entry ? Math.max(0, reservoirProgress(entry, time) - 1) : 0
    refreshReservoir(side, item, time, Math.min(0.999, overflowProgress))
  }

  const chargeReservoir = (side: Side, item: GameItem, time: number, amount: number) => {
    const entry = reservoirs[side][item.id]
    if (!entry) return
    const currentProgress = reservoirProgress(entry, time)
    refreshReservoir(side, item, time, currentProgress + amount)
  }

  const poisonTickDamage = (side: Side) => {
    if (state[side].poison <= 0) return 0
    const poisonedBy = side === 'player' ? opponent : player
    const poisonBonusRelic = relicWithEffect(poisonedBy, 'POISON_TICK_BONUS')
    return state[side].poison + (poisonBonusRelic ? relicPoisonTickBonus(poisonBonusRelic.relicId, poisonBonusRelic.quality) : 0)
  }

  const statusRows = (side: Side, time = 0): BattleStatusRows => {
    const disabledCount = state[side].disabledLarge + state[side].disabledItemIds.length
    const frozenRemaining = Math.max(0, state[side].frozenUntil - time)
    return {
      positive: [
        ...(state[side].thorns > 0 ? [{ type: 'thorns' as const, label: '荆棘', tone: 'positive' as const, stacks: state[side].thorns }] : []),
        ...(state[side].shibaSpeedStacks > 0 ? [{ type: 'extraRoll' as const, label: '加速', tone: 'positive' as const, stacks: state[side].shibaSpeedStacks }] : []),
        ...(state[side].furyStacks > 0 ? [{ type: 'fury' as const, label: '激昂', tone: 'positive' as const, stacks: state[side].furyStacks }] : []),
      ],
      negative: [
        ...(state[side].poison > 0 ? [{ type: 'poison' as const, label: '中毒', tone: 'negative' as const, stacks: state[side].poison, nextTickIn: 1, tickDamage: poisonTickDamage(side) }] : []),
        ...(state[side].weak > 0 ? [{ type: 'weak' as const, label: '虚弱', tone: 'negative' as const, stacks: state[side].weak }] : []),
        ...(state[side].wound > 0 ? [{ type: 'wound' as const, label: '伤口', tone: 'negative' as const, stacks: state[side].wound }] : []),
        ...(frozenRemaining > 0 ? [{ type: 'freeze' as const, label: '冻结', tone: 'negative' as const, remaining: roundBattleTime(frozenRemaining) }] : []),
        ...(disabledCount > 0 ? [{ type: 'disabled' as const, label: '失效', tone: 'negative' as const, amount: disabledCount }] : []),
      ],
    }
  }

  const push = (event: Omit<BattleEvent, 'playerHp' | 'opponentHp' | 'playerMaxHp' | 'opponentMaxHp' | 'playerShield' | 'opponentShield' | 'playerStatuses' | 'opponentStatuses'>) => {
    events.push({
      ...event,
      playerHp: Math.max(0, playerHp),
      opponentHp: Math.max(0, opponentHp),
      playerMaxHp: state.player.maxHp,
      opponentMaxHp: state.opponent.maxHp,
      playerShield: Math.max(0, state.player.shield),
      opponentShield: Math.max(0, state.opponent.shield),
      playerStatuses: statusRows('player', event.time),
      opponentStatuses: statusRows('opponent', event.time),
      reservoirs: reservoirRows(event.time),
    })
  }

  const getHp = (side: Side) => side === 'player' ? playerHp : opponentHp
  const setHp = (side: Side, hp: number) => {
    if (side === 'player') playerHp = hp
    else opponentHp = hp
  }

  const applyDamage = (target: Side, amount: number, shieldDamage = amount) => {
    const before = getHp(target)
    const shieldBefore = state[target].shield
    const shieldUsed = Math.min(shieldBefore, shieldDamage)
    state[target].shield -= shieldUsed
    const absorbedHealthDamage = shieldBefore > 0 ? Math.min(amount, shieldUsed) : 0
    const after = Math.max(0, before - (amount - absorbedHealthDamage))
    setHp(target, after)
    return { before, after, delta: after - before }
  }

  const applyAttackDamage = (target: Side, amount: number, shieldDamage = amount) => {
    const woundBonus = state[target].wound
    return applyDamage(target, amount + woundBonus, shieldDamage + woundBonus)
  }

  const applyDirectHealthDamage = (target: Side, amount: number) => {
    const before = getHp(target)
    const after = Math.max(0, before - amount)
    setHp(target, after)
    return { before, after, delta: after - before }
  }

  const applyHeal = (side: Side, amount: number) => {
    const before = getHp(side)
    const after = Math.min(state[side].maxHp, before + amount)
    setHp(side, after)
    return { before, after, delta: after - before }
  }

  const applyShield = (side: Side, amount: number) => {
    state[side].shield += amount
  }

  const statusAmountAfterShieldMitigation = (target: Side, targetFighter: FighterSnapshot, amount: number) => {
    if (hasShieldStatusImmunity(targetFighter, state[target].shield)) return 0
    return amount
  }

  const addPoison = (target: Side, targetFighter: FighterSnapshot, amount: number) => {
    const applied = statusAmountAfterShieldMitigation(target, targetFighter, amount)
    if (applied <= 0) return 0
    state[target].poison += applied
    return applied
  }

  const poisonOnAttackHitTriggers = (
    actorSide: Side,
    actor: FighterSnapshot,
    targetSide: Side,
    targetFighter: FighterSnapshot,
    roll: number,
  ): ItemTrigger[] => {
    const triggers: ItemTrigger[] = []
    for (const passive of equippedItemsWithEffect(actor, 'POISON_ON_ATTACK_HIT')) {
      const passiveDef = itemDef(passive.defId)
      const passiveQuality = normalizeQuality(passive.quality)
      const passiveAmount = qualityAmountFrom(passiveDef.effect.amount, passiveQuality, passiveDef.effect.qualityBase)
      const appliedPoison = addPoison(targetSide, targetFighter, passiveAmount)
      if (appliedPoison <= 0) continue
      triggers.push({
        itemId: passive.id,
        defId: passive.defId,
        quality: passiveQuality,
        effectType: 'POISON',
        amount: appliedPoison,
        target: targetSide,
        sourceHp: getHp(actorSide),
        targetHp: getHp(targetSide),
        sourceHpDelta: 0,
        targetHpDelta: 0,
        roll,
        text: `${itemName(passiveDef, passiveQuality)} 攻击命中，施加 ${appliedPoison} 层【中毒】`,
      })
    }
    return triggers
  }

  const addWeak = (target: Side, targetFighter: FighterSnapshot, amount: number) => {
    const applied = statusAmountAfterShieldMitigation(target, targetFighter, amount)
    if (applied <= 0) return 0
    state[target].weak += applied
    return applied
  }

  const addWound = (target: Side, amount: number) => {
    const applied = Math.max(0, amount)
    if (applied <= 0) return 0
    state[target].wound += applied
    return applied
  }

  const stealPositiveBuff = (actorSide: Side, targetSide: Side) => {
    if (state[targetSide].thorns > 0) {
      state[targetSide].thorns -= 1
      state[actorSide].thorns += 1
      return '荆棘'
    }
    if (state[targetSide].shibaSpeedStacks > 0) {
      state[targetSide].shibaSpeedStacks -= 1
      state[actorSide].shibaSpeedStacks += 1
      return '加速'
    }
    return null
  }

  const purgePositiveBuffs = (target: Side, maxLayers: number) => {
    let remaining = Math.max(0, maxLayers)
    let removed = 0
    const targetState = state[target]
    const removeLayers = (available: number) => {
      const layers = Math.min(available, remaining)
      remaining -= layers
      removed += layers
      return layers
    }

    if (remaining > 0 && targetState.thorns > 0) {
      targetState.thorns -= removeLayers(targetState.thorns)
    }
    if (remaining > 0 && targetState.shibaSpeedStacks > 0) {
      targetState.shibaSpeedStacks -= removeLayers(targetState.shibaSpeedStacks)
    }
    if (remaining > 0 && targetState.shield >= 8) {
      const shieldLayers = removeLayers(Math.floor(targetState.shield / 8))
      targetState.shield -= shieldLayers * 8
    }

    return removed
  }

  const playerOpeningThorns = relicWithEffect(player, 'OPENING_THORNS')
  const opponentOpeningThorns = relicWithEffect(opponent, 'OPENING_THORNS')
  if (playerOpeningThorns) state.player.thorns += relicOpeningThorns(playerOpeningThorns.relicId, playerOpeningThorns.quality)
  if (opponentOpeningThorns) state.opponent.thorns += relicOpeningThorns(opponentOpeningThorns.relicId, opponentOpeningThorns.quality)
  const applyOpeningForceLucky = (source: FighterSnapshot) => {
    if (source.dogType !== 'EMPEROR' || !source.luckyNumber || !hasEquippedEffect(source, 'OPENING_FORCE_LUCKY')) return
    for (const side of ['player', 'opponent'] as const) {
      const target = side === 'player' ? player : opponent
      for (const item of triggerOrder(target.items).slice(0, 2)) state[side].forcedItemDice[item.id] = source.luckyNumber
    }
  }
  applyOpeningForceLucky(player)
  applyOpeningForceLucky(opponent)

  const applyBloodContractAura = (side: Side, actor: FighterSnapshot) => {
    const actorState = state[side]
    for (const item of equippedItemsWithEffect(actor, 'GRANT_LIFESTEAL_ADJACENT')) {
      const quality = normalizeQuality(item.quality)
      const def = itemDef(item.defId)
      const recipients = bloodContractAdjacentItems(actor, item, quality)
      for (const recipient of recipients) {
        if (!actorState.lifestealItemIds.includes(recipient.id)) actorState.lifestealItemIds.push(recipient.id)
      }
      if (recipients.length <= 0) continue
      push({
        time: 0,
        actor: side,
        kind: 'ITEM',
        itemId: item.id,
        defId: item.defId,
        quality,
        effectType: 'UTILITY',
        amount: recipients.length,
        target: side,
        sourceHpDelta: 0,
        targetHpDelta: 0,
        text: `${itemName(def, quality)} 光环使${quality === 'DIAMOND' ? '左右【相邻】' : '左侧'}装备获得【吸血】`,
      })
    }
  }
  applyBloodContractAura('player', player)
  applyBloodContractAura('opponent', opponent)

  for (const side of ['player', 'opponent'] as const) {
    const fighter = side === 'player' ? player : opponent
    if (fighter.dogType !== 'FROG') continue
    for (const item of triggerOrder(fighter.items)) refreshReservoir(side, item, 0, FROG_STARTING_RESERVOIR_PROGRESS)
  }

  const antiMultiTransform = (time: number, actorSide: Side): MultiCountTransform => (_item, multiTotal) => {
    if (multiTotal <= 1) return multiTotal
    const defenderSide = opponentOf(actorSide)
    const defender = defenderSide === 'player' ? player : opponent
    const defenderState = state[defenderSide]
    for (const source of equippedItemsWithEffect(defender, 'ANTI_MULTI_SUPPRESS')) {
      const readyAt = defenderState.antiMultiNextReadyByItemId[source.id] ?? 0
      if (time + TIME_EPSILON < readyAt) continue
      const sourceQuality = normalizeQuality(source.quality)
      const reduction = offbeatMetronomeReduction(sourceQuality)
      const cooldown = offbeatMetronomeCooldown(sourceQuality)
      defenderState.antiMultiNextReadyByItemId[source.id] = Number.isFinite(cooldown) ? roundBattleTime(time + cooldown) : Number.POSITIVE_INFINITY
      return Math.max(1, multiTotal - reduction)
    }
    return multiTotal
  }

  const queueBattleItems = (
    queue: TriggerQueueEntry[],
    actorSide: Side,
    actor: FighterSnapshot,
    items: GameItem[],
    time: number,
    allowExtraRollFanout = true,
    allowLargeTriggerFanout = true,
    chainEdgeIds?: Set<string>,
    sourceItemId?: string,
    source: TriggerQueueEntry['source'] = sourceItemId ? 'fanout' : 'roll',
  ) => queueItems(queue, actor, items, allowExtraRollFanout, allowLargeTriggerFanout, chainEdgeIds, sourceItemId, antiMultiTransform(time, actorSide), source)

  const executeItem = (
    actorSide: Side,
    actor: FighterSnapshot,
    item: GameItem,
    time: number,
    roll: number,
    scale: number,
    note: string,
    queue: TriggerQueueEntry[],
    processed: { count: number; capped: boolean; extraRollRequests: number; frogRollRequests: number },
    extra: boolean,
    extraDepth: number,
    allowExtraRollFanout: boolean,
    allowLargeTriggerFanout: boolean,
    frogClassRoll: boolean,
    chainEdgeIds: Set<string>,
    multiIndex: number,
    multiTotal: number,
    triggerSource: TriggerQueueEntry['source'],
  ): ItemTrigger[] => {
    const targetSide = opponentOf(actorSide)
    const targetFighter = targetSide === 'player' ? player : opponent
    const def = itemDef(item.defId)
    const quality = normalizeQuality(item.quality)
    const triggers: ItemTrigger[] = []
    const actorState = state[actorSide]
    const targetState = state[targetSide]
    const advanced = def.advancedEffect ?? 'NONE'
    const finishTriggers = () => triggers.map((trigger) => ({ ...trigger, multiIndex, multiTotal }))
    if (advanced === 'GRANT_LIFESTEAL_ADJACENT') return triggers
    const recoveryBlocked = time <= 10 && hasEquippedEffect(actor, 'DOUBLE_RATE_FIRST_TEN')
    const sacrificeReplacesSmallEffect = def.size === 1
      && triggerOrder(actor.items).some((entry) => itemDef(entry.defId).advancedEffect === 'SMALL_TRIGGERS_LARGE')

    const disabledItemIndex = actorState.disabledItemIds.indexOf(item.id)
    if (disabledItemIndex >= 0) {
      actorState.disabledItemIds.splice(disabledItemIndex, 1)
      triggers.push({
        itemId: item.id,
        defId: item.defId,
        quality,
        effectType: 'UTILITY',
        amount: 0,
        target: 'none',
        sourceHp: getHp(actorSide),
        targetHp: getHp(targetSide),
        sourceHpDelta: 0,
        targetHpDelta: 0,
        roll,
        text: `${itemName(def, quality)} 被【失效】抵消`,
      })
      return finishTriggers()
    }

    if (actorState.disabledLarge > 0 && isLarge(def, actor)) {
      actorState.disabledLarge -= 1
      triggers.push({
        itemId: item.id,
        defId: item.defId,
        quality,
        effectType: 'UTILITY',
        amount: 0,
        target: 'none',
        sourceHp: getHp(actorSide),
        targetHp: getHp(targetSide),
        sourceHpDelta: 0,
        targetHpDelta: 0,
        roll,
        text: `${itemName(def, quality)} 被【失效】抵消`,
      })
      return finishTriggers()
    }

    if (actorState.disabledNextSmall > 0 && def.size === 1) {
      actorState.disabledNextSmall -= 1
      triggers.push({
        itemId: item.id,
        defId: item.defId,
        quality,
        effectType: 'UTILITY',
        amount: 0,
        target: 'none',
        sourceHp: getHp(actorSide),
        targetHp: getHp(targetSide),
        sourceHpDelta: 0,
        targetHpDelta: 0,
        roll,
        text: `${itemName(def, quality)} 被【失效】抵消`,
      })
      return finishTriggers()
    }

    if (advanced === 'BOOM_COUNTER') return triggers

    const boomCounterItems = equippedItemsWithEffect(actor, 'BOOM_COUNTER')
    if (!sacrificeReplacesSmallEffect) {
      for (const boomCounterItem of boomCounterItems) {
        const nextCount = (actorState.boomCountersByItemId[boomCounterItem.id] ?? 0) + 1
        actorState.boomCountersByItemId[boomCounterItem.id] = nextCount
        const boomCounterSignal = {
          boomCounterItemId: boomCounterItem.id,
          boomCounterValue: nextCount,
          boomCounterMax: BOOM_COUNTER_TRIGGER_THRESHOLD,
          boomCounterChanged: true,
        }
        if (nextCount >= BOOM_COUNTER_TRIGGER_THRESHOLD) {
          actorState.boomCountersByItemId[boomCounterItem.id] = 0
          boomCounterSignal.boomCounterValue = 0
          const boomQuality = normalizeQuality(boomCounterItem.quality)
          const boomDef = itemDef(boomCounterItem.defId)
          const damage = qualityAmountFrom(boomDef.effect.amount, boomQuality, boomDef.effect.qualityBase)
          const result = applyDirectHealthDamage(targetSide, damage)
          triggers.push({
            itemId: boomCounterItem.id,
            defId: boomCounterItem.defId,
            quality: boomQuality,
            effectType: 'DAMAGE',
            amount: result.before - result.after,
            target: targetSide,
            sourceHp: getHp(actorSide),
            targetHp: result.after,
            sourceHpDelta: 0,
            targetHpDelta: result.delta,
            roll,
            ...boomCounterSignal,
            text: `${itemName(boomDef, boomQuality)} 【爆鸣计数】达到 ${BOOM_COUNTER_TRIGGER_THRESHOLD}，造成 ${result.before - result.after} 点直接伤害`,
          })
        } else {
          const boomQuality = normalizeQuality(boomCounterItem.quality)
          const boomDef = itemDef(boomCounterItem.defId)
          triggers.push({
            itemId: boomCounterItem.id,
            defId: boomCounterItem.defId,
            quality: boomQuality,
            effectType: 'UTILITY',
            amount: 1,
            target: actorSide,
            sourceHp: getHp(actorSide),
            targetHp: getHp(targetSide),
            sourceHpDelta: 0,
            targetHpDelta: 0,
            roll,
            ...boomCounterSignal,
            text: `${itemName(boomDef, boomQuality)} 【爆鸣计数】 +${nextCount}/${BOOM_COUNTER_TRIGGER_THRESHOLD}`,
          })
        }
      }
    }

    if (!sacrificeReplacesSmallEffect) {
      if (def.size === 1 && advanced !== 'SMALL_TRIGGER_COUNTER') {
        for (const counterItem of equippedItemsWithEffect(actor, 'SMALL_TRIGGER_COUNTER')) {
          if (counterItem.id === item.id) continue
          const counterQuality = normalizeQuality(counterItem.quality)
          const counterDef = itemDef(counterItem.defId)
          const nextCount = (actorState.smallTriggerCountersByItemId[counterItem.id] ?? 0) + 1
          if (nextCount >= 4) {
            actorState.smallTriggerCountersByItemId[counterItem.id] = 0
            const damage = shatteredToothGearDamage(counterQuality)
            const result = applyDirectHealthDamage(targetSide, damage)
            triggers.push({
              itemId: counterItem.id,
              defId: counterItem.defId,
              quality: counterQuality,
              effectType: 'DAMAGE',
              amount: result.before - result.after,
              target: targetSide,
              sourceHp: getHp(actorSide),
              targetHp: result.after,
              sourceHpDelta: 0,
              targetHpDelta: result.delta,
              roll,
              text: `${itemName(counterDef, counterQuality)} 碎牙计数达到 4 次，造成 ${result.before - result.after} 点直接伤害`,
            })
          } else {
            actorState.smallTriggerCountersByItemId[counterItem.id] = nextCount
            triggers.push({
              itemId: counterItem.id,
              defId: counterItem.defId,
              quality: counterQuality,
              effectType: 'UTILITY',
              amount: nextCount,
              target: actorSide,
              sourceHp: getHp(actorSide),
              targetHp: getHp(targetSide),
              sourceHpDelta: 0,
              targetHpDelta: 0,
              roll,
              text: `${itemName(counterDef, counterQuality)} 碎牙计数 +${nextCount}/4`,
            })
          }
        }
      }

      const antiFrequencyItems = equippedItemsWithEffect(targetFighter, 'ANTI_FREQUENCY_DISABLE_SMALL')
      if (antiFrequencyItems.length > 0) {
        actorState.antiFrequencyStreak = actorState.antiFrequencyLastAt == null || time - actorState.antiFrequencyLastAt <= 2 + TIME_EPSILON
          ? actorState.antiFrequencyStreak + 1
          : 1
        actorState.antiFrequencyLastAt = time
        const bestThreshold = Math.min(...antiFrequencyItems.map((source) => barkproofEarmuffsThreshold(normalizeQuality(source.quality))))
        if (actorState.antiFrequencyStreak >= bestThreshold) {
          actorState.antiFrequencyStreak = 0
          actorState.disabledNextSmall += 1
          const source = antiFrequencyItems
            .map((entry) => ({ entry, threshold: barkproofEarmuffsThreshold(normalizeQuality(entry.quality)) }))
            .sort((left, right) => left.threshold - right.threshold)[0].entry
          const sourceQuality = normalizeQuality(source.quality)
          const sourceDef = itemDef(source.defId)
          triggers.push({
            itemId: source.id,
            defId: source.defId,
            quality: sourceQuality,
            effectType: 'UTILITY',
            amount: 1,
            target: actorSide,
            sourceHp: getHp(targetSide),
            targetHp: getHp(actorSide),
            sourceHpDelta: 0,
            targetHpDelta: 0,
            roll,
            text: `${itemName(sourceDef, sourceQuality)} 侦测到连续触发，使下一件 1 格装备【失效】`,
          })
        }
      }
    }

    const grantedEffects = actorState.itemGrantedEffects[item.id] ?? []
    if (grantedEffects.length > 0) delete actorState.itemGrantedEffects[item.id]
    for (const grant of grantedEffects) {
      if (grant.effect === 'THORNS') {
        actorState.thorns += grant.amount
        triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'UTILITY', amount: grant.amount, target: actorSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: 0, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 的附魔赐予 ${grant.amount} 层【荆棘】` })
      }
      if (grant.effect === 'CLEANSE') {
        let cleansed = 0
        while (cleansed < grant.amount && (actorState.poison > 0 || actorState.weak > 0)) {
          if (actorState.poison > 0) actorState.poison -= 1
          else actorState.weak -= 1
          cleansed += 1
        }
        triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'UTILITY', amount: cleansed, target: actorSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: 0, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 的附魔【净化】 ${cleansed} 层负面状态` })
      }
    }

    const bullyDoubled = actor.dogType === 'BULLY' && isLarge(def, actor) && rng() < BULLY_LARGE_EFFECT_CHANCE
    const bullyQuad = bullyDoubled && triggerOrder(actor.items).some((entry) => itemDef(entry.defId).advancedEffect === 'BULLY_QUADRUPLE_CHANCE') && rng() < 0.2
    const emperorTraitDisabled = hasEquippedEffect(actor, 'ADJACENT_USES_LUCKY') || hasEquippedEffect(actor, 'ONLY_LUCKY_DOUBLE')
    const emperorDoubled = !emperorTraitDisabled
      && actor.dogType === 'EMPEROR'
      && actor.luckyNumber === roll
      && rng() < EMPEROR_LUCKY_EFFECT_CHANCE
    const doubled = bullyDoubled || emperorDoubled
    const multiplier = bullyQuad ? 4 : doubled ? 2 : 1
    const traitText = bullyQuad ? '（恶霸4倍翻倍）' : bullyDoubled ? '（恶霸翻倍）' : emperorDoubled ? '（狗皇帝幸运翻倍）' : ''
    const extraRollDamageScale = extra && hasEquippedEffect(actor, 'EXTRA_ROLL_RECURSE') ? 1 + extraDepth * 0.1 : 1
    let growthCurrentDamage = 0
    let growthStep = 0
    if (advanced === 'GROWTH_DAMAGE') {
      growthCurrentDamage = actorState.growthDamageByItemId[item.id] ?? growthDamageBase(quality)
      growthStep = growthDamageStep(quality)
    }
    const baseAmount = (advanced === 'GROWTH_DAMAGE' ? growthCurrentDamage : qualityAmountFrom(def.effect.amount, quality, def.effect.qualityBase)) * multiplier
    const scaledBaseAmount = (def.effect.type === 'DAMAGE' || def.effect.type === 'DAMAGE_SELF_SHIELD')
      ? baseAmount * extraRollDamageScale
      : baseAmount
    let amount = roundScaled(scaledBaseAmount, scale * globalEffectScale(actor))
    const baseEffectKind = itemBaseEffectKind(def)
    const effectBonus = baseEffectKind ? actorState.itemEffectBonus[item.id]?.[baseEffectKind] ?? 0 : 0
    if (effectBonus > 0 && baseEffectKind) {
      amount += effectBonus
      delete actorState.itemEffectBonus[item.id]?.[baseEffectKind]
    }
    const damageBonus = actorState.adjacentDamageBonus[item.id] ?? 0
    if (damageBonus > 0 && (def.effect.type === 'DAMAGE' || def.effect.type === 'DAMAGE_SELF_SHIELD')) {
      amount += damageBonus
      delete actorState.adjacentDamageBonus[item.id]
    }
    if (actorState.furyStacks > 0 && (def.effect.type === 'DAMAGE' || def.effect.type === 'DAMAGE_SELF_SHIELD')) {
      amount += actorState.furyStacks
    }
    const multiRepeatBonusItems = multiIndex > 1 && isMultiItem(item)
      ? equippedItemsWithEffect(actor, 'MULTI_REPEAT_BONUS')
      : []
    if (multiRepeatBonusItems.length > 0 && (def.effect.type === 'DAMAGE' || def.effect.type === 'DAMAGE_SELF_SHIELD')) {
      amount += multiRepeatBonusItems.reduce((sum, source) => sum + kyushuBracerDamageBonus(normalizeQuality(source.quality)), 0)
    }
    if (!recoveryBlocked && multiRepeatBonusItems.length > 0) {
      for (const source of multiRepeatBonusItems) {
        const sourceDef = itemDef(source.defId)
        const sourceQuality = normalizeQuality(source.quality)
        const shield = kyushuBracerShieldBonus(sourceQuality)
        applyShield(actorSide, shield)
        triggers.push({
          itemId: source.id,
          defId: source.defId,
          quality: sourceQuality,
          effectType: 'UTILITY',
          amount: shield,
          target: actorSide,
          sourceHp: getHp(actorSide),
          targetHp: getHp(targetSide),
          sourceHpDelta: 0,
          targetHpDelta: 0,
          roll,
          text: `${itemName(sourceDef, sourceQuality)} 因【多重】追击获得 ${shield} 点【护盾】`,
        })
      }
    }

    if (!sacrificeReplacesSmallEffect && advanced === 'BREAK_SHIELD_THORNS' && targetState.thorns > 0) {
      const removed = Math.min(targetState.thorns, thornbreakerThornsRemoved(quality))
      targetState.thorns -= removed
      triggers.push({
        itemId: item.id,
        defId: item.defId,
        quality,
        effectType: 'UTILITY',
        amount: removed,
        target: targetSide,
        sourceHp: getHp(actorSide),
        targetHp: getHp(targetSide),
        sourceHpDelta: 0,
        targetHpDelta: 0,
        roll,
        text: `${itemName(def, quality)} 清除 ${removed} 层【荆棘】`,
      })
    }

    if (!sacrificeReplacesSmallEffect && (def.effect.type === 'DAMAGE' || def.effect.type === 'DAMAGE_SELF_SHIELD')) {
      const before = getHp(targetSide)
      const shieldDamage = advanced === 'DOUBLE_SHIELD_DAMAGE'
        ? amount * 2
        : advanced === 'BREAK_SHIELD_THORNS'
          ? Math.round(amount * thornbreakerShieldDamageMultiplier(quality))
          : amount
      const result = applyAttackDamage(targetSide, amount, shieldDamage)
      const weakScale = actorState.weak > 0 ? 0.5 : 1
      if (actorState.weak > 0) actorState.weak -= 1
      if (weakScale < 1 && result.delta < 0) {
        const refunded = Math.round(Math.abs(result.delta) * 0.5)
        setHp(targetSide, Math.min(targetState.maxHp, getHp(targetSide) + refunded))
      }
      const after = getHp(targetSide)
      triggers.push({
        itemId: item.id,
        defId: item.defId,
        quality,
        effectType: def.effect.type,
        amount: Math.abs(after - before),
        target: targetSide,
        sourceHp: getHp(actorSide),
        targetHp: after,
        sourceHpDelta: 0,
        targetHpDelta: after - before,
        roll,
        text: `${itemName(def, quality)}${traitText}${note} 造成 ${Math.abs(after - before)} 点伤害`,
      })
      triggers.push(...poisonOnAttackHitTriggers(actorSide, actor, targetSide, targetFighter, roll))
      if (advanced === 'GAIN_FURY_ON_ATTACK' && rng() < 0.5) {
        actorState.furyStacks += 1
        triggers.push({
          itemId: item.id,
          defId: item.defId,
          quality,
          effectType: 'UTILITY',
          amount: actorState.furyStacks,
          target: actorSide,
          sourceHp: getHp(actorSide),
          targetHp: getHp(targetSide),
          sourceHpDelta: 0,
          targetHpDelta: 0,
          roll,
          text: `${itemName(def, quality)} 触发【激昂】，攻击伤害 +1`,
        })
      }
      if (targetState.thorns > 0) {
        const thorn = targetState.thorns * THORNS_DAMAGE_PER_STACK
        const thornResult = applyDamage(actorSide, thorn)
        triggers.push({
          itemId: item.id,
          defId: item.defId,
          quality,
          effectType: 'DAMAGE',
          amount: thorn,
          target: actorSide,
          sourceHp: thornResult.after,
          targetHp: getHp(targetSide),
          sourceHpDelta: thornResult.delta,
          targetHpDelta: 0,
          roll,
          text: `【荆棘】反弹 ${thorn} 点伤害`,
        })
      }
      if (actor.dogType === 'BULLY' && isLarge(def, actor) && triggerOrder(actor.items).some((entry) => itemDef(entry.defId).advancedEffect === 'DISABLE_ENEMY_LARGE')) {
        for (const targetItem of triggerOrder(targetFighter.items).filter((entry) => isLarge(itemDef(entry.defId), targetFighter))) {
          targetState.disabledItemIds.push(targetItem.id)
        }
      }
      if (advanced === 'TARGET_WEAK_BONUS_DAMAGE' && targetState.weak > 0) {
        const bonus = roundScaled(qualityAmount(4, quality) * extraRollDamageScale, scale * globalEffectScale(actor))
        const bonusResult = applyDirectHealthDamage(targetSide, bonus)
        triggers.push({
          itemId: item.id,
          defId: item.defId,
          quality,
          effectType: 'DAMAGE',
          amount: bonus,
          target: targetSide,
          sourceHp: getHp(actorSide),
          targetHp: bonusResult.after,
          sourceHpDelta: 0,
          targetHpDelta: bonusResult.delta,
          roll,
          text: `${itemName(def, quality)} 对【虚弱】目标额外造成 ${bonus} 点【真实伤害】`,
        })
      }
      if (advanced === 'APPLY_WEAK_ON_HIT') {
        const appliedWeak = addWeak(targetSide, targetFighter, qualityAmount(1, quality))
        if (appliedWeak > 0) {
          triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'UTILITY', amount: targetState.weak, target: targetSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: 0, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 施加 ${appliedWeak} 层【虚弱】` })
        }
      }
      if (advanced === 'APPLY_WEAK_20_ON_HIT' && rng() < 0.2) {
        const appliedWeak = addWeak(targetSide, targetFighter, qualityAmount(1, quality))
        if (appliedWeak > 0) {
          triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'UTILITY', amount: targetState.weak, target: targetSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: 0, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 施加 ${appliedWeak} 层【虚弱】` })
        }
      }
      const grantedLifesteal = grantedEffects.find((grant) => grant.effect === 'LIFESTEAL')
      if (!recoveryBlocked && (advanced === 'LIFESTEAL' || actorState.lifestealItemIds.includes(item.id) || grantedLifesteal) && after < before) {
        const healAmount = grantedLifesteal ? Math.min(before - after, grantedLifesteal.amount) : before - after
        const healed = applyHeal(actorSide, healAmount)
        triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'HEAL', amount: before - after, target: actorSide, sourceHp: healed.after, targetHp: getHp(targetSide), sourceHpDelta: healed.delta, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 吸取 ${before - after} 点生命` })
      }
      if (advanced === 'GROWTH_DAMAGE') {
        actorState.growthDamageByItemId[item.id] = growthCurrentDamage + growthStep
        triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'UTILITY', amount: growthStep, target: actorSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: 0, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 后续伤害提高 ${growthStep}` })
      }
    }

    if (!sacrificeReplacesSmallEffect && !recoveryBlocked && def.effect.type === 'HEAL') {
      const wasFull = getHp(actorSide) >= actorState.maxHp
      const result = applyHeal(actorSide, amount)
      triggers.push({
        itemId: item.id,
        defId: item.defId,
        quality,
        effectType: def.effect.type,
        amount,
        target: actorSide,
        sourceHp: result.after,
        targetHp: getHp(targetSide),
        sourceHpDelta: result.delta,
        targetHpDelta: 0,
        roll,
        text: `${itemName(def, quality)}${traitText}${note} 回复 ${amount} 点生命`,
      })
      if (advanced === 'CLEANSE_ONE') {
        if (actorState.poison > 0) actorState.poison -= 1
        else if (actorState.weak > 0) actorState.weak -= 1
        triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'UTILITY', amount: 1, target: actorSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: 0, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 【净化】 1 层负面状态` })
      }
      if (advanced === 'HEAL_OR_MAX_HP' && wasFull) {
        const gain = qualityAmount(1, quality)
        actorState.maxHp += gain
        setHp(actorSide, getHp(actorSide) + gain)
        triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'HEAL', amount: gain, target: actorSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: gain, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 使最大生命值 +${gain}` })
      }
    }

    if (!sacrificeReplacesSmallEffect && advanced === 'STEAL_ENEMY_BUFF') {
      const stolen = stealPositiveBuff(actorSide, targetSide)
      if (stolen) {
        triggers.push({
          itemId: item.id,
          defId: item.defId,
          quality,
          effectType: 'UTILITY',
          amount: 1,
          target: 'both',
          sourceHp: getHp(actorSide),
          targetHp: getHp(targetSide),
          sourceHpDelta: 0,
          targetHpDelta: 0,
          roll,
          text: `${itemName(def, quality)} 偷取 1 层【${stolen}】`,
        })
      }
    }

    if (!sacrificeReplacesSmallEffect && advanced === 'POISON_ON_ROLL') {
      const appliedPoison = addPoison(targetSide, targetFighter, SHIBA_POISON_ON_ROLL_AMOUNT)
      if (appliedPoison > 0) {
        triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'POISON', amount: targetState.poison, target: targetSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: 0, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 叠加 ${appliedPoison} 层【中毒】` })
      }
    }
    if (!sacrificeReplacesSmallEffect && advanced === 'APPLY_POISON') {
      const appliedPoison = addPoison(targetSide, targetFighter, amount)
      if (appliedPoison > 0) {
        triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'POISON', amount: targetState.poison, target: targetSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: 0, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 叠加 ${appliedPoison} 层【中毒】` })
      }
    }
    if (!sacrificeReplacesSmallEffect && advanced === 'APPLY_WOUND') {
      const appliedWound = addWound(targetSide, amount)
      if (appliedWound > 0) {
        triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'UTILITY', amount: targetState.wound, target: targetSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: 0, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 叠加 ${appliedWound} 层【伤口】` })
      }
    }
    if (!sacrificeReplacesSmallEffect && advanced === 'POISON_AND_DISABLE_RIGHTMOST') {
      const appliedPoison = addPoison(targetSide, targetFighter, amount)
      if (appliedPoison > 0) {
        triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'POISON', amount: targetState.poison, target: targetSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: 0, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 叠加 ${appliedPoison} 层【中毒】` })
      }
      const rightmost = triggerOrder(targetFighter.items).at(-1)
      if (rightmost) {
        targetState.disabledItemIds.push(rightmost.id)
        triggers.push({ itemId: item.id, targetItemId: rightmost.id, defId: item.defId, quality, effectType: 'UTILITY', amount: 1, target: targetSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: 0, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 使敌方最右侧装备【失效】一次` })
      }
    }
    if (!sacrificeReplacesSmallEffect && advanced === 'GAIN_THORNS' && rng() < 0.5) {
      actorState.thorns += qualityAmount(1, quality)
      triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'UTILITY', amount: actorState.thorns, target: actorSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: 0, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 获得 ${qualityAmount(1, quality)} 层【荆棘】` })
    }
    if (!sacrificeReplacesSmallEffect && advanced === 'APPLY_WEAK' && rng() < 0.5) {
      const appliedWeak = addWeak(targetSide, targetFighter, qualityAmount(1, quality))
      if (appliedWeak > 0) {
        triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'UTILITY', amount: targetState.weak, target: targetSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: 0, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 施加 ${appliedWeak} 层【虚弱】` })
      }
    }
    if (!sacrificeReplacesSmallEffect && advanced === 'AVALANCHE' && roll <= 3) {
      actorState.avalanche += 1
      if (actorState.avalanche >= 5) {
        actorState.avalanche = 0
        const damage = roundScaled(qualityAmount(actorState.avalancheDamage, quality) * extraRollDamageScale, scale * globalEffectScale(actor))
        actorState.avalancheDamage *= 2
        const result = applyDamage(targetSide, damage)
        triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'DAMAGE', amount: damage, target: targetSide, sourceHp: getHp(actorSide), targetHp: result.after, sourceHpDelta: 0, targetHpDelta: result.delta, roll, text: `${itemName(def, quality)} 引发【雪崩】，造成 ${damage} 点伤害` })
      }
    }
    if (!sacrificeReplacesSmallEffect && advanced === 'FREEZE_STACK' && roll >= 4) {
      const nextFreezeStacks = actorState.freezeStacks + 1
      const freezeStackSignal = {
        freezeStackItemId: item.id,
        freezeStackValue: nextFreezeStacks >= FREEZE_STACK_TRIGGER_THRESHOLD ? 0 : nextFreezeStacks,
        freezeStackMax: FREEZE_STACK_TRIGGER_THRESHOLD,
        freezeStackChanged: true,
      }
      actorState.freezeStacks = nextFreezeStacks
      if (actorState.freezeStacks >= FREEZE_STACK_TRIGGER_THRESHOLD) {
        actorState.freezeStacks = 0
        targetState.frozenUntil = Math.max(targetState.frozenUntil, time + 2)
        triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'UTILITY', amount: 2, target: targetSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: 0, targetHpDelta: 0, roll, ...freezeStackSignal, text: `${itemName(def, quality)} 【冻结】敌人 2 秒` })
      } else {
        triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'UTILITY', amount: nextFreezeStacks, target: actorSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: 0, targetHpDelta: 0, roll, ...freezeStackSignal, text: `${itemName(def, quality)} 【冻结计数】 +${nextFreezeStacks}/${FREEZE_STACK_TRIGGER_THRESHOLD}` })
      }
    }
    if (!sacrificeReplacesSmallEffect && advanced === 'PURGE_ENEMY_BUFFS') {
      const maxLayers = qualityAmountFrom(def.effect.amount, quality, def.effect.qualityBase)
      const removed = purgePositiveBuffs(targetSide, maxLayers)
      if (removed <= 0) {
        triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'UTILITY', amount: 0, target: targetSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: 0, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 未【净化】任何敌方增益` })
      } else if (recoveryBlocked) {
        triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'UTILITY', amount: removed, target: targetSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: 0, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 【净化】清除 ${removed} 层增益` })
      } else {
        const healAmount = removed * qualityAmountFrom(5, quality, 'SILVER')
        const healed = applyHeal(actorSide, healAmount)
        triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'HEAL', amount: healAmount, target: actorSide, sourceHp: healed.after, targetHp: getHp(targetSide), sourceHpDelta: healed.delta, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 【净化】清除 ${removed} 层增益，恢复 ${healAmount} 点生命` })
      }
    }
    if (!sacrificeReplacesSmallEffect && !recoveryBlocked && advanced === 'POISON_TO_HEAL') {
      const tiers = Math.min(4, Math.floor(targetState.poison / 5))
      const healAmount = tiers * poisonBloodPumpHealPerTier(quality)
      if (healAmount > 0) {
        const healed = applyHeal(actorSide, healAmount)
        triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'HEAL', amount: healAmount, target: actorSide, sourceHp: healed.after, targetHp: getHp(targetSide), sourceHpDelta: healed.delta, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 将 ${tiers} 档【中毒】转为 ${healAmount} 点治疗` })
      } else {
        triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'UTILITY', amount: 0, target: actorSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: 0, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 没有可转化的【中毒】层数` })
      }
    }
    if (!sacrificeReplacesSmallEffect && !recoveryBlocked && advanced === 'SHIELD_TO_DAMAGE') {
      const shield = bitebackShieldGain(quality)
      applyShield(actorSide, shield)
      triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'UTILITY', amount: shield, target: actorSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: 0, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 获得 ${shield} 点【护盾】` })
      const damage = Math.min(bitebackShieldDamageCap(quality), Math.floor(state[actorSide].shield * bitebackShieldDamageRatio(quality)))
      if (damage > 0) {
        const result = applyDirectHealthDamage(targetSide, damage)
        triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'DAMAGE', amount: result.before - result.after, target: targetSide, sourceHp: getHp(actorSide), targetHp: result.after, sourceHpDelta: 0, targetHpDelta: result.delta, roll, text: `${itemName(def, quality)} 反咬造成 ${result.before - result.after} 点直接伤害` })
      }
    }
    if (!sacrificeReplacesSmallEffect && !recoveryBlocked && advanced === 'CLEANSE_POISON_TO_SHIELD') {
      const cleansed = Math.min(actorState.poison, bitterKibbleCleanseLimit(quality))
      actorState.poison -= cleansed
      const shield = cleansed * bitterKibbleShieldPerPoison(quality)
      if (shield > 0) applyShield(actorSide, shield)
      triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'UTILITY', amount: shield, target: actorSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: 0, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 【净化】 ${cleansed} 层【中毒】，获得 ${shield} 点【护盾】` })
    }
    if (!sacrificeReplacesSmallEffect && !recoveryBlocked && advanced === 'SHIELD_ON_NON_LUCKY' && actor.luckyNumber !== roll) {
      applyShield(actorSide, qualityAmount(5, quality))
      triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'UTILITY', amount: qualityAmount(5, quality), target: actorSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: 0, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 获得 ${qualityAmount(5, quality)} 点【护盾】` })
    }
    if (!sacrificeReplacesSmallEffect && !recoveryBlocked && (advanced === 'GAIN_SHIELD' || advanced === 'SHIELD_IMMUNITY')) {
      applyShield(actorSide, amount)
      triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'UTILITY', amount, target: actorSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: 0, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 获得 ${amount} 点【护盾】` })
    }
    if (!sacrificeReplacesSmallEffect && !recoveryBlocked && advanced === 'GAIN_SHIELD_THORNS') {
      applyShield(actorSide, amount)
      actorState.thorns += qualityAmount(1, quality)
      triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'UTILITY', amount, target: actorSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: 0, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 获得 ${amount} 点【护盾】与 ${qualityAmount(1, quality)} 层【荆棘】` })
    }
    if (!sacrificeReplacesSmallEffect && advanced === 'CLEANSE_ON_LUCKY' && actor.luckyNumber === roll) {
      actorState.poison = 0
      actorState.weak = 0
      actorState.wound = 0
      triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'UTILITY', amount: 0, target: actorSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: 0, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 【净化】所有负面状态` })
    }

    const isReservoirTrigger = triggerSource === 'reservoir'

    if (!sacrificeReplacesSmallEffect && advanced === 'ADJACENT_DAMAGE_BONUS') {
      for (const adjacent of adjacentItems(actor, item)) actorState.adjacentDamageBonus[adjacent.id] = (actorState.adjacentDamageBonus[adjacent.id] ?? 0) + qualityAmount(4, quality)
    }
    if (!sacrificeReplacesSmallEffect && isReservoirTrigger && advanced === 'FROG_CHARGE_ADJACENT') {
      const adjacent = adjacentItems(actor, item)
      for (const targetItem of adjacent) chargeReservoir(actorSide, targetItem, time, 0.5)
      triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'UTILITY', amount: adjacent.length, target: actorSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: 0, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 使【相邻】装备获得 50% 水位` })
    }
    if (!sacrificeReplacesSmallEffect && isReservoirTrigger && advanced === 'FROG_RAINY_SEASON') {
      actorState.frogRainyUntil = Math.max(actorState.frogRainyUntil, time + 4)
      triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'UTILITY', amount: 4, target: actorSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: 0, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 开启【暴雨季】，4 秒内充水速度 +50%` })
    }
    if (!sacrificeReplacesSmallEffect && isReservoirTrigger && advanced === 'FROG_TRIGGER_HIGHEST_RESERVOIR') {
      const candidates = Object.values(reservoirs[actorSide])
        .filter((entry) => entry.item.id !== item.id && itemDef(entry.item.defId).kind !== 'CLASS_EQUIPMENT')
        .sort((left, right) => ((time - right.lastResetAt) / right.duration) - ((time - left.lastResetAt) / left.duration))
      const target = candidates[0]?.item
      if (target) {
        queueBattleItems(queue, actorSide, actor, [target], time, true, allowLargeTriggerFanout, chainEdgeIds, item.id)
        triggers.push({ itemId: item.id, targetItemId: target.id, defId: item.defId, quality, effectType: 'UTILITY', amount: 1, target: actorSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: 0, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 立即触发水位最高的装备` })
      }
    }
    if (!sacrificeReplacesSmallEffect && isReservoirTrigger && advanced === 'FROG_ROLL_ON_RESERVOIR' && !frogClassRoll) {
      processed.frogRollRequests = (processed.frogRollRequests ?? 0) + 1
      triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'ROLL', amount: 1, target: actorSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: 0, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 鼓动水声，准备进行一次普通投骰` })
    }
    if (!sacrificeReplacesSmallEffect && advanced === 'ADJACENT_TEMP_TRIGGER') {
      const adjacent = adjacentItems(actor, item)
      const repeatedAdjacent = Array.from({ length: nightPatrolLightTriggerCount(quality) }, () => adjacent).flat()
      queueBattleItems(queue, actorSide, actor, repeatedAdjacent, time, true, allowLargeTriggerFanout, chainEdgeIds, item.id)
    }
    if (!sacrificeReplacesSmallEffect && (advanced === 'TRIGGER_ADJACENT' || (advanced === 'ADJACENT_ON_EXTRA_ROLL' && extra))) {
      queueBattleItems(queue, actorSide, actor, adjacentItems(actor, item), time, true, allowLargeTriggerFanout, chainEdgeIds, item.id)
    }
    if (!sacrificeReplacesSmallEffect && advanced === 'TRIGGER_MINUS_THREE' && roll >= 4) {
      queueBattleItems(queue, actorSide, actor, triggerOrder(actor.items).filter((entry) => itemDef(entry.defId).dice.includes(roll - 3)), time, true, allowLargeTriggerFanout, chainEdgeIds, item.id)
    }
    if (!sacrificeReplacesSmallEffect && allowLargeTriggerFanout && hasEquippedEffect(actor, 'LARGE_TRIGGERS_NON_LARGE') && isLarge(def, actor)) {
      const candidates = triggerOrder(actor.items).filter((entry) => {
        const candidateDef = itemDef(entry.defId)
        return !isLarge(candidateDef, actor) && candidateDef.advancedEffect !== 'LARGE_TRIGGERS_NON_LARGE'
      })
      if (candidates.length > 0) queueBattleItems(queue, actorSide, actor, [candidates[Math.floor(rng() * candidates.length)]], time, true, false, chainEdgeIds, item.id)
    }
    if (sacrificeReplacesSmallEffect) {
      queueBattleItems(queue, actorSide, actor, triggerOrder(actor.items).filter((entry) => isLarge(itemDef(entry.defId), actor)), time, true, allowLargeTriggerFanout, chainEdgeIds, item.id)
    }
    if (!sacrificeReplacesSmallEffect && advanced === 'EXTRA_ROLL_TRIGGERS_ALL' && extra && allowExtraRollFanout) {
      const target = triggerOrder(actor.items).find((entry) => entry.id !== item.id)
      if (target) queueBattleItems(queue, actorSide, actor, [target, target], time, false, allowLargeTriggerFanout, chainEdgeIds, item.id)
    }
    if (!sacrificeReplacesSmallEffect && advanced === 'ROLL_COUNTER_EXTRA' && actorState.rollCount % 4 === 0) {
      processed.extraRollRequests += 1
    }
    if (!sacrificeReplacesSmallEffect && ((advanced === 'EXTRA_ROLL_CHANCE' && rng() < 0.2) || (advanced === 'EXTRA_ROLL_RECURSE' && extra && rng() < 0.2))) {
      processed.extraRollRequests += 1
    }
    if (!sacrificeReplacesSmallEffect && !recoveryBlocked && advanced === 'MAX_HP_ON_EXTRA_ROLL' && extra) {
      actorState.maxHp += qualityAmount(1, quality)
      setHp(actorSide, getHp(actorSide) + qualityAmount(1, quality))
      triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'HEAL', amount: qualityAmount(1, quality), target: actorSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: qualityAmount(1, quality), targetHpDelta: 0, roll, text: `${itemName(def, quality)} 使最大生命值 +${qualityAmount(1, quality)}` })
    }

    if (!sacrificeReplacesSmallEffect && advanced === 'SHIBA_SPEED') {
      actorState.shibaSpeedStacks = Math.min(5, actorState.shibaSpeedStacks + 1)
    }

    const enchant = item.enchant
    if (!sacrificeReplacesSmallEffect && enchant && enchant.kind !== 'EXTRA_DICE') {
      if (enchant.kind === 'BASE_EFFECT') {
        if (enchant.effect === 'DAMAGE') {
          const result = applyAttackDamage(targetSide, enchant.amount)
          const attackAmount = enchant.amount + targetState.wound
          triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'DAMAGE', amount: attackAmount, target: targetSide, sourceHp: getHp(actorSide), targetHp: result.after, sourceHpDelta: 0, targetHpDelta: result.delta, roll, text: `${itemName(def, quality)} 附魔造成 ${attackAmount} 点伤害` })
          triggers.push(...poisonOnAttackHitTriggers(actorSide, actor, targetSide, targetFighter, roll))
        } else if (enchant.effect === 'HEAL' && !recoveryBlocked) {
          const result = applyHeal(actorSide, enchant.amount)
          triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'HEAL', amount: enchant.amount, target: actorSide, sourceHp: result.after, targetHp: getHp(targetSide), sourceHpDelta: result.delta, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 附魔回复 ${enchant.amount} 点生命` })
        } else if (enchant.effect === 'SHIELD' && !recoveryBlocked) {
          applyShield(actorSide, enchant.amount)
          triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'UTILITY', amount: enchant.amount, target: actorSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: 0, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 附魔获得 ${enchant.amount} 点【护盾】` })
        }
      }
      if (enchant.kind === 'SPECIAL') {
        if (enchant.effect === 'THORNS') {
          actorState.thorns += enchant.amount
          triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'UTILITY', amount: enchant.amount, target: actorSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: 0, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 附魔获得 ${enchant.amount} 层【荆棘】` })
        } else if (enchant.effect === 'FURY') {
          actorState.furyStacks += enchant.amount
          triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'UTILITY', amount: enchant.amount, target: actorSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: 0, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 附魔触发 ${enchant.amount} 层【激昂】` })
        } else if (enchant.effect === 'POISON') {
          const applied = addPoison(targetSide, targetFighter, enchant.amount)
          triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'POISON', amount: applied, target: targetSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: 0, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 附魔施加 ${applied} 层【中毒】` })
        } else {
          const applied = addWeak(targetSide, targetFighter, enchant.amount)
          triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'UTILITY', amount: applied, target: targetSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: 0, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 附魔施加 ${applied} 层【虚弱】` })
        }
      }
      if (enchant.kind === 'TRIGGER_NEIGHBOR') {
        queueBattleItems(queue, actorSide, actor, neighborItems(actor, item, enchant.target), time, true, allowLargeTriggerFanout, chainEdgeIds, item.id)
      }
      if (enchant.kind === 'BUFF_NEIGHBOR_EFFECT') {
        for (const targetItem of neighborItems(actor, item, enchant.target)) {
          if (itemBaseEffectKind(itemDef(targetItem.defId)) !== enchant.effect) continue
          actorState.itemEffectBonus[targetItem.id] = actorState.itemEffectBonus[targetItem.id] ?? {}
          actorState.itemEffectBonus[targetItem.id][enchant.effect] = (actorState.itemEffectBonus[targetItem.id][enchant.effect] ?? 0) + enchant.amount
        }
      }
      if (enchant.kind === 'GRANT_NEIGHBOR_EFFECT') {
        for (const targetItem of neighborItems(actor, item, enchant.target)) {
          actorState.itemGrantedEffects[targetItem.id] = actorState.itemGrantedEffects[targetItem.id] ?? []
          actorState.itemGrantedEffects[targetItem.id].push({ effect: enchant.effect, amount: enchant.amount })
        }
      }
    }

    if (processed.count >= TRIGGER_QUEUE_CAP && !processed.capped) {
      processed.capped = true
      triggers.push({
        itemId: item.id,
        defId: item.defId,
        quality,
        effectType: 'UTILITY',
        amount: 0,
        target: 'none',
        sourceHp: getHp(actorSide),
        targetHp: getHp(targetSide),
        sourceHpDelta: 0,
        targetHpDelta: 0,
        roll,
        safetyCode: 'TRIGGER_QUEUE_CAP',
        text: `触发队列达到上限 ${TRIGGER_QUEUE_CAP}，后续联动已截断`,
      })
    }

    return finishTriggers()
  }

  const processTriggerQueue = (
    time: number,
    actorSide: Side,
    fighter: FighterSnapshot,
    roll: number,
    queue: TriggerQueueEntry[],
    extra = false,
    extraDepth = 0,
    frogClassRoll = false,
  ) => {
    const processed = { count: 0, capped: false, extraRollRequests: 0, frogRollRequests: 0 }
    const fighterState = state[actorSide]
    while (queue.length > 0 && processed.count < TRIGGER_QUEUE_CAP && !hasDefeatedFighter()) {
      const entry = queue.shift()
      if (!entry) continue
      const { item, allowExtraRollFanout, allowLargeTriggerFanout, chainEdgeIds, multiIndex, multiTotal, source } = entry
      const context = matchingContext(fighter, item, roll, fighterState.forcedItemDice)
      processed.count += 1
      const itemTriggerCount = (fighterState.itemTriggerCounts[item.id] ?? 0) + 1
      fighterState.itemTriggerCounts[item.id] = itemTriggerCount
      const queueLengthBefore = queue.length
      const extraRollRequestsBefore = processed.extraRollRequests
      const frogRollRequestsBefore = processed.frogRollRequests
      const itemTriggers = executeItem(actorSide, fighter, item, time, roll, context.scale, context.note, queue, processed, extra, extraDepth, allowExtraRollFanout, allowLargeTriggerFanout, frogClassRoll, chainEdgeIds, multiIndex, multiTotal, source)
      const hasSelfTriggerEvent = itemTriggers.some((trigger) => trigger.itemId === item.id)
      const def = itemDef(item.defId)
      const quality = normalizeQuality(item.quality)
      const sacrificeReplacesSmallEffect = def.size === 1
        && triggerOrder(fighter.items).some((entry) => itemDef(entry.defId).advancedEffect === 'SMALL_TRIGGERS_LARGE')
      const hasCountOnlySideEffect = queue.length > queueLengthBefore
        || processed.extraRollRequests > extraRollRequestsBefore
        || processed.frogRollRequests > frogRollRequestsBefore
        || def.advancedEffect === 'ADJACENT_DAMAGE_BONUS'
      if (
        !hasSelfTriggerEvent
        && hasCountOnlySideEffect
        && !sacrificeReplacesSmallEffect
        && def.advancedEffect !== 'BOOM_COUNTER'
        && def.advancedEffect !== 'GRANT_LIFESTEAL_ADJACENT'
      ) {
        itemTriggers.unshift({
          itemId: item.id,
          defId: item.defId,
          quality,
          effectType: 'UTILITY',
          amount: 0,
          target: actorSide,
          sourceHp: getHp(actorSide),
          targetHp: getHp(opponentOf(actorSide)),
          sourceHpDelta: 0,
          targetHpDelta: 0,
          roll,
          multiIndex,
          multiTotal,
          text: `${itemName(def, quality)} 成功触发`,
        })
      }
      for (const trigger of itemTriggers) {
        const multiText = trigger.multiTotal && trigger.multiTotal > 1 ? `（多重 ${trigger.multiIndex}/${trigger.multiTotal}）` : ''
        push({
          time,
          actor: actorSide,
          kind: 'ITEM',
          text: `${trigger.text}${multiText}`,
          roll: trigger.roll,
          itemId: trigger.itemId,
          targetItemId: trigger.targetItemId,
          defId: trigger.defId,
          quality: trigger.quality,
          itemTriggerCount: trigger.itemId === item.id ? itemTriggerCount : undefined,
          multiIndex: trigger.multiIndex,
          multiTotal: trigger.multiTotal,
          boomCounterItemId: trigger.boomCounterItemId,
          boomCounterValue: trigger.boomCounterValue,
          boomCounterMax: trigger.boomCounterMax,
          boomCounterChanged: trigger.boomCounterChanged,
          freezeStackItemId: trigger.freezeStackItemId,
          freezeStackValue: trigger.freezeStackValue,
          freezeStackMax: trigger.freezeStackMax,
          freezeStackChanged: trigger.freezeStackChanged,
          effectType: trigger.effectType,
          amount: trigger.amount,
          target: trigger.target,
          sourceHpDelta: trigger.sourceHpDelta,
          targetHpDelta: trigger.targetHpDelta,
          safetyCode: trigger.safetyCode,
        })
      }
    }
    if (queue.length > 0 && !processed.capped && !hasDefeatedFighter()) {
      push({
        time,
        actor: actorSide,
        kind: 'ITEM',
        safetyCode: 'TRIGGER_QUEUE_CAP',
        text: `触发队列达到上限 ${TRIGGER_QUEUE_CAP}，后续联动已截断`,
        effectType: 'UTILITY',
        target: 'none',
      })
    }
    return processed
  }

  const resolveActor = (time: number, actorSide: Side, extra = false, extraDepth = 0, frogClassRoll = false) => {
    const fighter = actorSide === 'player' ? player : opponent
    const fighterState = state[actorSide]
    let roll = rollDog(fighter.dogType, rng)
    if (triggerOrder(fighter.items).some((item) => itemDef(item.defId).advancedEffect === 'ROLL_TWO_PICK_SMALL')) {
      const second = rollDog(fighter.dogType, rng)
      roll = Math.min(roll, second)
    }
    if (fighter.dogType === 'EMPEROR' && fighter.luckyNumber && triggerOrder(fighter.items).some((item) => itemDef(item.defId).advancedEffect === 'LUCKY_NUMBER_PITY')) {
      if (fighterState.missedLucky >= 2) roll = fighter.luckyNumber
    }
    roll = biasRollByRelic(fighter, roll, rng)
    roll = restrictRollByRelic(fighter, roll)
    fighterState.rollCount += 1
    if (fighter.dogType === 'EMPEROR' && fighter.luckyNumber) fighterState.missedLucky = roll === fighter.luckyNumber ? 0 : fighterState.missedLucky + 1
    push({
      time,
      actor: actorSide,
      kind: 'ROLL',
      roll,
      effectType: 'ROLL',
      target: 'none',
      text: frogClassRoll
        ? `${fighter.name} 的蛙鸣鼓掷出 ${roll} 点（${DOGS[fighter.dogType].name}）`
        : `${fighter.name}${extra ? ' 额外' : ''}掷出 ${roll} 点（${DOGS[fighter.dogType].name}）`,
    })

    const initialMatches = triggerOrder(fighter.items)
      .map((item) => ({ item, context: matchingContext(fighter, item, roll, fighterState.forcedItemDice) }))
      .filter(({ context }) => context.matches)
    const initialQueue = hasEquippedEffect(fighter, 'ONLY_LUCKY_DOUBLE') && fighter.luckyNumber !== roll
      ? []
      : initialMatches.flatMap(({ item, context }) => context.triggeredBySize && rng() < 0.5 ? [item, item] : [item])
    const emptyRollSafety = relicWithEffect(fighter, 'EMPTY_ROLL_LARGE_SAFETY')
    const missedBeforeRoll = fighterState.emptyRolls
    if (initialQueue.length === 0 && emptyRollSafety && missedBeforeRoll >= relicEmptyRollMisses(emptyRollSafety.relicId, emptyRollSafety.quality)) {
      const safety = triggerOrder(fighter.items).find((item) => isLarge(itemDef(item.defId), fighter))
        ?? triggerOrder(fighter.items).find((item) => [2, 3].includes(itemDef(item.defId).size))
      if (safety) initialQueue.push(safety)
      fighterState.emptyRolls = 0
    } else if (initialQueue.length === 0) {
      fighterState.emptyRolls += 1
    } else {
      fighterState.emptyRolls = 0
    }
    const queuedItems = hasEquippedEffect(fighter, 'ONLY_LUCKY_DOUBLE') && fighter.luckyNumber === roll
      ? initialQueue.flatMap((item) => [item, item])
      : initialQueue
    if (frogClassRoll && hasEquippedEffect(fighter, 'FROG_ROLL_ECHO')) {
      const echoTarget = initialMatches.find(({ item }) => itemDef(item.defId).kind !== 'CLASS_EQUIPMENT')?.item
      if (echoTarget) queuedItems.push(echoTarget)
    }
    const queue: TriggerQueueEntry[] = []
    queueBattleItems(queue, actorSide, fighter, queuedItems, time)
    const processed = processTriggerQueue(time, actorSide, fighter, roll, queue, extra, extraDepth, frogClassRoll)
    if (hasDefeatedFighter()) return 0
    for (let index = 0; index < processed.frogRollRequests && index < 3; index += 1) {
      resolveActor(time, actorSide, false, 0, true)
      if (hasDefeatedFighter()) return 0
    }
    return processed.extraRollRequests
  }

  const resolveActorChain = (time: number, actorSide: Side, extra = false, allowMuttTrait = false) => {
    const fighter = actorSide === 'player' ? player : opponent
    let pendingExtraRolls = resolveActor(time, actorSide, extra, extra ? 1 : 0)
    if (hasDefeatedFighter()) return
    if (allowMuttTrait && fighter.dogType === 'MUTT' && rng() < 0.2) pendingExtraRolls += 1

    let resolvedExtraRolls = 0
    while (pendingExtraRolls > 0 && resolvedExtraRolls < EXTRA_ROLL_CHAIN_CAP && !hasDefeatedFighter()) {
      pendingExtraRolls -= 1
      resolvedExtraRolls += 1
      pendingExtraRolls += resolveActor(time, actorSide, true, resolvedExtraRolls)
    }

    if (pendingExtraRolls > 0 && !hasDefeatedFighter()) {
      push({
        time,
        actor: actorSide,
        kind: 'ITEM',
        safetyCode: 'EXTRA_ROLL_CHAIN_CAP',
        text: `【额外投掷】链达到上限 ${EXTRA_ROLL_CHAIN_CAP}，后续【额外投掷】已截断`,
        effectType: 'UTILITY',
        target: 'none',
      })
    }
  }

  const rollInterval = (time: number, actorSide: Side) => {
    const fighter = actorSide === 'player' ? player : opponent
    const fighterState = state[actorSide]
    let interval = hasRelic(fighter, 'HUSKY_ENGINE') ? 0.85 : 1
    if (time < 10 && hasEquippedEffect(fighter, 'DOUBLE_RATE_FIRST_TEN')) interval = Math.min(interval, 0.5)
    if (fighterState.shibaSpeedStacks > 0) interval = Math.max(0.5, interval - fighterState.shibaSpeedStacks * 0.1)
    return interval
  }

  const currentWinner = () => resolveWinnerByHealthPercent(
    { hp: playerHp, maxHp: state.player.maxHp },
    { hp: opponentHp, maxHp: state.opponent.maxHp },
  )

  const currentLeadText = () => currentWinner() === 'player' ? '玩家胜利' : '对手胜利'

  const hasDefeatedFighter = () => playerHp <= 0 || opponentHp <= 0

  const finish = (time: number, text: string): BattleResult => {
    const winner = currentWinner()
    push({ time, actor: 'system', kind: 'END', target: 'none', text })
    return {
      winner,
      duration: time,
      playerHp: Math.max(0, playerHp),
      opponentHp: Math.max(0, opponentHp),
      playerMaxHp: state.player.maxHp,
      opponentMaxHp: state.opponent.maxHp,
      events,
      playerSnapshot,
      opponentSnapshot,
    }
  }

  const resolveSystemTick = (time: number): BattleResult | null => {
    for (const side of ['player', 'opponent'] as const) {
      if (state[side].poison > 0) {
        const before = getHp(side)
        const poisonedBy = side === 'player' ? opponent : player
        const poisonBonusRelic = relicWithEffect(poisonedBy, 'POISON_TICK_BONUS')
        const damage = state[side].poison + (poisonBonusRelic ? relicPoisonTickBonus(poisonBonusRelic.relicId, poisonBonusRelic.quality) : 0)
        const result = applyDirectHealthDamage(side, damage)
        push({
          time,
          actor: 'system',
          kind: 'POISON',
          effectType: 'POISON',
          amount: damage,
          target: side,
          sourceHpDelta: side === 'player' ? result.delta : 0,
          targetHpDelta: side === 'opponent' ? result.delta : 0,
          text: `\u3010\u4e2d\u6bd2\u3011\u7ed3\u7b97\uff0c${side === 'player' ? '\u73a9\u5bb6' : '\u5bf9\u624b'}\u53d7\u5230 ${before - result.after} \u70b9\u4f24\u5bb3`,
        })
      }
    }
    if (playerHp <= 0 || opponentHp <= 0) {
      return finish(time, `\u4e2d\u6bd2\u7ed3\u7b97\uff0c${currentLeadText()}`)
    }

    if (time > 60) {
      const poison = time - 60
      const playerBefore = playerHp
      const opponentBefore = opponentHp
      playerHp = Math.max(0, playerHp - poison)
      opponentHp = Math.max(0, opponentHp - poison)
      push({
        time,
        actor: 'system',
        kind: 'POISON',
        effectType: 'POISON',
        amount: poison,
        target: 'both',
        sourceHpDelta: playerHp - playerBefore,
        targetHpDelta: opponentHp - opponentBefore,
        text: `\u6bd2\u4f24\u52a0\u6df1\uff0c\u53cc\u65b9\u53d7\u5230 ${poison} \u70b9\u4f24\u5bb3`,
      })
      if (playerHp <= 0 || opponentHp <= 0) {
        return finish(time, `\u6bd2\u4f24\u7ed3\u7b97\uff0c${currentLeadText()}`)
      }
    }
    return null
  }

  const nextRollAt: Record<Side, number> = {
    player: player.dogType === 'FROG' ? Number.POSITIVE_INFINITY : 1,
    opponent: opponent.dogType === 'FROG' ? Number.POSITIVE_INFINITY : 1,
  }
  let nextSystemTickAt = 1
  const nextReservoirAt = () => {
    const times = [...Object.values(reservoirs.player), ...Object.values(reservoirs.opponent)].map((entry) => entry.nextAt)
    return times.length > 0 ? Math.min(...times) : Number.POSITIVE_INFINITY
  }

  while (true) {
    const nextRollTime = Math.min(nextRollAt.player, nextRollAt.opponent)
    const nextReservoirTime = nextReservoirAt()
    const nextTime = Math.min(nextRollTime, nextReservoirTime, nextSystemTickAt)
    if (nextTime > MAX_BATTLE_TIME + TIME_EPSILON) break

    const time = roundBattleTime(nextTime)
    if (nextReservoirTime <= nextRollTime + TIME_EPSILON && nextReservoirTime <= nextSystemTickAt + TIME_EPSILON) {
      for (const actor of ['player', 'opponent'] as const) {
        const fighter = actor === 'player' ? player : opponent
        for (const entry of Object.values(reservoirs[actor]).filter((candidate) => Math.abs(candidate.nextAt - time) <= TIME_EPSILON)) {
          resetReservoir(actor, entry.item, time)
          const queue: TriggerQueueEntry[] = []
          queueBattleItems(queue, actor, fighter, [entry.item], time, true, true, undefined, undefined, 'reservoir')
          const processed = processTriggerQueue(time, actor, fighter, 0, queue)
          for (let index = 0; index < processed.frogRollRequests && index < 3; index += 1) {
            resolveActor(time, actor, false, 0, true)
          }
          if (playerHp <= 0 || opponentHp <= 0) {
            return finish(time, `战斗结束，${currentLeadText()}`)
          }
        }
      }
      continue
    }

    if (nextRollTime <= nextSystemTickAt + TIME_EPSILON) {
      for (const actor of ['player', 'opponent'] as const) {
        if (Math.abs(nextRollAt[actor] - time) > TIME_EPSILON) continue
        if (state[actor].frozenUntil > time + TIME_EPSILON) {
          nextRollAt[actor] = roundBattleTime(state[actor].frozenUntil)
        } else {
          resolveActorChain(time, actor, false, true)
          nextRollAt[actor] = roundBattleTime(time + rollInterval(time, actor))
        }
        if (playerHp <= 0 || opponentHp <= 0) {
          return finish(time, `\u6218\u6597\u7ed3\u675f\uff0c${currentLeadText()}`)
        }
      }
      continue
    }

    const finished = resolveSystemTick(time)
    if (finished) return finished
    nextSystemTickAt = roundBattleTime(time + 1)
  }

  return finish(MAX_BATTLE_TIME, `120 \u79d2\u5224\u5b9a\uff1a${currentLeadText()}`)

}
