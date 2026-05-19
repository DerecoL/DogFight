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
} from './data'
import { triggerOrder } from './grid'
import { normalizeQuality, qualityAmount, QUALITY_LABELS } from './quality'
import { createRng } from './rng'
import type {
  BattleEvent,
  BattleFighterSnapshot,
  BattleResult,
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
  }
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

function hasShieldImmunity(fighter: FighterSnapshot, shield: number) {
  return shield > 0 && triggerOrder(fighter.items).some((item) => itemDef(item.defId).advancedEffect === 'SHIELD_IMMUNITY')
}

function toBattleSnapshot(fighter: FighterSnapshot): BattleFighterSnapshot {
  return {
    ...fighter,
    items: fighter.items.map((item) => ({ ...item, quality: normalizeQuality(item.quality), def: itemDef(item.defId) })),
    relics: relicsOf(fighter).map((relic) => ({ ...relic, quality: normalizeQuality(relic.quality), def: relicDefForQuality(relic.relicId, relic.quality) })),
  }
}

function isLarge(def: ItemDef, actor: FighterSnapshot) {
  const sizeThreeIsLarge = triggerOrder(actor.items).some((item) => itemDef(item.defId).advancedEffect === 'SIZE_THREE_IS_LARGE')
  return def.size === 4 || (sizeThreeIsLarge && def.size === 3)
}

function matchingContext(actor: FighterSnapshot, def: ItemDef, roll: number) {
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

  const push = (event: Omit<BattleEvent, 'playerHp' | 'opponentHp' | 'playerMaxHp' | 'opponentMaxHp' | 'playerShield' | 'opponentShield'>) => {
    events.push({
      ...event,
      playerHp: Math.max(0, playerHp),
      opponentHp: Math.max(0, opponentHp),
      playerMaxHp: state.player.maxHp,
      opponentMaxHp: state.opponent.maxHp,
      playerShield: Math.max(0, state.player.shield),
      opponentShield: Math.max(0, state.opponent.shield),
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

  const addPoison = (target: Side, targetFighter: FighterSnapshot, amount: number) => {
    if (hasShieldImmunity(targetFighter, state[target].shield)) return false
    state[target].poison += amount
    return true
  }

  const addWeak = (target: Side, targetFighter: FighterSnapshot, amount: number) => {
    if (hasShieldImmunity(targetFighter, state[target].shield)) return false
    state[target].weak += amount
    return true
  }

  const playerOpeningThorns = relicWithEffect(player, 'OPENING_THORNS')
  const opponentOpeningThorns = relicWithEffect(opponent, 'OPENING_THORNS')
  if (playerOpeningThorns) state.player.thorns += relicOpeningThorns(playerOpeningThorns.relicId, playerOpeningThorns.quality)
  if (opponentOpeningThorns) state.opponent.thorns += relicOpeningThorns(opponentOpeningThorns.relicId, opponentOpeningThorns.quality)

  const executeItem = (
    actorSide: Side,
    actor: FighterSnapshot,
    item: GameItem,
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
    const emperorDoubled = actor.dogType === 'EMPEROR'
      && actor.luckyNumber === roll
      && rng() < EMPEROR_LUCKY_EFFECT_CHANCE
    const doubled = bullyDoubled || emperorDoubled
    const multiplier = bullyQuad ? 4 : doubled ? 2 : 1
    const traitText = bullyQuad ? '（恶霸4倍翻倍）' : bullyDoubled ? '（恶霸翻倍）' : emperorDoubled ? '（狗皇帝幸运翻倍）' : ''
    let amount = roundScaled(qualityAmount(def.effect.amount, quality) * multiplier, scale * globalEffectScale(actor))
    const damageBonus = actorState.adjacentDamageBonus[item.id] ?? 0
    if (damageBonus > 0 && (def.effect.type === 'DAMAGE' || def.effect.type === 'DAMAGE_SELF_SHIELD')) {
      amount += damageBonus
      delete actorState.adjacentDamageBonus[item.id]
    }

    if (def.effect.type === 'DAMAGE' || def.effect.type === 'DAMAGE_SELF_SHIELD') {
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
      if (advanced === 'APPLY_WEAK_ON_HIT' && addWeak(targetSide, targetFighter, qualityAmount(1, quality))) {
        triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'UTILITY', amount: targetState.weak, target: targetSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: 0, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 施加 ${qualityAmount(1, quality)} 层【虚弱】` })
      }
      if (advanced === 'LIFESTEAL' && after < before) {
        const healed = applyHeal(actorSide, before - after)
        triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'HEAL', amount: before - after, target: actorSide, sourceHp: healed.after, targetHp: getHp(targetSide), sourceHpDelta: healed.delta, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 吸取 ${before - after} 点生命` })
      }
    }

    if (def.effect.type === 'HEAL') {
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

    if (advanced === 'POISON_ON_ROLL') {
      if (addPoison(targetSide, targetFighter, qualityAmount(3, quality))) {
        triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'POISON', amount: targetState.poison, target: targetSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: 0, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 叠加 ${qualityAmount(3, quality)} 层【中毒】` })
      }
    }
    if (advanced === 'APPLY_POISON') {
      if (addPoison(targetSide, targetFighter, amount)) {
        triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'POISON', amount: targetState.poison, target: targetSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: 0, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 叠加 ${amount} 层【中毒】` })
      }
    }
    if (advanced === 'POISON_AND_DISABLE_RIGHTMOST') {
      if (addPoison(targetSide, targetFighter, amount)) {
        triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'POISON', amount: targetState.poison, target: targetSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: 0, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 叠加 ${amount} 层【中毒】` })
      }
      const rightmost = triggerOrder(targetFighter.items).at(-1)
      if (rightmost) {
        targetState.disabledItemIds.push(rightmost.id)
        triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'UTILITY', amount: 1, target: targetSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: 0, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 使敌方最右侧装备【失效】一次` })
      }
    }
    if (advanced === 'GAIN_THORNS' && rng() < 0.5) {
      actorState.thorns += qualityAmount(1, quality)
      triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'UTILITY', amount: actorState.thorns, target: actorSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: 0, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 获得 ${qualityAmount(1, quality)} 层【荆棘】` })
    }
    if (advanced === 'APPLY_WEAK' && rng() < 0.5) {
      if (addWeak(targetSide, targetFighter, qualityAmount(1, quality))) {
        triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'UTILITY', amount: targetState.weak, target: targetSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: 0, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 施加 ${qualityAmount(1, quality)} 层【虚弱】` })
      }
    }
    if (advanced === 'AVALANCHE' && roll <= 3) {
      actorState.avalanche += 1
      if (actorState.avalanche >= 5) {
        actorState.avalanche = 0
        const damage = qualityAmount(actorState.avalancheDamage, quality)
        actorState.avalancheDamage *= 2
        const result = applyDamage(targetSide, damage)
        triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'DAMAGE', amount: damage, target: targetSide, sourceHp: getHp(actorSide), targetHp: result.after, sourceHpDelta: 0, targetHpDelta: result.delta, roll, text: `${itemName(def, quality)} 引发雪崩，造成 ${damage} 点伤害` })
      }
    }
    if (advanced === 'FREEZE_STACK' && roll >= 4) {
      actorState.freeze += 1
      if (actorState.freeze >= 10) {
        actorState.freeze = 0
        targetState.weak += 2
        triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'UTILITY', amount: 2, target: targetSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: 0, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 冻结敌人 2 秒` })
      }
    }
    if (advanced === 'SHIELD_ON_NON_LUCKY' && actor.luckyNumber !== roll) {
      applyShield(actorSide, qualityAmount(5, quality))
      triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'UTILITY', amount: qualityAmount(5, quality), target: actorSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: 0, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 获得 ${qualityAmount(5, quality)} 点护盾` })
    }
    if (advanced === 'GAIN_SHIELD' || advanced === 'SHIELD_IMMUNITY') {
      applyShield(actorSide, amount)
      triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'UTILITY', amount, target: actorSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: 0, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 获得 ${amount} 点护盾` })
    }
    if (advanced === 'GAIN_SHIELD_THORNS') {
      applyShield(actorSide, amount)
      actorState.thorns += qualityAmount(1, quality)
      triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'UTILITY', amount, target: actorSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: 0, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 获得 ${amount} 点护盾与 ${qualityAmount(1, quality)} 层【荆棘】` })
    }
    if (advanced === 'CLEANSE_ON_LUCKY' && actor.luckyNumber === roll) {
      actorState.poison = 0
      actorState.weak = 0
      triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'UTILITY', amount: 0, target: actorSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: 0, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 驱散所有负面状态` })
    }

    if (advanced === 'ADJACENT_DAMAGE_BONUS') {
      for (const adjacent of adjacentItems(actor, item)) actorState.adjacentDamageBonus[adjacent.id] = (actorState.adjacentDamageBonus[adjacent.id] ?? 0) + qualityAmount(4, quality)
    }
    if (advanced === 'TRIGGER_ADJACENT' || advanced === 'ADJACENT_TEMP_TRIGGER' || (advanced === 'ADJACENT_ON_EXTRA_ROLL' && extra)) {
      queueItems(queue, adjacentItems(actor, item))
    }
    if (advanced === 'TRIGGER_MINUS_THREE' && roll >= 4) {
      queueItems(queue, triggerOrder(actor.items).filter((entry) => itemDef(entry.defId).dice.includes(roll - 3)))
    }
    if (advanced === 'LARGE_TRIGGERS_NON_LARGE' && isLarge(def, actor)) {
      const candidates = triggerOrder(actor.items).filter((entry) => !isLarge(itemDef(entry.defId), actor))
      if (candidates.length > 0) queueItems(queue, [candidates[Math.floor(rng() * candidates.length)]])
    }
    if (advanced === 'SMALL_TRIGGERS_LARGE' && def.size === 1) {
      queueItems(queue, triggerOrder(actor.items).filter((entry) => isLarge(itemDef(entry.defId), actor)))
    }
    if (advanced === 'EXTRA_ROLL_TRIGGERS_ALL' && extra && allowExtraRollFanout) {
      queueItems(queue, triggerOrder(actor.items), false)
    }
    if (advanced === 'ROLL_COUNTER_EXTRA' && actorState.rollCount % 4 === 0) {
      processed.extraRollRequests += 1
    }
    if ((advanced === 'EXTRA_ROLL_CHANCE' && rng() < 0.2) || (advanced === 'EXTRA_ROLL_RECURSE' && extra && rng() < 0.2)) {
      processed.extraRollRequests += 1
    }
    if (advanced === 'MAX_HP_ON_EXTRA_ROLL' && extra) {
      actorState.maxHp += qualityAmount(1, quality)
      setHp(actorSide, getHp(actorSide) + qualityAmount(1, quality))
      triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'HEAL', amount: qualityAmount(1, quality), target: actorSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: qualityAmount(1, quality), targetHpDelta: 0, roll, text: `${itemName(def, quality)} 使最大生命值 +${qualityAmount(1, quality)}` })
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

    const initialQueue = triggerOrder(fighter.items).filter((item) => matchingContext(fighter, itemDef(item.defId), roll).matches)
    if (initialQueue.length === 0) fighterState.emptyRolls += 1
    else fighterState.emptyRolls = 0
    const emptyRollSafety = relicWithEffect(fighter, 'EMPTY_ROLL_LARGE_SAFETY')
    if (initialQueue.length === 0 && emptyRollSafety && fighterState.emptyRolls >= relicEmptyRollMisses(emptyRollSafety.relicId, emptyRollSafety.quality)) {
      const safety = triggerOrder(fighter.items).find((item) => isLarge(itemDef(item.defId), fighter))
        ?? triggerOrder(fighter.items).find((item) => [2, 3].includes(itemDef(item.defId).size))
      if (safety) initialQueue.push(safety)
      fighterState.emptyRolls = 0
    }
    const queue = initialQueue.map((item) => ({ item, allowExtraRollFanout: true }))
    const processed = { count: 0, capped: false, extraRollRequests: 0 }
    while (queue.length > 0 && processed.count < TRIGGER_QUEUE_CAP) {
      const entry = queue.shift()
      if (!entry) continue
      const { item, allowExtraRollFanout } = entry
      const def = itemDef(item.defId)
      const context = matchingContext(fighter, def, roll)
      processed.count += 1
      for (const trigger of executeItem(actorSide, fighter, item, roll, context.scale, context.note, queue, processed, extra, allowExtraRollFanout)) {
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

  for (let time = 1; time <= 120; time += 1) {
    for (const actor of ['player', 'opponent'] as const) {
      resolveActorChain(time, actor, false, true)
      const fighter = actor === 'player' ? player : opponent
      if (hasRelic(fighter, 'HUSKY_ENGINE') && time % 6 === 0) resolveActorChain(time, actor, true)

      if (playerHp <= 0 || opponentHp <= 0) {
        return finish(time, `战斗结束：${currentLeadText()}`)
      }
    }

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
          text: `【中毒】结算，${side === 'player' ? '玩家' : '对手'}受到 ${before - result.after} 点伤害`,
        })
      }
    }
    if (playerHp <= 0 || opponentHp <= 0) {
      return finish(time, `中毒结算：${currentLeadText()}`)
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
        text: `毒伤加深，双方受到 ${poison} 点伤害`,
      })
      if (playerHp <= 0 || opponentHp <= 0) {
        return finish(time, `毒伤结算：${currentLeadText()}`)
      }
    }
  }

  return finish(120, `120 秒判定：${currentLeadText()}`)
}
