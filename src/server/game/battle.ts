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
  itemDefForQuality,
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
  FighterSnapshot,
  GameItem,
  ItemDef,
  ItemQuality,
} from './types'

type Side = 'player' | 'opponent'
const BULLY_LARGE_EFFECT_CHANCE = 0.4
const EMPEROR_LUCKY_EFFECT_CHANCE = 0.5
const TRIGGER_QUEUE_CAP = 40
const EXTRA_ROLL_CHAIN_CAP = 12
const MAX_BATTLE_TIME = 120
const TIME_EPSILON = 0.000001
const BASE_MAX_HP = 100
const EARLY_ROUND_HP_GROWTH = 20
const LATE_ROUND_HP_GROWTH = 50
const EARLY_HP_GROWTH_ROUNDS = 6

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
  target: Side | 'none'
  sourceHp: number
  targetHp: number
  sourceHpDelta: number
  targetHpDelta: number
  text: string
  roll?: number
}

type TriggerQueueEntry = {
  item: GameItem
  allowExtraRollFanout: boolean
}

type BattleSideState = {
  shield: number
  thorns: number
  weak: number
  poison: number
  maxHp: number
  rollCount: number
  emptyRolls: number
  missedLucky: number
  avalanche: number
  avalancheDamage: number
  freeze: number
  disabledLarge: number
  disabledItemIds: string[]
  adjacentDamageBonus: Record<string, number>
  forcedItemDice: Record<string, number>
  shibaSpeedStacks: number
}

function maxHealthForRound(round: number) {
  const completedRounds = Math.max(0, Math.floor(round))
  const earlyRounds = Math.min(completedRounds, EARLY_HP_GROWTH_ROUNDS)
  const lateRounds = Math.max(0, completedRounds - EARLY_HP_GROWTH_ROUNDS)
  return BASE_MAX_HP + earlyRounds * EARLY_ROUND_HP_GROWTH + lateRounds * LATE_ROUND_HP_GROWTH
}

function createSideState(maxHp: number): BattleSideState {
  return {
    shield: 0,
    thorns: 0,
    weak: 0,
    poison: 0,
    maxHp,
    rollCount: 0,
    emptyRolls: 0,
    missedLucky: 0,
    avalanche: 0,
    avalancheDamage: 50,
    freeze: 0,
    disabledLarge: 0,
    disabledItemIds: [],
    adjacentDamageBonus: {},
    forcedItemDice: {},
    shibaSpeedStacks: 0,
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

function hasShieldStatusMitigation(fighter: FighterSnapshot, shield: number) {
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

function matchingContext(actor: FighterSnapshot, item: GameItem, roll: number, forcedItemDice: Record<string, number> = {}) {
  const def = itemDef(item.defId)
  const forcedDie = forcedItemDice[item.id]
  if (forcedDie != null) return { matches: roll === forcedDie, scale: 1, note: roll === forcedDie ? '（圣旨改点）' : '' }

  if (actor.dogType === 'EMPEROR' && actor.luckyNumber && isAdjacentToEffect(actor, item, 'ADJACENT_USES_LUCKY')) {
    return { matches: roll === actor.luckyNumber, scale: 1, note: roll === actor.luckyNumber ? '（垂帘听政）' : '' }
  }

  if (def.dice.includes(roll)) return { matches: true, scale: 1, note: '' }

  const bigToSmall = relicWithEffect(actor, 'MIRROR_BIG_TO_SMALL')
  if (bigToSmall && roll <= 3 && def.dice.includes(roll + 3)) {
    return { matches: true, scale: relicEffectScale(bigToSmall.relicId, bigToSmall.quality), note: '（点金手·左映射）' }
  }
  const smallToBig = relicWithEffect(actor, 'MIRROR_SMALL_TO_BIG')
  if (smallToBig && roll >= 4 && def.dice.includes(roll - 3)) {
    return { matches: true, scale: relicEffectScale(smallToBig.relicId, smallToBig.quality), note: '（点金手·右映射）' }
  }
  if (triggerOrder(actor.items).some((item) => itemDef(item.defId).advancedEffect === 'TRIGGER_BY_SIZE') && def.size === roll) {
    return { matches: true, scale: 1, note: '（按容量触发）' }
  }
  return { matches: false, scale: 1, note: '' }
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

function queueItems(queue: TriggerQueueEntry[], items: GameItem[], allowExtraRollFanout = true) {
  queue.push(...items.map((item) => ({ item, allowExtraRollFanout })))
}

function itemName(def: ItemDef, quality: ItemQuality) {
  return quality === 'BRONZE' ? def.name : `${QUALITY_LABELS[quality]}${def.name}`
}

function roundScaled(amount: number, scale: number) {
  return Math.max(0, Math.round(amount * scale))
}

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

  const poisonTickDamage = (side: Side) => {
    if (state[side].poison <= 0) return 0
    const poisonedBy = side === 'player' ? opponent : player
    const poisonBonusRelic = relicWithEffect(poisonedBy, 'POISON_TICK_BONUS')
    return state[side].poison + (poisonBonusRelic ? relicPoisonTickBonus(poisonBonusRelic.relicId, poisonBonusRelic.quality) : 0)
  }

  const statusRows = (side: Side): BattleStatusRows => {
    const disabledCount = state[side].disabledLarge + state[side].disabledItemIds.length
    return {
      positive: [
        ...(state[side].shield > 0 ? [{ type: 'shield' as const, label: '护盾', tone: 'positive' as const, amount: Math.round(state[side].shield) }] : []),
        ...(state[side].thorns > 0 ? [{ type: 'thorns' as const, label: '荆棘', tone: 'positive' as const, stacks: state[side].thorns }] : []),
        ...(state[side].shibaSpeedStacks > 0 ? [{ type: 'extraRoll' as const, label: '加速', tone: 'positive' as const, stacks: state[side].shibaSpeedStacks }] : []),
      ],
      negative: [
        ...(state[side].poison > 0 ? [{ type: 'poison' as const, label: '中毒', tone: 'negative' as const, stacks: state[side].poison, nextTickIn: 1, tickDamage: poisonTickDamage(side) }] : []),
        ...(state[side].weak > 0 ? [{ type: 'weak' as const, label: '虚弱', tone: 'negative' as const, stacks: state[side].weak }] : []),
        ...(state[side].freeze > 0 ? [{ type: 'freeze' as const, label: '冻结', tone: 'negative' as const, remaining: state[side].freeze }] : []),
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
      playerStatuses: statusRows('player'),
      opponentStatuses: statusRows('opponent'),
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
    if (!hasShieldStatusMitigation(targetFighter, state[target].shield)) return amount
    return Math.ceil(amount / 2)
  }

  const addPoison = (target: Side, targetFighter: FighterSnapshot, amount: number) => {
    const applied = statusAmountAfterShieldMitigation(target, targetFighter, amount)
    if (applied <= 0) return 0
    state[target].poison += applied
    return applied
  }

  const addWeak = (target: Side, targetFighter: FighterSnapshot, amount: number) => {
    const applied = statusAmountAfterShieldMitigation(target, targetFighter, amount)
    if (applied <= 0) return 0
    state[target].weak += applied
    return applied
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

  const executeItem = (
    actorSide: Side,
    actor: FighterSnapshot,
    item: GameItem,
    time: number,
    roll: number,
    scale: number,
    note: string,
    queue: TriggerQueueEntry[],
    processed: { count: number; capped: boolean; extraRollRequests: number },
    extra: boolean,
    allowExtraRollFanout: boolean,
  ): ItemTrigger[] => {
    const targetSide = opponentOf(actorSide)
    const targetFighter = targetSide === 'player' ? player : opponent
    const def = itemDef(item.defId)
    const quality = normalizeQuality(item.quality)
    const triggers: ItemTrigger[] = []
    const actorState = state[actorSide]
    const targetState = state[targetSide]
    const advanced = def.advancedEffect ?? 'NONE'
    const recoveryBlocked = time <= 10 && hasEquippedEffect(actor, 'DOUBLE_RATE_FIRST_TEN')
    const sacrificeReplacesSmallEffect = def.size === 1
      && triggerOrder(actor.items).some((entry) => itemDef(entry.defId).advancedEffect === 'SMALL_TRIGGERS_LARGE')

    if (targetState.disabledItemIds.includes(item.id)) {
      targetState.disabledItemIds = targetState.disabledItemIds.filter((id) => id !== item.id)
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
      return triggers
    }

    if (targetState.disabledLarge > 0 && isLarge(def, actor)) {
      targetState.disabledLarge -= 1
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
      return triggers
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
    let amount = roundScaled(qualityAmountFrom(def.effect.amount, quality, def.effect.qualityBase) * multiplier, scale * globalEffectScale(actor))
    const damageBonus = actorState.adjacentDamageBonus[item.id] ?? 0
    if (damageBonus > 0 && (def.effect.type === 'DAMAGE' || def.effect.type === 'DAMAGE_SELF_SHIELD')) {
      amount += damageBonus
      delete actorState.adjacentDamageBonus[item.id]
    }

    if (!sacrificeReplacesSmallEffect && (def.effect.type === 'DAMAGE' || def.effect.type === 'DAMAGE_SELF_SHIELD')) {
      const before = getHp(targetSide)
      const result = applyDamage(targetSide, amount, advanced === 'DOUBLE_SHIELD_DAMAGE' ? amount * 2 : amount)
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
      if (targetState.thorns > 0) {
        const thorn = targetState.thorns * 3
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
        targetState.disabledLarge += 1
      }
      if (advanced === 'TARGET_WEAK_BONUS_DAMAGE' && targetState.weak > 0) {
        const bonus = qualityAmount(4, quality)
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
          text: `${itemName(def, quality)} 对【虚弱】目标额外造成 ${bonus} 点真实伤害`,
        })
      }
      if (advanced === 'APPLY_WEAK_ON_HIT') {
        const appliedWeak = addWeak(targetSide, targetFighter, qualityAmount(1, quality))
        if (appliedWeak > 0) {
          triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'UTILITY', amount: targetState.weak, target: targetSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: 0, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 施加 ${appliedWeak} 层【虚弱】` })
        }
      }
      if (!recoveryBlocked && advanced === 'LIFESTEAL' && after < before) {
        const healed = applyHeal(actorSide, before - after)
        triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'HEAL', amount: before - after, target: actorSide, sourceHp: healed.after, targetHp: getHp(targetSide), sourceHpDelta: healed.delta, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 吸取 ${before - after} 点生命` })
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
        triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'UTILITY', amount: 1, target: actorSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: 0, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 净化 1 层负面状态` })
      }
      if (advanced === 'HEAL_OR_MAX_HP' && wasFull) {
        const gain = qualityAmount(1, quality)
        actorState.maxHp += gain
        setHp(actorSide, getHp(actorSide) + gain)
        triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'HEAL', amount: gain, target: actorSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: gain, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 使最大生命值 +${gain}` })
      }
    }

    if (!sacrificeReplacesSmallEffect && advanced === 'POISON_ON_ROLL') {
      const appliedPoison = addPoison(targetSide, targetFighter, 3)
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
    if (!sacrificeReplacesSmallEffect && advanced === 'POISON_AND_DISABLE_RIGHTMOST') {
      const appliedPoison = addPoison(targetSide, targetFighter, amount)
      if (appliedPoison > 0) {
        triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'POISON', amount: targetState.poison, target: targetSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: 0, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 叠加 ${appliedPoison} 层【中毒】` })
      }
      const rightmost = triggerOrder(targetFighter.items).at(-1)
      if (rightmost) {
        targetState.disabledItemIds.push(rightmost.id)
        triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'UTILITY', amount: 1, target: targetSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: 0, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 使敌方最右侧装备【失效】一次` })
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
        const damage = qualityAmount(actorState.avalancheDamage, quality)
        actorState.avalancheDamage *= 2
        const result = applyDamage(targetSide, damage)
        triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'DAMAGE', amount: damage, target: targetSide, sourceHp: getHp(actorSide), targetHp: result.after, sourceHpDelta: 0, targetHpDelta: result.delta, roll, text: `${itemName(def, quality)} 引发雪崩，造成 ${damage} 点伤害` })
      }
    }
    if (!sacrificeReplacesSmallEffect && advanced === 'FREEZE_STACK' && roll >= 4) {
      actorState.freeze += 1
      if (actorState.freeze >= 10) {
        actorState.freeze = 0
        targetState.weak += 2
        triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'UTILITY', amount: 2, target: targetSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: 0, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 冻结敌人 2 秒` })
      }
    }
    if (!sacrificeReplacesSmallEffect && !recoveryBlocked && advanced === 'SHIELD_ON_NON_LUCKY' && actor.luckyNumber !== roll) {
      applyShield(actorSide, qualityAmount(5, quality))
      triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'UTILITY', amount: qualityAmount(5, quality), target: actorSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: 0, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 获得 ${qualityAmount(5, quality)} 点护盾` })
    }
    if (!sacrificeReplacesSmallEffect && !recoveryBlocked && (advanced === 'GAIN_SHIELD' || advanced === 'SHIELD_IMMUNITY')) {
      applyShield(actorSide, amount)
      triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'UTILITY', amount, target: actorSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: 0, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 获得 ${amount} 点护盾` })
    }
    if (!sacrificeReplacesSmallEffect && !recoveryBlocked && advanced === 'GAIN_SHIELD_THORNS') {
      applyShield(actorSide, amount)
      actorState.thorns += qualityAmount(1, quality)
      triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'UTILITY', amount, target: actorSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: 0, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 获得 ${amount} 点护盾与 ${qualityAmount(1, quality)} 层【荆棘】` })
    }
    if (!sacrificeReplacesSmallEffect && advanced === 'CLEANSE_ON_LUCKY' && actor.luckyNumber === roll) {
      actorState.poison = 0
      actorState.weak = 0
      triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'UTILITY', amount: 0, target: actorSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: 0, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 驱散所有负面状态` })
    }

    if (!sacrificeReplacesSmallEffect && advanced === 'ADJACENT_DAMAGE_BONUS') {
      for (const adjacent of adjacentItems(actor, item)) actorState.adjacentDamageBonus[adjacent.id] = (actorState.adjacentDamageBonus[adjacent.id] ?? 0) + qualityAmount(4, quality)
    }
    if (!sacrificeReplacesSmallEffect && (advanced === 'TRIGGER_ADJACENT' || advanced === 'ADJACENT_TEMP_TRIGGER' || (advanced === 'ADJACENT_ON_EXTRA_ROLL' && extra))) {
      queueItems(queue, adjacentItems(actor, item))
    }
    if (!sacrificeReplacesSmallEffect && advanced === 'TRIGGER_MINUS_THREE' && roll >= 4) {
      queueItems(queue, triggerOrder(actor.items).filter((entry) => itemDef(entry.defId).dice.includes(roll - 3)))
    }
    if (!sacrificeReplacesSmallEffect && advanced === 'LARGE_TRIGGERS_NON_LARGE' && isLarge(def, actor)) {
      const candidates = triggerOrder(actor.items).filter((entry) => !isLarge(itemDef(entry.defId), actor))
      if (candidates.length > 0) queueItems(queue, [candidates[Math.floor(rng() * candidates.length)]])
    }
    if (sacrificeReplacesSmallEffect) {
      queueItems(queue, triggerOrder(actor.items).filter((entry) => isLarge(itemDef(entry.defId), actor)))
    }
    if (!sacrificeReplacesSmallEffect && advanced === 'EXTRA_ROLL_TRIGGERS_ALL' && extra && allowExtraRollFanout) {
      queueItems(queue, triggerOrder(actor.items).filter((entry) => entry.id !== item.id).slice(0, 3), false)
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
        text: `触发队列达到上限 ${TRIGGER_QUEUE_CAP}，后续联动已截断`,
      })
    }

    return triggers
  }

  const resolveActor = (time: number, actorSide: Side, extra = false) => {
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
      text: `${fighter.name}${extra ? ' 额外' : ''}掷出 ${roll} 点（${DOGS[fighter.dogType].name}）`,
    })

    const initialQueue = triggerOrder(fighter.items).filter((item) => matchingContext(fighter, item, roll, fighterState.forcedItemDice).matches)
    if (hasEquippedEffect(fighter, 'ONLY_LUCKY_DOUBLE') && fighter.luckyNumber !== roll) initialQueue.length = 0
    if (initialQueue.length === 0) fighterState.emptyRolls += 1
    else fighterState.emptyRolls = 0
    const emptyRollSafety = relicWithEffect(fighter, 'EMPTY_ROLL_LARGE_SAFETY')
    if (initialQueue.length === 0 && emptyRollSafety && fighterState.emptyRolls >= relicEmptyRollMisses(emptyRollSafety.relicId, emptyRollSafety.quality)) {
      const safety = triggerOrder(fighter.items).find((item) => isLarge(itemDef(item.defId), fighter))
        ?? triggerOrder(fighter.items).find((item) => [2, 3].includes(itemDef(item.defId).size))
      if (safety) initialQueue.push(safety)
      fighterState.emptyRolls = 0
    }
    const queuedItems = hasEquippedEffect(fighter, 'ONLY_LUCKY_DOUBLE') && fighter.luckyNumber === roll
      ? initialQueue.flatMap((item) => [item, item])
      : initialQueue
    const queue = queuedItems.map((item) => ({ item, allowExtraRollFanout: true }))
    const processed = { count: 0, capped: false, extraRollRequests: 0 }
    while (queue.length > 0 && processed.count < TRIGGER_QUEUE_CAP) {
      const entry = queue.shift()
      if (!entry) continue
      const { item, allowExtraRollFanout } = entry
      const context = matchingContext(fighter, item, roll, fighterState.forcedItemDice)
      processed.count += 1
      for (const trigger of executeItem(actorSide, fighter, item, time, roll, context.scale, context.note, queue, processed, extra, allowExtraRollFanout)) {
        push({
          time,
          actor: actorSide,
          kind: 'ITEM',
          text: trigger.text,
          roll: trigger.roll,
          itemId: trigger.itemId,
          defId: trigger.defId,
          quality: trigger.quality,
          effectType: trigger.effectType,
          amount: trigger.amount,
          target: trigger.target,
          sourceHpDelta: trigger.sourceHpDelta,
          targetHpDelta: trigger.targetHpDelta,
        })
      }
    }
    if (queue.length > 0 && !processed.capped) {
      push({
        time,
        actor: actorSide,
        kind: 'ITEM',
        text: `触发队列达到上限 ${TRIGGER_QUEUE_CAP}，后续联动已截断`,
        effectType: 'UTILITY',
        target: 'none',
      })
    }
    return processed.extraRollRequests
  }

  const resolveActorChain = (time: number, actorSide: Side, extra = false, allowMuttTrait = false) => {
    const fighter = actorSide === 'player' ? player : opponent
    let pendingExtraRolls = resolveActor(time, actorSide, extra)
    if (allowMuttTrait && fighter.dogType === 'MUTT' && rng() < 0.2) pendingExtraRolls += 1

    let resolvedExtraRolls = 0
    while (pendingExtraRolls > 0 && resolvedExtraRolls < EXTRA_ROLL_CHAIN_CAP) {
      pendingExtraRolls -= 1
      resolvedExtraRolls += 1
      pendingExtraRolls += resolveActor(time, actorSide, true)
    }

    if (pendingExtraRolls > 0) {
      push({
        time,
        actor: actorSide,
        kind: 'ITEM',
        text: `额外投掷链达到上限 ${EXTRA_ROLL_CHAIN_CAP}，后续额外投掷已截断`,
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

  const nextRollAt: Record<Side, number> = { player: 1, opponent: 1 }
  let nextSystemTickAt = 1

  while (true) {
    const nextRollTime = Math.min(nextRollAt.player, nextRollAt.opponent)
    const nextTime = Math.min(nextRollTime, nextSystemTickAt)
    if (nextTime > MAX_BATTLE_TIME + TIME_EPSILON) break

    const time = roundBattleTime(nextTime)
    if (nextRollTime <= nextSystemTickAt + TIME_EPSILON) {
      for (const actor of ['player', 'opponent'] as const) {
        if (Math.abs(nextRollAt[actor] - time) > TIME_EPSILON) continue
        resolveActorChain(time, actor, false, true)
        nextRollAt[actor] = roundBattleTime(time + rollInterval(time, actor))
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
